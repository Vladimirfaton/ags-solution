# Contexte durable du projet — AGS-Solution / FVS Cartes

> **Dernière mise à jour :** 19 septembre 2026  
> **Usage :** lire ce fichier au début de toute nouvelle discussion liée au projet.
> Il résume les décisions produit et techniques confirmées. Il ne remplace pas
> une demande explicite de modification de code.

## Mise à jour d’implémentation — 19 septembre 2026

### État de validation de l’interface

> **Important : toutes les interfaces ne sont pas encore validées.** Les
> corrections ci-dessous sont compilées, mais doivent encore être vérifiées
> dans le navigateur avec des comptes réels pour chaque rôle et sur desktop et
> mobile.

### Corrections frontend réalisées

- L’espace profil est maintenant disponible pour les comptes directeur,
  secrétaire, comptable et censeur : consultation en lecture seule, bouton de
  modification, enregistrement des nom, prénom, email et téléphone.
- La cause de l’erreur React du profil a été corrigée : le composant `Profile`
  était utilisé mais absent de `frontend/src/pages/ManagementDashboard.jsx`.
- La barre de navigation mobile dédiée a été retirée. L’en-tête est compact et
  tient les informations principales sur une seule ligne ; la navigation desktop
  reste disponible dans la barre latérale.
- Le tableau des élèves a été resserré, conserve les informations sur une ligne
  et affiche de nouveau le téléphone parent/tuteur. Une règle CSS masquait
  précédemment la colonne du téléphone.
- L’affichage des classes de la secrétaire et du censeur utilise désormais une
  liste compacte de type registre scolaire : classe, établissement, effectif et
  accès à la consultation.
- Le tableau de bord conserve une vue des classes en lecture simple ; la gestion
  détaillée reste dans « Classes et élèves ».
- Le champ d’import Excel du comptable utilise explicitement le curseur
  `pointer` pour signaler qu’il est sélectionnable.
- Plusieurs libellés corrompus visibles dans les vues principales ont été
  corrigés.

### Contrôles effectués

- `frontend`: `npm run build` réussit avec Vite.
- Les diagnostics VS Code ne signalent pas d’erreur JavaScript/React dans les
  fichiers corrigés.
- `npm run lint` n’a pas pu être exécuté car `eslint` n’est pas disponible dans
  l’installation actuelle.
- Les parcours fonctionnels et l’affichage de toutes les interfaces restent à
  tester manuellement avec les quatre rôles, plusieurs tailles d’écran et des
  données réelles.

### Décisions devenues effectives dans le code

- AGS-Solution est désormais une application **mono-établissement** : une base
  par établissement ; un site principal est créé automatiquement. Les sites
  supplémentaires restent prévus par le schéma pour les filiales.
- Le nom de la plateforme est centralisé dans les fichiers de configuration de
  marque (`PLATFORM_NAME`), actuellement `AGS-Solution`.
- Les clés d’accès, leur expiration et KKiaPay ont été retirés du flux de la
  gestion scolaire. Ils ne doivent pas être réintroduits sans décision produit.
- Les comptes techniques FVS et les comptes de gestion sont séparés : tables
  `admins` / `sessions_admin` pour FVS, `users` / `sessions_gestion` pour
  directeur, secrétaire, comptable et censeur.
- L’installation crée directement les quatre comptes de gestion. Il n’y a plus
  d’activation par email. Le mot de passe initial peut être changé mais n’est
  pas imposé. L’email personnel est renseigné dans le profil et sert aux
  réinitialisations.
- Les informations personnelles sont consultées en lecture seule puis éditées
  par un bouton « Modifier ». Après nom et prénom, l’identifiant est généré à
  partir du rôle (ex. `Cens-Ffunmilayo`) ; il reste unique.
- Les erreurs techniques du serveur ne sont plus affichées telles quelles dans
  l’interface : le backend journalise le détail et le frontend affiche un
  message sûr.

### Flux métier déjà relié

1. Le directeur active la première année scolaire manuellement.
2. La secrétaire crée les classes annuelles.
3. Le comptable enregistre une nouvelle inscription (création de l’élève et
   de son inscription dans une classe) ou une réinscription d’un élève déjà
   présent dans le registre.
4. La secrétaire ouvre une classe, consulte les élèves qui y sont affectés,
   modifie leurs informations et peut les transférer vers une autre classe,
   y compris sur un autre site existant. Aucune suppression d’élève n’existe.
5. Le censeur consulte les mêmes classes et fiches en lecture seule.
6. Les actions rafraîchissent les données affichées immédiatement, sans
   rechargement manuel de la page.

