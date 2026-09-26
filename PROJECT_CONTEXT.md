# Contexte durable du projet — FVS / AGS-Solution

> Dernière mise à jour : 25 septembre 2026
> Document de continuité pour toute nouvelle session de développement.
> Ce document décrit les décisions fonctionnelles validées, la cible architecturale et les travaux prévus. Pour connaître l'état exact d'une fonctionnalité, lire le code réel et vérifier les migrations appliquées.

## 1. Identité et vision du produit

FVS a commencé comme une plateforme de gestion de cartes d'identité scolaires pour les écoles au Bénin. Le produit évolue vers un système de gestion scolaire complet, nommé ici AGS-Solution, comprenant :

- installation et configuration d'un établissement ;
- sites principaux et filiales ;
- comptes de gestion par rôle ;
- années scolaires ;
- cycles, niveaux et classes ;
- registre des élèves ;
- inscriptions et réinscriptions ;
- transferts et historique des affectations ;
- configuration de la scolarité et des frais ;
- paiements et caisse ;
- professeurs, matières et affectations pédagogiques ;
- cartes d'identité FVS comme service activable ;
- notes, bulletins et classements dans un chantier ultérieur.

Le propriétaire est développeur et maintient seul la plateforme, parfois sans accès réseau. L'architecture doit donc rester lisible, explicite, durable et vérifiable localement.

## 2. Décisions fonctionnelles définitives

### 2.1 Types d'établissement

Il existe uniquement deux types d'établissement :

- `primaire` ;
- `college`.

Le type `college` inclut le lycée. Il n'y a plus de type `mixte` et il ne faut pas le réintroduire.

Le type choisi lors de la création de l'établissement doit avoir un effet fonctionnel réel : il détermine les niveaux standards proposés, les cycles par défaut, les interfaces cohérentes et les règles pédagogiques par défaut.

Le type ne doit toutefois pas transformer les niveaux en chaînes codées en dur dans les requêtes SQL. Les règles d'affichage peuvent utiliser la configuration du type, mais les relations doivent utiliser les identifiants de la structure académique.

### 2.2 Modèle de données cible

Le modèle cible est :

- `Establishment` pour l'établissement, les sites et les années scolaires ;
- `AcademicStructure` pour cycles, niveaux et classes annuelles ;
- `SchoolLevel` pour la gestion des niveaux.

L'ancien modèle `College` / `Class`, ainsi que les flux historiques fondés sur `college_id`, `niveau`, `serie` et l'ancien formulaire collège, sont obsolètes pour la nouvelle gestion scolaire. Ils peuvent rester temporairement dans le dépôt uniquement pour permettre la transition. Ils devront être supprimés après l'inventaire complet des références, le branchement du modèle cible et la validation des flux.

Ne pas développer de nouvelle fonctionnalité scolaire sur l'ancien modèle.

### 2.3 Hiérarchie académique

La hiérarchie cible est :

```text
etablissement
  └── sites / filiales
        └── années scolaires
              └── classes_annuelles
                    └── classes
                          └── niveaux_scolaires
                                └── cycles
```

Une classe durable représente le niveau. Une `classe_annuelle` représente son ouverture dans un site et une année scolaire données, avec éventuellement un groupe ou une série.

Les élèves doivent être reliés à l'inscription et à l'affectation annuelle, jamais seulement à un libellé de classe.

## 3. Niveaux scolaires

### 3.1 Niveaux standards

Les niveaux standards sont conservés pour fournir une expérience claire et cohérente.

Primaire :

```text
CI, CP, CE1, CE2, CM1, CM2
```

Collège/lycée :

```text
6e, 5e, 4e, 3e, 2nde, 1ère, Terminale
```

Ces niveaux standards ne doivent pas être supprimés au profit d'une configuration entièrement libre. Des niveaux personnalisés pourront être envisagés plus tard pour les établissements bilingues ou particuliers, mais ce n'est pas une raison pour casser les règles actuelles du collège.

### 3.2 Identifiants

La règle validée est : utiliser l'identifiant du niveau avec son code.

Pour `niveaux_scolaires` :

- `id` : identifiant relationnel principal, utilisé dans les clés étrangères et les jointures ;
- `code` : code technique stable, utile pour API, logs, import/export et diagnostic ;
- `libelle` : texte présenté à l'utilisateur ;
- `ordre` : progression du niveau ;
- `cycle_id` : cycle auquel le niveau appartient ;
- `actif` : état d'utilisation du niveau.

