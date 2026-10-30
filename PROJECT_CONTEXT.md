# Contexte durable du projet — FVS / AGS-Solution

> Dernière mise à jour : 30 octobre 2026
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
- notes, bulletins et classements dans un chantier ultérieur.

Le produit actif est exclusivement la gestion scolaire AGS-Solution. Le module Cartes d'identité scolaire a été retiré à la décision du propriétaire le 30 octobre 2026. Les anciens schémas, migrations et fichiers stockés sont conservés comme historique ; ils ne sont ni supprimés ni consultés par les parcours actifs.

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

## 6. Retrait du module Cartes

Depuis le 30 octobre 2026, le produit actif est centré à 100 % sur la gestion scolaire. Les écrans, endpoints, modèles et services applicatifs de génération et de suivi des cartes ont été retirés du code actif.

Garde-fous de conservation :

- les migrations déjà livrées restent dans l'historique et ne sont pas réécrites ;
- les tables, colonnes, lignes et fichiers Storage existants ne sont pas supprimés ;
- aucune route ni interface de gestion ne doit dépendre des anciennes données Cartes ;
- toute suppression physique ultérieure de données ou de schéma nécessite une décision explicite distincte et une analyse de migration.

## 7. Comptes et rôles

Les comptes techniques FVS et les comptes de gestion sont distincts.

Rôles de gestion :

- `directeur` : consultation globale de l'établissement, des sites, des classes, des élèves et des indicateurs ;
- `secretaire` : classes, niveaux selon la configuration retenue, registre élèves, transferts et informations administratives ;
- `comptable` : inscriptions, réinscriptions, scolarité, frais, paiements et caisse ;
- `censeur` : consultation des élèves/classes et gestion pédagogique prévue par les permissions, notamment professeurs, matières et affectations ;
- administrateur FVS : installation, sites/filiales et comptes initiaux.

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
- migrations destructives ou de test ; la migration historique `1790339258594_remodelage-db.js` est désormais vide et ne réinitialise plus aucune donnée ;
- compatibilité base vierge/base existante.

Une migration de test qui réinitialise les données ne doit pas être traitée comme une migration de production normale. Les données réelles, notamment élèves, inscriptions, paiements et comptes, ne doivent pas être détruites.

## 13. État actuel connu

Le socle de gestion scolaire, les comptes par rôle, les sites, les années scolaires, les inscriptions, réinscriptions, élèves, finances et une partie des fonctions pédagogiques sont déjà développés.

Le chantier de transition vers `Establishment` / `AcademicStructure` n'est pas encore entièrement terminé :

- des références historiques à `niveau_code` peuvent encore exister ;
- certaines requêtes ou interfaces peuvent encore attendre l'ancien modèle ;
- le collège doit être entièrement validé avec `niveau_id` ;
- le primaire `CI` à `CM2` reste à brancher ;
- le problème de recherche `CI` dans l'espace secrétaire est résolu. La comparaison s'effectuait sur le nom complet de la classe, qui assemble notamment le site principal (« Cité ministérielle »), la classe et le niveau ; la recherche courte `CI` correspondait alors à tort à du texte dans ce nom composé. La recherche actuelle filtre la liste chargée côté interface, normalise accents et casse, et tient compte des codes/noms de niveaux et de certaines recherches par site ;
- l'ancien modèle `College` / `Class` doit être supprimé seulement après validation ;
- le module Cartes a été retiré du code actif ; ses migrations et données éventuelles restent conservées ;
- le flux obsolète d'activation de comptes par email sur ancien modèle ne doit pas être poursuivi.
- aucun cron d'expiration de clés n'est présent dans le checkout actuel ; les anciennes traces d'expiration, de réactivation et de clés d'accès appartiennent à l'historique et ne décrivent plus le fonctionnement courant.

## 14. Ordre de développement recommandé

1. Vérifier les changements récents des espaces Comptable et Secrétaire, notamment l'affichage des échéances dépassées. Le problème de recherche `CI` est résolu ; éviter de réintroduire une comparaison de la requête courte avec le nom composé complet de la classe.
2. Vérifier l'état réel des migrations et corriger les incohérences.
3. Inventorier toutes les références à l'ancien modèle et à `niveau_code`.
4. Corriger les requêtes et flux collège vers `niveau_id`, avec `code` disponible en complément.
5. Valider les quatre espaces de gestion : directeur, secrétaire, comptable, censeur.
6. Valider création de sites/filiales et isolation par site.
7. Valider inscriptions, réinscriptions, classes, transferts, finances et import.
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