### Interfaces déjà réalisées

- Une interface avec menu et page d’accueil par rôle : directeur, secrétaire,
  comptable et censeur.
- La secrétaire et le censeur disposent d’un registre compact de classes. Cliquer
  sur une classe ouvre la liste de ses élèves.
- Le directeur dispose d’un tableau de bord de pilotage et d’une vue de classes
  consultable sans édition directe.
- Le comptable dispose des écrans d’inscription/réinscription, d’import Excel,
  de configuration financière et de caisse.
- Les paiements élèves, reçus internes et rafraîchissements après opération sont
  reliés dans le frontend et le backend, mais restent à valider en conditions
  réelles.

### Reste à réaliser avant un flux financier complet

- Configuration des frais généraux, tarifs de classe et tranches.
- Création automatique des obligations financières lors d’une inscription.
- Encaissement, répartition sûre d’un paiement sur les tranches, monnaie à
  rendre, reçus, historique et demandes de correction à faire approuver par
  le directeur.
- Caisse détaillée, totaux par moyen de paiement et statistiques.
- Gestion complète des sites, professeurs affectés aux classes, puis vue de
  ces professeurs pour le censeur.
- Gestion des renvois, abandons et autres mouvements ; le transfert interne
  entre classes/sites est la première opération déjà disponible.

## 1. Règle de travail

- Ne modifier aucun fichier ou schéma sans demande explicite de Vladimir.
- Avant toute modification structurelle, lire les fichiers réellement concernés
  et ne jamais déduire l'état actuel du code sans vérification.
- Préférer des réponses brèves et opérationnelles.
- Le projet est maintenu principalement par Vladimir : éviter une architecture
  inutilement complexe ou des dépendances difficiles à administrer seul.

## 2. État actuel de l'application

### Stack et hébergement

- Backend : Node.js, Express, PostgreSQL sur Supabase.
- Frontend : React 18, Vite, Tailwind, `pdf-lib`.
- Photos et signatures : Supabase Storage.
- Frontend : Vercel.
- Backend : Render gratuit. Le serveur se met en veille après 15 minutes sans
  trafic ; cette contrainte est acceptable temporairement.

### Structure actuelle du projet

```text
projet/
├── backend/
│   ├── migrations/              Migrations PostgreSQL et évolution du schéma
│   ├── src/
│   │   ├── config/              Base, marque, logs, stockage et environnement
│   │   ├── controllers/         Logique HTTP par domaine métier
│   │   ├── middleware/          Authentification, erreurs et limitation de débit
│   │   ├── models/               Accès aux données et règles de persistance
│   │   ├── routes/               Routes Express par rôle et fonctionnalité
│   │   └── utils/                Utilitaires backend et installation
│   ├── tests/                   Tests Vitest backend
│   ├── uploads/                 Fichiers Excel, photos et signatures locales
│   ├── Schema.md                Documentation du schéma de données
│   └── package.json
├── frontend/
│   ├── public/                  Ressources statiques
│   ├── src/
│   │   ├── components/          Composants partagés de l’interface
│   │   ├── config/              Configuration de marque
│   │   ├── pages/               Écrans admin, gestion et import élèves
│   │   ├── services/             Client API Axios
│   │   ├── utils/                Recherche, PDF et utilitaires frontend
│   │   ├── App.jsx              Routes et protection des espaces
│   │   ├── index.css             Tailwind et styles globaux
│   │   └── main.jsx              Point d’entrée React
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── PROJECT_CONTEXT.md            Ce contexte durable
├── AGENTS.md                     Consignes de collaboration du dépôt
├── opencode.json                 Configuration d’outillage
└── skills-lock.json              Versions des skills du projet
```

### Fichiers frontend récemment concernés

- `frontend/src/pages/ManagementDashboard.jsx` : orchestration des espaces,
  profil, classes, élèves, inscriptions et caisse.
- `frontend/src/pages/ManagementWorkspace.jsx` : shell des espaces secrétaire,
  comptable et censeur.
- `frontend/src/pages/StudentImportPanel.jsx` : sélection, prévisualisation et
  confirmation des imports Excel.
- `frontend/src/index.css` : primitives Tailwind, champs et styles globaux.
- `frontend/src/utils/searchUtils.js` : recherche normalisée des classes et
  élèves.

### Cartes d'identité

- Le service Cartes est considéré comme **clôturé et validé**.
- **FVS Cartes** est l'outil interne FVS qui produit les cartes finales.
- La plateforme principale **AGS-Solution** reste dédiée à la gestion de
  l'établissement. Si le service Cartes est souscrit, une section brouillons et
  demandes y est activée ; FVS Cartes produit les cartes finales.
