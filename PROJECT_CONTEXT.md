# Contexte durable du projet — AGS-Solution / FVS Cartes

> Dernière mise à jour : 23 septembre 2026
> Usage : lire ce fichier au début de chaque nouvelle discussion liée au projet.
> Il reflète l’état réel du code et les évolutions récentes du projet.

## 1. État réel du projet

Le projet est désormais centré sur une application de gestion scolaire mono-établissement, avec un site principal créé automatiquement, des espaces séparés par rôle métier, et un backend/frontend fonctionnels reliés à l’API.

Les dernières évolutions visibles dans le code sont les suivantes :

- le backend expose des routes dédiées à l’authentification, la platforme, la direction, le secrétariat, la comptabilité, le censeur et l’assistance ;
- le frontend centralise la navigation et les protections d’accès par rôle dans [frontend/src/App.jsx](frontend/src/App.jsx) ;
- l’espace de gestion est regroupé dans [frontend/src/pages/ManagementDashboard.jsx](frontend/src/pages/ManagementDashboard.jsx) et [frontend/src/pages/ManagementWorkspace.jsx](frontend/src/pages/ManagementWorkspace.jsx) ;
- les rôles directeur, secrétaire, comptable et censeur disposent chacun d’un espace cohérent avec des écrans dédiés ;
- la marque et le nom de la plateforme sont centralisés dans [backend/src/config/branding.js](backend/src/config/branding.js).

## 2. Décisions et évolutions validées dans le code

### 2.1 Architecture générale

- AGS-Solution est une application mono-établissement : une installation, une base de données, un établissement principal et des sites optionnels.
- Le nom de plateforme est actuellement `AGS-Solution` via `PLATFORM_NAME`.
- FVS Cartes reste un service distinct, avec son identité propre dans les fonctions liées aux cartes.
- Les comptes techniques FVS et les comptes gestion sont séparés.

### 2.2 Comptes et rôles

Les rôles déjà présents dans le code et dans l’interface sont :

- directeur,
- secrétaire,
- comptable,
- censeur,
- administrateur FVS.

Les comptes de gestion utilisent les tables `users` / `sessions_gestion`, tandis que les comptes techniques FVS utilisent `admins` / `sessions_admin`.

### 2.3 Profil et sécurité

- Le profil utilisateur est consultable et modifiable depuis le frontend.
- Les informations modifiables incluent : nom, prénom, email et téléphone.
- Un utilisateur peut changer son mot de passe depuis l’espace de sécurité.
- Les erreurs techniques internes sont journalisées côté serveur et ne remontent pas brutement dans l’interface.

### 2.4 Flux métier actuellement connectés

1. Le directeur active la première année scolaire.
2. La secrétaire crée les classes annuelles.
3. Le comptable enregistre une inscription ou une réinscription.
4. La secrétaire ouvre une classe, consulte les élèves, modifie leurs données et peut effectuer un transfert interne entre classes et sites.
5. Le censeur consulte les mêmes classes et élèves en lecture seule.
6. Les actions sont rafraîchies immédiatement dans l’interface sans rechargement manuel.

### 2.5 Modules déjà présents

- Authentification admin et gestion : login, OTP, mot de passe oublié, réinitialisation.
- Espace directeur : cockpit, activation de l’année scolaire, visualisation des classes et des sites.
- Espace secrétaire : registre des classes, gestion des élèves, effectifs, transferts.
- Espace comptable : inscriptions, import Excel, configuration financière, paiements, caisse.
- Espace censeur : consultation des classes, effectifs et données pédagogiques.
- Espace de profil et sécurité : modification des infos personnelles et des accès de sécurité.

## 3. Finances et abonnements

La configuration financière est déjà codée dans le frontend et la logique associée est visible dans plusieurs composants :

- frais généraux,
- tarifs par classe,
- tranches de paiement,
- échéances,
- règles de nivellement / application à tout un niveau,
- visualisation de la configuration active.

Le code montre aussi que les flux suivants sont déjà envisagés / branchés :

- création d’inscriptions,
- création de paiements,
- aperçu de la caisse,
- historique de paiements,
- configuration des coûts liés à l’année active.

## 4. Points validés par le code

- AGS-Solution est bien un produit mono-établissement.
- Les comptes FVS et les comptes gestion sont distincts.
- Les sites sont conçus comme un cas particulier de multi-campus / filiales d’un même établissement.
- Le nom et la marque sont centralisés dans le code pour éviter les divergences.
- Les espaces par rôle sont bien structurés dans l’application.
- Les imports Excel et les tableaux de gestion sont déjà intégrés dans l’interface.

## 5. Points encore à valider / non finalisés

- validation manuelle des interfaces sur desktop et mobile,
- vérification fonctionnelle par rôle avec des comptes réels,
- validation du parcours financier complet en conditions réelles,
- gestion avancée des renvois, abandons et mouvements complexes,
- gestion détaillée des professeurs et matières côté censeur,
- finalisation d’éventuels modules financiers plus avancés selon le besoin métier.

## 6. Stack technique actuelle

### Backend

- Node.js,
- Express,
- PostgreSQL via Supabase,
- JWT pour l’authentification,
- stockage d’upload et fichiers via Supabase / dossier local `uploads`.

### Frontend

- React 18,
- Vite,
- Tailwind CSS,
- Axios,
- React Router,
- `pdf-lib` pour les composants PDF / génération document.

### Hébergement

- Frontend : Vercel,
- Backend : Render,
- base de données : Supabase.

## 7. Structure actuelle du projet

```text
projet/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── utils/
│   ├── migrations/
│   ├── tests/
│   ├── uploads/
│   ├── Schema.md
│   ├── package.json
│   └── vitest.config.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── config/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── vercel.json
├── PROJECT_CONTEXT.md
├── skills-lock.json
└── fichiers de config / scripts spécifiques au dépôt
```

## 8. Fichiers majeurs récents

- [backend/src/index.js](backend/src/index.js) : point d’entrée du backend, routes et healthcheck.
- [backend/src/config/branding.js](backend/src/config/branding.js) : marque et nom de la plateforme.
- [frontend/src/App.jsx](frontend/src/App.jsx) : routage global et protection par rôle.
- [frontend/src/pages/ManagementDashboard.jsx](frontend/src/pages/ManagementDashboard.jsx) : orchestration des espaces de gestion et flux métier.
- [frontend/src/pages/ManagementWorkspace.jsx](frontend/src/pages/ManagementWorkspace.jsx) : navigation et contenu par rôle.
- [frontend/src/pages/StudentImportPanel.jsx](frontend/src/pages/StudentImportPanel.jsx) : import Excel et préparation des données.
- [frontend/src/pages/DirectorCockpit.jsx](frontend/src/pages/DirectorCockpit.jsx) : synthèse administrative du directeur.
- [frontend/src/pages/FinanceOverview.jsx](frontend/src/pages/FinanceOverview.jsx) : overview finance, historique et échéances.

## 9. Règles de travail à garder en tête

- ne modifier aucun fichier ou schéma sans demande explicite de Vladimir ;
- vérifier l’état réel du code avant d’inférer une fonctionnalité ou une architecture ;
- conserver un projet simple, lisible et maintenable par une seule personne ;
- garder ce document à jour à chaque changement d’architecture ou de périmètre fonctionnel majeur.

Ce document doit être considéré comme le point de référence actuel du projet, avec l’état réellement codé dans le dépôt.