## 17. État réel mis à jour au 16 octobre 2026

Cette section fait foi pour la reprise du projet. Elle complète les décisions précédentes sans les remplacer.

### 17.1 Fondations et modèle scolaire

Implémenté ou présent dans le dépôt :

- migrations `node-pg-migrate` avec table de suivi `pgmigrations` ;
- modèle moderne `etablissement`, `sites`, `annees_scolaires`, `classes_annuelles`, `classes`, `niveaux_scolaires`, `eleves`, `inscriptions` et affectations annuelles ;
- comptes de gestion créés directement lors de l'initialisation de l'établissement ;
- rôles `directeur`, `secretaire`, `comptable` et `censeur` ;
- permissions serveur et portée par site via `AccessScope` ;
- prise en charge des types `primaire` et `college` ;
- niveaux reliés par `niveau_id`, avec `code` utilisé comme identifiant technique d'affichage/import ;
- corrections de synchronisation des identifiants de comptes dans la migration `1790611438734_identifiants_role_nom.js`.

Les anciens modèles `College`, `Class`, `college_id` et les fichiers du dossier `ref/` sont historiques. Ils ne doivent pas être utilisés pour ajouter une nouvelle fonctionnalité.

### 17.2 Module Cartes retiré

Le propriétaire a décidé le 30 octobre 2026 de recentrer le produit sur la gestion scolaire et de retirer intégralement le module Cartes du code actif.

Retrait effectué dans le code : interfaces, navigation et chargement conditionnel des dashboards, client API, endpoints Express, contrôleurs, modèles, génération de cartes et notifications dédiées.

Conservation délibérée : les migrations déjà livrées, schémas/tables/colonnes en base, lignes historiques et fichiers déjà stockés ne sont pas supprimés. Aucun flux de gestion scolaire ne doit les lire ou en dépendre. Une purge ou migration destructive exige une décision séparée.

### 17.3 Photos et signatures historiques

Les colonnes `photo_path` et `signature_path`, les objets du bucket `ads-uploads` et leurs références éventuelles sont conservés sans être utilisés par le code actif après le retrait Cartes. Ne pas supprimer ces valeurs ni les fichiers stockés sans audit et décision séparée.

### 17.4 Corrections financières validées

Deux problèmes ont été corrigés dans le modèle et les tests financiers :

- `Payment.options()` formate désormais `date_echeance` avec `TO_CHAR(..., 'YYYY-MM-DD')` afin d'éviter les décalages de date liés au fuseau UTC ;
- le test des paiements simultanés restaure son tarif de test avant exécution, car le test précédent modifiait volontairement le même tarif en deux tranches ;
- Vitest utilise `fileParallelism: false` pour éviter les collisions entre fixtures PostgreSQL partagées.

Validation actuelle : `6` fichiers de tests, `17` tests passés, `0` échec.

### 17.5 Interfaces de gestion actuellement branchées

Présent :

- `AdminDashboard.jsx` gère l'installation, les comptes et les sites ;
- `ManagementWorkspace.jsx` fournit une navigation distincte pour les rôles secrétaire et comptable :
  - secrétaire : tableau de bord, classes et élèves, capacité des classes, profil, sécurité et assistance ;
  - comptable : tableau de bord, inscriptions, frais et tarifs, caisse, historique des paiements, échéances dépassées, profil, sécurité et assistance ;
- `ManagementDashboard.jsx` charge les données adaptées au rôle et relie les actions aux API modernes : création/modification des classes et transferts côté secrétaire, inscriptions/réinscriptions et opérations financières côté comptable ;
- `DirectorWorkspace.jsx` expose au directeur le tableau de bord, les archives en lecture seule, la recherche d'élèves par site, le profil, la sécurité et l'assistance ;
- `DirectorCockpit.jsx` affiche la synthèse multisite, les effectifs, les classes actives et la configuration de l'année scolaire ;
- `SchoolYearPanel.jsx` fournit au directeur la préparation, l'activation, la clôture et la consultation des archives de classes/élèves ;
- les dashboards de gestion ne chargent plus l'état ou les endpoints de l'ancien module Cartes ;
- les fonctions scolaires et financières continuent d'utiliser leurs routes, modèles et données existants.

Le dossier `ref/` reste uniquement une source de comportement et de mise en page. Il ne doit pas être importé directement dans l'application.

### 17.6 Travaux de validation restants