- Le rendu PDF et l'aperçu `RectoPreview` sont validés.
- L'impression `a4` est destinée aux imprimantes A4 ; l'impression `pvc` est
  exclusivement destinée aux imprimantes à cartes PVC.
- Les cartes finales sont générées par l'administrateur FVS uniquement.
- Un établissement ayant le module Cartes peut consulter et télécharger les
  brouillons, mais ne génère pas les cartes finales.
- Le service Cartes pourra être activé seul, avec ou sans la gestion scolaire.

### Ancienne logique commerciale FVS

- Les clés d'accès, expirations, réactivations et KKiaPay ont été retirés du
  code de cette installation. Aucun paiement du service FVS n’est géré dans le
  périmètre actuel.

## 3. Vision produit validée

La future plateforme s'appelle **AGS-Solution** (« Application de Gestion
Scolaire »). Elle est conçue comme une solution de gestion scolaire
**mono-établissement** : une installation et une base de données par établissement.
FVS Cartes est un outil interne distinct de production de cartes.

Chaque établissement peut activer trois combinaisons de services :

1. Cartes uniquement ;
2. Gestion scolaire uniquement ;
3. Cartes et gestion scolaire.

Chaque déploiement contient les données d'un seul établissement. Un serveur sera
prévu pour héberger les installations. Cette décision simplifie l'isolation des
données ; elle implique d'automatiser plus tard les déploiements et mises à jour.

## 4. Établissements et sites

- Le terme cible est `etablissement` ; il remplace l'actuelle notion de `college`.
- Un établissement possède au moins un site, même s'il n'a pas de filiale : un
  « site principal » est alors créé.
- Les sites sont un cas particulier utile lorsqu'un même établissement possède
  plusieurs campus ou filiales.
- Chaque site possède ses propres classes, élèves, inscriptions, utilisateurs,
  paiements et statistiques.
- Le directeur voit tous les sites de son établissement et peut basculer entre eux.
- Les autres comptes travaillent normalement sur un seul site.
- La notion d'établissement n'est plus nécessaire comme filtre fonctionnel dans
  chaque requête : une installation ne contient qu'un seul établissement.

## 5. Utilisateurs, accès et sécurité

### Désignations prévues

- Directeur ;
- Secrétaire ;
- Comptable ;
- Censeur ;
- Administrateur FVS.

Les rôles actuellement codés sont volontairement fixes : le comptable réalise
les inscriptions et réinscriptions ; la secrétaire crée les classes et gère les
fiches élèves ; le censeur consulte ; le directeur pilote l’année scolaire.

### Gestion des permissions

- Les fonctionnalités sont définies indépendamment des rôles : consulter un élève,
  modifier un élève, voir une photo, inscrire, réinscrire, recevoir un paiement,
  consulter un brouillon, etc.
- L'administrateur FVS prépare les comptes et permissions initiales.
- Lors de la mise en service, le directeur consulte les accès de chaque utilisateur
  et les confirme.
- Le directeur ne crée pas, ne supprime pas et ne modifie pas directement les
  permissions.
- Toute demande d'ajout/retrait de permission passe par l'assistance, avec une
  demande formelle, email et appel de validation ; FVS applique le changement.
- Les photos élèves sont accessibles seulement au directeur et à la secrétaire.

### Sessions simultanées

| Compte | Sessions actives autorisées |
|---|---:|
| Directeur | 1 |
| Secrétaire | 1 |
| Comptable | 1 |
| Censeur | 1 |
| Administrateur FVS | 2 |

Une nouvelle connexion au-delà de cette limite ferme la session la plus ancienne.
Cette règle nécessitera des sessions stockées côté serveur ; le JWT seul ne suffit
pas à déconnecter de façon fiable un autre appareil.

## 6. Années scolaires, classes et élèves

### Année scolaire

- Toute opération de gestion est rattachée à une année scolaire.
- La première année scolaire est créée manuellement lors du déploiement d'un
  établissement.
- Une seule année est active par établissement ; elle est affichée automatiquement
  dans les interfaces.
- Une nouvelle année n'est jamais créée ou activée automatiquement.
- Le directeur démarre la nouvelle année, vérifie sa configuration et la confirme.
- La configuration de l'année précédente est copiée comme brouillon : classes,
  groupes/séries, tarifs, frais et tranches.
- Les anciennes années restent consultables.
- Aucun élève n'est inscrit automatiquement dans une nouvelle année : chaque
  inscription doit être faite explicitement.

### Classes