Règle SQL :

```sql
classes.niveau_id = niveaux_scolaires.id
```

Les requêtes ne doivent plus faire dépendre les relations principales de `niveau_code`. Le code peut être renvoyé avec l'id dans les API, mais il ne remplace pas la clé étrangère.

### 3.3 Progression

`ordre` sert notamment à :

- afficher les niveaux dans le bon ordre ;
- préparer la promotion annuelle ;
- rechercher le niveau supérieur ;
- produire les statistiques ;
- préparer les futurs classements et bulletins.

Réordonner un niveau déjà utilisé doit être encadré, car cela peut modifier l'interprétation de la progression annuelle. Une désactivation est préférable à une suppression lorsqu'un niveau est déjà utilisé.

## 4. Cycles, groupes et séries

### 4.1 Cycles

Les cycles sont rattachés à la structure de l'établissement et sont créés/configurés selon le type :

- primaire : structure primaire ;
- collège : premier cycle et second cycle, avec le lycée inclus dans le second cycle selon la configuration retenue.

Les cycles ne doivent pas être confondus avec les sites. Un cycle décrit la progression pédagogique ; un site décrit une implantation géographique ou une filiale.

### 4.2 Groupes et séries au collège

La logique actuelle du collège est conservée :

- les niveaux concernés sont automatiquement proposés comme `groupe` ou `série` ;
- la secrétaire ne doit pas devoir deviner ou saisir manuellement la règle normale ;
- la 3e conserve son cas particulier si le choix groupe/série est déjà prévu ;
- les niveaux du second cycle utilisent les séries selon la règle collège existante.

Cette automatisation doit être pilotée par la structure/configuration du niveau ou du cycle, et non par des jointures SQL vers une ancienne colonne supprimée.

### 4.3 Primaire

Le primaire n'est pas encore implémenté. Il doit utiliser le même modèle commun, avec les niveaux `CI` à `CM2`.

La première implémentation primaire doit rester simple :

- choix du site ;
- choix de l'année active ;
- choix du niveau primaire ;
- division/groupe selon le besoin ;
- création de la classe annuelle ;
- inscription et réinscription dans le même flux que le collège.

Le primaire ne doit pas recevoir une seconde architecture parallèle. Les différences doivent être portées par le type d'établissement, les cycles, la configuration et les permissions.

## 5. Établissement, sites et filiales

### 5.1 Établissement

L'installation crée un établissement unique avec un type `primaire` ou `college`.

La création doit permettre de configurer :

- nom ;
- type ;
- informations administratives ;
- site principal ;
- filiales initiales éventuelles ;
- comptes de gestion initiaux ;
- modules/services disponibles.

### 5.2 Sites et filiales

Un site est une implantation de l'établissement, pas un nouvel établissement indépendant.

Le site principal est créé lors de l'installation. L'administrateur FVS peut ajouter des filiales. Chaque site peut avoir :

- ses classes annuelles ;
- ses élèves et inscriptions ;
- ses comptes limités ;
- ses professeurs ;
- sa configuration financière ;
- ses statistiques.

Le directeur peut consulter l'ensemble de l'établissement. Les comptes limités doivent être isolés par leur portée de site côté serveur.

Les transferts intersites doivent être contrôlés et conserver l'historique, sans supprimer l'élève.

## 6. Services et activation des cartes FVS

La gestion scolaire et les cartes FVS sont deux services distincts.

Le type d'établissement (`primaire` ou `college`) ne doit pas être confondu avec l'activation du service Cartes.

La cible fonctionnelle est :

```text
Type établissement : primaire | college

Services :
  gestion scolaire
  cartes FVS
```

Un établissement primaire peut utiliser la gestion scolaire sans cartes, ou activer les cartes. Un collège peut faire de même.

Lorsque le service Cartes est inactif :

- les fonctions de gestion scolaire restent disponibles ;
- les écrans et routes Cartes doivent être masqués ou protégés ;
- aucune donnée scolaire ne doit être recréée ou dupliquée pour activer Cartes.

Lorsque le service Cartes est activé :

- les fonctions de cartes utilisent les élèves/classes déjà gérés par AGS-Solution ;
- le service peut exploiter les informations de l'établissement, du site et de l'élève ;
- le format `a4` reste destiné à une feuille A4 avec plusieurs cartes ;
- le format `pvc` reste destiné exclusivement à une imprimante de cartes PVC dédiée.