Après le retrait du module Cartes, vérifier le chargement et les parcours des quatre espaces de gestion ainsi que les flux de création de site, élèves, inscriptions, finances et pédagogie. Les validations de build et tests doivent être distinguées d'une vérification en environnement réel.

### 17.7 Vision future — préparation parallèle des années scolaires et archives

Cette évolution est une vision fonctionnelle à traiter dans un chantier dédié, et ne constitue pas une correction immédiate.

Le directeur doit pouvoir saisir la date de début d'une année scolaire et recevoir automatiquement une date de fin calculée à `date_debut + 9 mois`, tout en pouvant la modifier avant validation.

La préparation de l'année suivante doit créer une année au statut `brouillon` sans remplacer l'année actuellement active. Les comptes de gestion autorisés doivent pouvoir choisir cette année préparatoire depuis leur propre espace et y effectuer les travaux nécessaires (par exemple préparation des classes, inscriptions ou réinscriptions), tout en continuant à consulter ou travailler dans l'année précédente selon leurs droits.

Le système devra distinguer :

- l'année active officielle de l'établissement ;
- l'année de travail sélectionnée par chaque utilisateur ;
- le statut de l'année (`brouillon`, `active`, `archivee`) ;
- les actions autorisées selon le rôle et le statut de l'année.

Lorsqu'une année est clôturée, elle doit devenir entièrement en lecture seule et rester consultable dans une section Archives. Chaque compte de gestion devra disposer d'une navigation adaptée à ses permissions pour sélectionner une année archivée et retrouver les informations de son périmètre. Les données historiques ne doivent pas être supprimées ni confondues avec les données de l'année active.

État actuel à ne pas confondre avec cette vision : la base contient déjà le statut `archivee`, la clôture transforme l'année active en année archivée, et l'espace Directeur expose une consultation limitée des classes et élèves archivés. Les espaces Secrétaire et Comptable ont maintenant des dashboards dédiés, mais leurs opérations restent branchées sur l'année active et ne proposent pas encore de contexte d'année sélectionnable ni de section Archives complète. Le Censeur reste également dépendant de l'année active.

Cette évolution nécessitera un chantier transversal : contexte d'année côté serveur, contrôle des permissions par année, remplacement progressif des requêtes dépendant implicitement de `statut = 'active'`, préparation contrôlée des structures et réinscriptions, clôture transactionnelle, interfaces par rôle et tests de non-écriture dans les archives.

### 17.8 Migrations et vérifications réalisées

Commandes validées :

```text
npm.cmd run migrate -- up --check-order --dry-run
→ No migrations to run! après application

npm.cmd run migrate -- up --check-order --single-transaction
→ migrations appliquées avec succès

npm.cmd test
→ 6 fichiers, 17 tests passés
```

Ne jamais appliquer une migration destructive sans vérifier la cible, le backup et le contenu réel de la base. La migration historique `1790339258594_remodelage-db.js` a été neutralisée : son `up` et son `down` sont vides dans le checkout actuel. Les migrations historiques précédentes restent conservées pour l'ordre de `node-pg-migrate`, mais ne constituent pas encore le futur point de départ VPS consolidé.

### 17.9 Évolutions récentes — secrétariat et comptabilité

**Dashboards de gestion :**

- la navigation et les intitulés sont maintenant adaptés au rôle dans `ManagementWorkspace` ;
- le dashboard Directeur est séparé dans `DirectorWorkspace` et comprend les archives en lecture seule ainsi qu'une recherche d'élèves par site ;
- le dashboard Secrétaire regroupe la gestion des classes et élèves, les capacités de classes, les transferts, le profil et la sécurité ;
- le dashboard Comptable regroupe les inscriptions/réinscriptions, frais et tarifs, caisse, historique des paiements et échéances dépassées ;
- les données sont rafraîchies selon le rôle dans `ManagementDashboard`, avec des appels séparés aux API Direction, Secrétariat et Comptabilité ;
- cette description constate le branchement présent dans le code. Les validations fonctionnelles navigateur et les tests ciblés restent à exécuter séparément.

**Secrétariat — recherche des classes :**