- Le terme fonctionnel retenu est « classe », pas « niveau ».
- Une classe de référence est durable : 6e, 5e, 1re, Terminale, CM2, etc.
- Une classe ouverte est une classe réellement utilisée sur un site et une année,
  par exemple `6e B — Site principal — 2026-2027`.
- En cycle 1, une division est habituellement un groupe ; en second cycle, une
  division est une série.
- Le primaire garde une configuration libre selon l'établissement.

### Élèves et inscriptions

- La fiche de l'élève est durable et son matricule est unique au niveau national.
- Le matricule est importé pour les élèves existants et saisi pour les nouvelles
  inscriptions ; il est défini par un système externe.
- L'élève conserve son matricule en cas de transfert.
- Aucun élève n'est supprimé. La secrétaire peut mettre à jour ses informations
  lorsque nécessaire.
- Une inscription annuelle relie l'élève à un établissement, une année et une
  classe ouverte.
- Un élève ne possède qu'une inscription par établissement et année scolaire.
- Un élève sans historique dans l'établissement est inscrit ; un ancien élève est
  toujours réinscrit, même s'il avait quitté l'établissement avant son retour.
- Le redoublement est normal : plusieurs inscriptions peuvent pointer vers la même
  classe sur des années différentes.

### Sorties et transferts

- Les statuts d'inscription prévus sont : active, terminée, transférée, renvoyée,
  abandonnée.
- Les départs, renvois et transferts changent le statut de l'inscription ; ils ne
  suppriment ni l'élève ni son historique.
- Chaque mouvement conserve au minimum une date, un motif et l'utilisateur qui
  l'a déclaré.
- Un transfert interne conserve l'historique des classes/sites successifs.
- Un transfert vers une école externe est seulement répertorié : FVS ne remplace
  pas la procédure administrative officielle de transfert de l'établissement.

## 7. Flux d'inscription, réinscription et finance

### Flux général

1. Le comptable recherche l'élève par matricule ou crée sa fiche personnelle.
2. Il choisit l'année active, le site et la classe ouverte.
3. Le système détermine s'il s'agit d'une inscription ou réinscription.
4. Il affiche les frais et tranches configurés par l'établissement.
5. Le comptable choisit ce que le parent règle et enregistre le paiement.
6. L'inscription et son historique sont enregistrés pour l'année concernée.

### Frais et tarifs

- Toutes les classes ont un coût de scolarité.
- Chaque établissement décide librement de ses tarifs par site, classe, groupe ou
  série, ainsi que du nombre et du montant des tranches.
- Trois tranches est le cas habituel, mais le nombre est configurable.
- Les frais généraux sont configurables : inscription/réinscription, carte,
  assurance, autres frais propres à l'établissement.
- Certains établissements demandent des frais généraux et la première tranche à
  l'inscription ; d'autres appliquent une règle différente. La règle doit être
  configurable par établissement.
- Le tarif applicable est copié et figé sur l'inscription. Modifier un tarif en
  cours d'année ne concerne que les nouvelles inscriptions, jamais les anciens
  élèves déjà inscrits.

### Paiements élèves

- Les modes initiaux sont espèces, Mobile Money et banque.
- Un paiement concerne toujours un seul élève. Un parent payant pour plusieurs
  enfants crée plusieurs opérations séparées.
- Le comptable choisit les frais et/ou tranches que le parent souhaite régler.
- Un paiement peut couvrir tout ou partie d'une tranche, plusieurs tranches, ou
  les frais généraux et la scolarité en une seule opération.
- Le système ne doit jamais produire un montant négatif.
- Pour les espèces, il distingue montant remis, montant réellement encaissé et
  monnaie rendue. Pour Mobile Money et banque, un montant supérieur au dû est
  bloqué.
- Les tranches possèdent une date limite mais restent payables après échéance.
- Le futur module parents enverra des rappels avant et après ces échéances.
- Le statut de chaque frais/tranche est calculé : non payé, partiel ou payé.
- Le statut global de l'inscription est calculé : non soldé ou soldé.

### Traçabilité, corrections et caisse

- Chaque paiement conserve un numéro, montant, moyen de paiement, référence,
  date/heure et comptable ayant reçu l'argent.
- Le reçu produit par la plateforme est une trace interne ; il ne remplace pas le
  reçu officiel délivré par l'établissement.
- Un paiement confirmé n'est jamais modifié ni supprimé.
- En cas d'erreur, le comptable soumet une demande avec justificatif ; le directeur
  approuve ou refuse ; une opération de correction est créée en gardant l'historique.