L'activation du service Cartes ne doit pas réintroduire une ancienne logique de `College` ou d'activation de compte de gestion par email.

## 7. Comptes et rôles

Les comptes techniques FVS et les comptes de gestion sont distincts.

Rôles de gestion :

- `directeur` : consultation globale de l'établissement, des sites, des classes, des élèves et des indicateurs ;
- `secretaire` : classes, niveaux selon la configuration retenue, registre élèves, transferts et informations administratives ;
- `comptable` : inscriptions, réinscriptions, scolarité, frais, paiements et caisse ;
- `censeur` : consultation des élèves/classes et gestion pédagogique prévue par les permissions, notamment professeurs, matières et affectations ;
- administrateur FVS : installation, sites/filiales, comptes initiaux et services FVS.

Les permissions doivent être vérifiées côté serveur. L'interface ne suffit jamais à garantir la sécurité.

### Point obsolète à ne pas poursuivre

Un flux d'activation des comptes de gestion par email, fondé sur l'ancien modèle collège/classe, est obsolète dans la vision actuelle.

Ne pas implémenter ou étendre ce flux sans nouvelle décision explicite. Les comptes de gestion doivent suivre le modèle actuel `users` / sessions de gestion, les permissions et la portée site prévues par l'architecture `Establishment` / `AcademicStructure`.

Toute fonctionnalité d'activation, d'invitation ou de réinitialisation doit être analysée séparément et ne doit pas être branchée sur `College`, `Class`, `college_id` ou l'ancien formulaire collège.

## 8. Flux scolaires

### 8.1 Année scolaire

Le directeur prépare et active l'année scolaire. Une année peut être brouillon, active ou archivée selon les règles existantes.

Les classes annuelles, configurations financières et affectations doivent être liées à l'année scolaire explicite.

### 8.2 Classes

La secrétaire crée les classes annuelles après activation de l'année.

Le parcours cible est :

```text
site
→ année scolaire active
→ cycle
→ niveau
→ groupe/série éventuel
→ classe annuelle
```

La création doit empêcher les doublons pour un même site, une même année, un même niveau et une même division.

### 8.3 Élèves et inscriptions

Le comptable crée les inscriptions et réinscriptions. La secrétaire gère le registre et les transferts.

L'inscription doit conserver :

- l'élève durable ;
- l'année scolaire ;
- le site ;
- la classe annuelle ;
- le type d'inscription ;
- les obligations financières ;
- l'utilisateur ayant créé l'opération.

Les transferts doivent fermer l'affectation précédente, créer l'affectation de destination et conserver l'historique.

## 9. Finances et scolarité

Le socle financier comprend déjà ou prévoit :

- frais généraux ;
- frais obligatoires ou facultatifs ;
- tarifs par classe annuelle ;
- tranches ;
- échéances ;
- paiements ;
- caisse ;
- historique et états financiers.

Les configurations financières doivent utiliser la classe annuelle, le site et l'année scolaire. Elles ne doivent pas dépendre du nom texte du niveau ou de l'ancien `college_id`.

Le flux primaire doit réutiliser ce système, avec des montants et règles configurables propres au site et à l'année.

## 10. Professeurs, matières et affectations

La logique pédagogique doit distinguer :

- collège/lycée : professeur + matière + classe annuelle ;
- primaire : professeur + classe annuelle, sans matière obligatoire au même niveau de détail.

`matiere_id` peut être nullable techniquement, mais doit être obligatoire pour les affectations collège/lycée et absent ou non requis pour le primaire selon le type d'établissement.

Le censeur gère ou consulte les professeurs, matières et affectations selon les permissions validées. Ces fonctionnalités doivent être scellées au site, à l'année et à la classe annuelle.

## 11. Notes, bulletins et classements — préparation future

Les notes et bulletins ne sont pas le chantier immédiat, mais le modèle actuel doit les rendre possibles.

Toute future évaluation devra pouvoir retrouver :

- établissement ;
- site ;
- année scolaire ;
- élève ;
- classe annuelle ;
- niveau ;
- cycle ;
- période ;
- matière ou domaine ;
- type d'évaluation ;
- valeur ou compétence.

Le système devra pouvoir supporter ultérieurement :