- la recherche côté interface s'appuie désormais sur la liste de classes déjà chargée plutôt que d'envoyer une requête serveur à chaque saisie ;
- les accents et la casse sont normalisés ; les codes de niveaux, libellés, divisions et certaines recherches par nom de site sont pris en compte ;
- le backend a également ajusté sa recherche de classes/site ;
- le bug de recherche `CI` est résolu : la comparaison utilisait le nom complet composé de la classe (site principal, notamment « Cité ministérielle », classe et niveau). La chaîne recherchée `CI` se retrouvait ainsi dans le texte d'un champ composé et produisait une correspondance erronée. Ne pas réintroduire cette comparaison globale sur le libellé complet ; rechercher sur les champs pertinents (code/niveau, division ou site selon le terme) afin d'éviter les faux positifs.

**Comptabilité — échéances dépassées :**

- la synthèse présente les retards par classe, puis charge les échéances de la classe par pages (cinq éléments par défaut, limite serveur de cinquante) ;
- une recherche peut être appliquée aux résultats paginés et une classe peut être exportée en fichier Excel ;
- les nouveaux endpoints d'affichage et d'export sont protégés par la permission `caisse.gerer` et utilisent la portée de site du compte ;
- le changement est visible dans `OverdueInstallments`, `comptabiliteController`, `comptabiliteRoutes` et `FinanceOverview`.

**Comptabilité — recherche d'élève pour encaissement, optimisation reportée :**

- `GET /comptabilite/paiements/options` est utilisé par la caisse, pas par la section « Échéances dépassées » ; il charge les élèves et leurs obligations, puis le navigateur filtre localement les résultats.
- Un export HAR local du 30 octobre 2026 a indiqué environ 22,9 s pour cet appel. Cette mesure provient du navigateur en développement, dans une capture avec plusieurs actions et réponses `304` ; elle indique une piste prioritaire, mais ne constitue pas une mesure serveur isolée.
- Le chargement en bloc et la réconciliation idempotente des tranches tarifaires augmentent le coût de cet appel. La réconciliation assure que les obligations de l'inscription sélectionnée reflètent la configuration tarifaire active.
- Une recherche serveur limitée et le chargement des obligations uniquement après sélection ont été envisagés, mais reportés par prudence : ce chantier touche le parcours d'encaissement et peut affecter la recherche dans tout l'établissement, l'isolation par site, les soldes affichés et l'enregistrement des paiements.
- Ne pas commencer cette refonte comme une optimisation mineure. Pour la reprendre, examiner `Payment.options`, `Payment.create`, contrôleur/routes comptables, formulaire caisse et tests `backend/tests/models/payment.test.js`. Préserver la portée de site, la réconciliation nécessaire, les frais obligatoires, les soldes restants et les contrôles transactionnels/concurrence de `Payment.create` ; mesurer et valider avant/après.
- Les index proposés pour les échéances dépassées sont une modification distincte de cette recherche de paiement.

**Disponibilité des services :**

- le pool PostgreSQL a été réduit et ses délais d'inactivité/keep-alive ajustés ;
- les erreurs transitoires ne déclenchent des tentatives supplémentaires que pour les requêtes identifiées comme lectures (`SELECT`/`WITH`), pas pour les écritures ;
- les erreurs d'indisponibilité de la base sont centralisées et renvoient HTTP 503 avec `Retry-After` ; le client attend désormais jusqu'à 30 secondes et affiche un message temporaire pour les erreurs réseau/503.

Ces évolutions sont observées dans le code actuel mais ne sont pas déclarées validées par une nouvelle campagne de tests dans cette mise à jour du contexte. Vérifier les parcours secrétaire/comptable et les tests ciblés avant de considérer les changements comme stabilisés.

### 17.10 Préparation de la migration hors Render/Vercel/Supabase

Le déploiement futur sur VPS nécessitera un point de départ de schéma consolidé. La stratégie retenue est de préparer une nouvelle migration de référence, nommée provisoirement `point_de_depart`, qui recréera la structure moderne actuelle dans le bon état final au lieu de rejouer toutes les migrations historiques.

Avant de créer cette migration :

- vérifier le schéma réel de la base actuelle et l'ordre des migrations appliquées ;
- séparer la reconstruction du schéma et l'import des données existantes ;
- vérifier les données de référence, contraintes, index, permissions et éventuels triggers ;
- tester la migration sur une base PostgreSQL vide ;
- comparer la structure obtenue avec la base actuelle ;
- traiter séparément le remplacement de Supabase Storage pour les photos et signatures.

Le dépôt actuel ne contient plus de cron d'expiration de clés. Les références restantes à `access_keys`, `payments_kkiapay` et aux emails d'expiration sont historiques dans les anciennes migrations ou dans une documentation à mettre à jour ; elles ne doivent pas être reprises dans `point_de_depart`.