- La première version de caisse suit seulement les encaissements élèves : totaux
  journaliers, par période, par site, comptable et moyen de paiement.
- Les dépenses, sorties de caisse, remboursements et avoirs sont une extension
  future ; elles ne doivent pas être mélangées aux encaissements élèves initiaux.

## 8. Performance et évolutivité

- Quelques milliers d'élèves ne posent pas de problème particulier à PostgreSQL.
- Les listes doivent être paginées, par exemple 25 ou 50 élèves à la fois.
- La recherche doit filtrer par matricule, nom, classe, site et année scolaire.
- Les photos restent dans Supabase Storage et sont chargées uniquement lorsque
  nécessaire ; ne jamais afficher 500 photos simultanément.
- Les imports Excel doivent être validés puis exécutés par lots, jamais ligne par
  ligne avec une requête par élève.
- Les cartes se génèrent par classe ou sélection, jamais pour tous les élèves de
  tous les établissements simultanément.
- Préférer un monolithe modulaire à des microservices pour le moment : une base,
  un backend, des modules fonctionnels séparés.

## 9. Extensions prévues, mais hors de la première version SIS

### Application enseignants

- Saisie des notes depuis la classe ;
- marquage des présences ;
- suivi de l'évolution des cours ;
- autres outils pédagogiques à préciser.

### Application parents

- Consultation des performances de leurs enfants ;
- notes, présences, bulletins ;
- rappels de scolarité non soldée ;
- notifications de l'administration.

Ces extensions ne doivent pas être développées maintenant, mais le noyau actuel
doit préserver les notions d'année, classe ouverte, inscription, utilisateur,
paiement et notification afin de pouvoir les accueillir plus tard.

## 10. Décisions encore en attente

1. Nouveau modèle de paiement du service FVS par les établissements, s'il existe.
2. Liste précise des frais généraux proposés par défaut et règle minimale de
   paiement autorisant une inscription.
3. Ordre exact et ergonomie de sélection des frais/tranches dans le formulaire.
4. Contenu du reçu interne FVS et statistiques exactes attendues pour la caisse.
5. Détail final des permissions par rôle et site.
6. Règles détaillées du primaire avec les futurs utilisateurs métier.
7. Rappels parentaux : canaux, calendrier et contenu.
8. Gestion future des dépenses et sorties de caisse.
9. Hébergement de production futur : Render reste en place pour le moment ; une
    offre payante ou Oracle Cloud pourra être étudiée lorsque le besoin sera réel.

## 11. Artefacts existants à lire

- `docs/proposition-sis/README.md` : explication technique du schéma SIS proposé.
- `docs/proposition-sis/00_transition_etablissement.proposed.js` : transition
  proposée de `colleges` vers `etablissements`.
- `docs/proposition-sis/01_organisation_acces.proposed.js` : sites, modules,
  accès, permissions et sessions.
- `docs/proposition-sis/02_structure_scolaire.proposed.js` : années, cycles et
  classes ouvertes.
- `docs/proposition-sis/03_eleves_inscriptions.proposed.js` : élèves,
  inscriptions et mouvements.
- `docs/proposition-sis/04_finances.proposed.js` : tarifs, tranches, paiements
  et corrections.

Ces documents restent utiles comme explication historique. La migration réelle
consolidée a été créée et appliquée dans `backend/migrations/1788864000000_ags_solution_mono_etablissement.js`, avec ses migrations complémentaires.

## 12. Phases recommandées

### Phases réalisées ou en cours

- Fondations mono-établissement, comptes, année scolaire, classes, élèves,
  inscriptions/réinscriptions et transfert interne : réalisés en première
  version et à tester en conditions réelles.

### Phase suivante — Finance administrative

- Construire tarifs, frais généraux, tranches et obligations financières.
- Construire les paiements, monnaie sur espèces, traçabilité, corrections validées
  par le directeur et statistiques d'encaissement.

### Phase 6 — Permissions et sessions

- Mettre en place les profils, permissions, demandes à l'assistance et historique.
- Mettre en place les limites de sessions simultanées.

### Phase 7 — Intégration Cartes et optimisation

- Raccorder le module Cartes aux inscriptions et classes ouvertes.
- Ajouter pagination, recherche, chargement différé des photos et génération par
  lots.

### Phase 8 — Extensions futures

- Module enseignants : notes, présences, cours.
- Module parents : consultation, rappels, bulletins et notifications.
- Caisse générale : dépenses et sorties, si le besoin est confirmé.

---

**Instruction de reprise :** avant toute action, lire ce fichier et demander une
confirmation lorsque la demande implique une décision métier non validée ou une
modification structurelle de la base de données.