- notation numérique sur 20 ;
- approche par compétences ;
- trimestres ;
- semestres ;
- périodes propres à l'établissement.

Le classement devra pouvoir être produit :

- par classe ;
- par niveau ;
- par cycle ;
- par site ;
- par établissement.

Le classement doit utiliser l'affectation de l'élève au moment de l'évaluation, pas seulement sa classe actuelle après un transfert.

## 12. Migrations et état technique

Le dépôt utilise `node-pg-migrate`. Les migrations doivent être vérifiées contre le schéma réel et dans leur ordre d'application.

Points à contrôler :

- cohérence du type établissement `primaire | college` ;
- coexistence temporaire des anciens et nouveaux modèles ;
- références restantes à `niveau_code`, `college_id`, `College` et `Class` ;
- contraintes de groupes/séries ;
- contraintes d'unicité des classes annuelles ;
- portée site ;
- migrations destructives ou de test ;
- compatibilité base vierge/base existante.

Une migration de test qui réinitialise les données ne doit pas être traitée comme une migration de production normale. Les données réelles, notamment élèves, inscriptions, paiements et comptes, ne doivent pas être détruites.

## 13. État actuel connu

Le socle de gestion scolaire, les comptes par rôle, les sites, les années scolaires, les inscriptions, réinscriptions, élèves, finances et une partie des fonctions pédagogiques sont déjà développés.

Le chantier de transition vers `Establishment` / `AcademicStructure` n'est pas encore entièrement terminé :

- des références historiques à `niveau_code` peuvent encore exister ;
- certaines requêtes ou interfaces peuvent encore attendre l'ancien modèle ;
- le collège doit être entièrement validé avec `niveau_id` ;
- le primaire `CI` à `CM2` reste à brancher ;
- l'ancien modèle `College` / `Class` doit être supprimé seulement après validation ;
- l'activation Cartes doit être reliée au système de services, pas à l'ancien modèle ;
- le flux obsolète d'activation de comptes par email sur ancien modèle ne doit pas être poursuivi.

## 14. Ordre de développement recommandé

1. Vérifier l'état réel des migrations et corriger les incohérences.
2. Inventorier toutes les références à l'ancien modèle et à `niveau_code`.
3. Corriger les requêtes et flux collège vers `niveau_id`, avec `code` disponible en complément.
4. Valider les quatre espaces de gestion : directeur, secrétaire, comptable, censeur.
5. Valider création de sites/filiales et isolation par site.
6. Valider inscriptions, réinscriptions, classes, transferts, finances et import.
7. Mettre en place le service Cartes activable sans dépendance à l'ancien modèle.
8. Brancher le primaire `CI` à `CM2` sur la même architecture.
9. Valider groupes/séries et règles d'affichage collège/primaire.
10. Supprimer l'ancien modèle `College` / `Class` après recherche complète des références.
11. Préparer le chantier notes, bulletins et classements.

## 15. Fichiers et zones de référence

- `AGENTS.md` : règles de collaboration obligatoires ;
- `backend/src/models/Establishment.js` : établissement, sites et années ;
- `backend/src/models/AcademicStructure.js` : cycles, niveaux et classes annuelles ;
- `backend/src/models/SchoolLevel.js` : niveaux ;
- `backend/src/models/AccessScope.js` : portée établissement/site ;
- `backend/src/models/Enrollment.js` : inscriptions et réinscriptions ;
- `backend/src/models/StudentRegistry.js` : registre, classes et transferts ;
- `backend/src/models/Professor.js` : professeurs et affectations ;
- `frontend/src/pages/AdminDashboard.jsx` : installation, type et sites ;
- `frontend/src/pages/ManagementDashboard.jsx` : espace de gestion ;
- `frontend/src/pages/ManagementWorkspace.jsx` : navigation par rôle ;
- `frontend/src/pages/ClassesManagement.jsx` : gestion des classes ;
- `backend/src/controllers/` et `backend/src/routes/` : flux API ;
- `backend/migrations/` : historique et évolution du schéma.

## 16. Stack et hébergement

Backend : Node.js, Express, PostgreSQL via Supabase, JWT, stockage Supabase ou local.

Frontend : React 18, Vite, Tailwind, Axios, React Router, lucide-react, pdf-lib.

Hébergement : frontend Vercel, backend Render plan gratuit, base Supabase.

