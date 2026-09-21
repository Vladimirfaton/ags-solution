# SCHEMA.md — Base de données FVS

> **Règle d'or** : ce fichier doit être mis à jour à chaque nouvelle migration.
> Une migration qui change le schéma sans mise à jour de ce fichier est incomplète.

**Dernière synchronisation avec la DB réelle :** 26 août 2026 (vérifié via `information_schema` sur Supabase)
**Système de migrations :** `node-pg-migrate`, dossier `migrations/`, table de suivi `pgmigrations`
**Ancien système (abandonné) :** `src/utils/setupDatabase.js` — archivé, ne plus exécuter, conservé pour historique uniquement.

---

## Vue d'ensemble

FVS gère aujourd'hui des **collèges** (table `colleges` — sera renommée `etablissements` au Chantier C). Chaque collège a :
- Des **classes**, qui ont des **élèves**
- Des **comptes de gestion** (directeur/secrétaire) dans `users`, scopés par `college_id`
- Une **clé d'accès** (`access_keys`) qui conditionne l'accès à la plateforme
- Des **brouillons de cartes** et des **notifications** (brouillon prêt, cartes prêtes)
- Des **observations** laissées par le directeur/secrétaire sur une classe ou un élève

L'admin (rôle `admin` dans `users`, sans `college_id`) a une vue globale sur tous les collèges.

---

## Tables

### `users`
Comptes de la plateforme — admin (créé via `register`) OU directeur/secrétaire (créés via `createManagementAccount`, liés à un collège).

| Colonne | Type | Nullable | Défaut | Notes |
|---|---|---|---|---|
| `id` | uuid | NON | — | PK |
| `email` | varchar(255) | NON | — | UNIQUE |
| `password_hash` | varchar(255) | oui | — | NULL tant que le compte n'est pas activé |
| `role` | varchar(50) | oui | `'admin'` | `admin` \| `directeur` \| `secretaire` |
| `college_id` | uuid | oui | — | FK → `colleges(id)` ON DELETE CASCADE. NULL pour un admin |
| `username` | varchar(100) | oui | — | UNIQUE. Comparaison **sensible à la casse** au login (voir sécurité ci-dessous) |
| `nom`, `prenom` | varchar(255) | oui | — | |
| `telephone` | varchar(30) | oui | — | |
| `status` | varchar(30) | oui | `'active'` | `active` \| `pending_activation` \| `expired` |
| `created_at`, `updated_at` | timestamp | oui | `CURRENT_TIMESTAMP` | |

**Sécurité (26 août 2026)** : le login (`loginGestion`) compare le `username` saisi tel quel (trim uniquement, pas de normalisation) contre la colonne. La normalisation (`normalizeUsername`) ne s'applique qu'à la création/activation du compte, pas à la vérification — pour empêcher que `DirecteurFaton`, `directeurfaton` et `directeur faton` soient traités comme un seul et même identifiant.

---

### `colleges`
*(sera renommé `etablissements` au Chantier C, avec ajout d'un champ `type`)*

| Colonne | Type | Nullable | Défaut | Notes |
|---|---|---|---|---|
| `id` | uuid | NON | — | PK |
| `nom`, `commune`, `departement` | varchar(255) | NON | — | |
| `directeur_nom`, `directeur_prenom`, `directeur_contact` | varchar(255) | oui | — | |
| `directeur_sexe` | varchar(255) | oui | — | ⚠️ Absent de l'ancien `setupDatabase.js`, ajouté manuellement — maintenant dans la migration baseline |
| `email`, `telephone` | varchar | oui | — | |
| `signature_path` | text | oui | — | URL Supabase Storage |
| `secretaire_nom`, `secretaire_prenom`, `secretaire_telephone`, `secretaire_email` | varchar | oui | — | |
| `created_at`, `updated_at` | timestamp | oui | `CURRENT_TIMESTAMP` | |

---

### `classes`
| Colonne | Type | Nullable | Défaut | Notes |
|---|---|---|---|---|
| `id` | uuid | NON | — | PK |
| `college_id` | uuid | NON | — | FK → `colleges(id)` ON DELETE CASCADE |
| `niveau`, `serie` | varchar | NON | — | |
| `code` | varchar(80) | NON | — | |
| `created_at`, `updated_at` | timestamp | oui | `CURRENT_TIMESTAMP` | |

**Contrainte** : `UNIQUE(college_id, niveau, serie)` — nom `uniq_classe_college`.

---

### `eleves`
| Colonne | Type | Nullable | Défaut | Notes |
|---|---|---|---|---|
| `id` | uuid | NON | — | PK |
| `classe_id` | uuid | NON | — | FK → `classes(id)` ON DELETE CASCADE |
| `matricule` | varchar(50) | NON | — | UNIQUE **global** (pas juste par collège — voulu) |
| `nom`, `prenom` | varchar(255) | NON | — | |
| `sexe` | varchar(1) | oui | — | |
| `date_naissance` | date | oui | — | |
| `lieu_naissance`, `nationalite` | varchar | oui | — | |
| `telephone` | varchar(30) | oui | — | |
| `photo_path` | text | oui | — | URL Supabase Storage |
| `created_at`, `updated_at` | timestamp | oui | `CURRENT_TIMESTAMP` | |

---

### `access_keys`
| Colonne | Type | Nullable | Défaut | Notes |
|---|---|---|---|---|
| `id` | uuid | NON | — | PK |
| `college_id` | uuid | NON | — | FK → `colleges(id)` ON DELETE CASCADE |
| `key_hash` | varchar(255) | NON | — | Hash bcrypt de la clé (12 caractères en clair, jamais stocké) |
| `type` | varchar(20) | NON | `'free'` | ⚠️ Purement informatif/historique depuis le 26 août 2026 — plus de gating fonctionnel |
| `status` | varchar(20) | NON | `'pending'` | `pending` \| `active` \| `expired` |
| `issued_at` | timestamp | oui | `CURRENT_TIMESTAMP` | |
| `activated_at`, `expires_at` | timestamp | oui | — | |

**Politique de durée (26 août 2026)** :
- Essai initial : **330 jours** depuis l'inscription (calcul fixe `+330j`, pas de calage sur calendrier scolaire réel)
- Renouvellement : durée unitaire configurable via `ACCESS_KEY_UNIT_YEARS`, multiplicateurs proposés à l'établissement (ex: 3/6/9/12 ans)
- **Une seule clé par période** (pas de chaîne de clés successives) — `expires_at = date_activation + unité×multiplicateur`

---

### `otps`
Codes OTP pour le login admin (email + code à 6 chiffres).

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| `id` | uuid | NON | `gen_random_uuid()` |
| `email` | varchar(255) | NON | — |
| `code` | varchar(6) | NON | — |
| `expires_at` | timestamp | NON | — |
| `created_at` | timestamp | oui | `CURRENT_TIMESTAMP` |

---

### `brouillons_cartes`
| Colonne | Type | Nullable | Défaut | Notes |
|---|---|---|---|---|
| `id` | uuid | NON | — | PK |
| `college_id` | uuid | NON | — | FK → `colleges(id)` ON DELETE CASCADE |
| `classe_id` | uuid | NON | — | FK → `classes(id)` ON DELETE CASCADE |
| `nom_brouillon` | varchar(255) | NON | — | |
| `export_path` | text | oui | — | |
| `total_cartes` | integer | oui | — | |
| `status` | varchar(50) | oui | `'draft'` | |
| `created_at`, `updated_at` | timestamp | oui | `CURRENT_TIMESTAMP` | |

---

### `observations`
| Colonne | Type | Nullable | Défaut | Notes |
|---|---|---|---|---|
| `id` | uuid | NON | — | PK |
| `classe_id` | uuid | NON | — | FK → `classes(id)` ON DELETE CASCADE |
| `auteur_id` | uuid | NON | — | FK → `users(id)` ON DELETE CASCADE |
| `auteur_role` | varchar(50) | NON | — | |
| `contenu` | text | NON | — | |
| `eleve_id` | uuid | oui | — | FK → `eleves(id)` ON DELETE SET NULL |
| `lu_par_admin` | boolean | oui | `false` | |
| `created_at` | timestamp | oui | `CURRENT_TIMESTAMP` | |

---

### `notifications_brouillon`
| Colonne | Type | Nullable | Défaut | Notes |
|---|---|---|---|---|
| `id` | uuid | NON | — | PK |
| `college_id` | uuid | NON | — | FK → `colleges(id)` ON DELETE CASCADE |
| `classe_id` | uuid | oui | — | FK → `classes(id)` ON DELETE SET NULL — NULL = notification pour tout le collège |
| `sent_by` | uuid | oui | — | FK → `users(id)` ON DELETE SET NULL |
| `sent_at` | timestamp | oui | `NOW()` | |
| `emails_sent` | integer | oui | `0` | |

---

### `notifications_cartes`
Même structure que `notifications_brouillon`, + `date_passage` (timestamp) pour la date/heure de retrait des cartes physiques.

---

### `payments_kkiapay`
⚠️ Créée manuellement en Phase 5, absente de l'ancien `setupDatabase.js` — maintenant documentée dans la migration baseline.

| Colonne | Type | Nullable | Défaut | Notes |
|---|---|---|---|---|
| `id` | uuid | NON | — | PK |
| `college_id` | uuid | oui | — | FK → `colleges(id)` ON DELETE SET NULL |
| `user_id` | uuid | oui | — | FK → `users(id)` ON DELETE SET NULL |
| `transaction_id` | varchar(255) | NON | — | UNIQUE — identifiant transaction KKiaPay |
| `amount` | numeric | NON | — | |
| `status` | varchar(50) | NON | — | |
| `created_at` | timestamp | oui | `CURRENT_TIMESTAMP` | |

---

## Index

| Table | Index | Colonnes | Notes |
|---|---|---|---|
| `colleges` | `idx_colleges_commune` | `commune, departement` | |
| `classes` | `idx_classes_college` | `college_id` | |
| `eleves` | `idx_eleves_classe` | `classe_id` | |
| `eleves` | `idx_eleves_matricule` | `matricule` | |
| `users` | `idx_users_college` | `college_id` | |
| `access_keys` | `idx_access_keys_college` | `college_id` | |
| `observations` | `idx_observations_classe` | `classe_id` | |
| `observations` | `idx_observations_non_lues` | `lu_par_admin` | Index partiel `WHERE lu_par_admin = false` |
| `notifications_brouillon` | `idx_notif_brouillon_college` | `college_id` | |
| `notifications_cartes` | `idx_notif_cartes_college` | `college_id` | |

---

## Sécurité — Row Level Security (RLS)

**Activé depuis le 26 août 2026** sur : `access_keys`, `brouillons_cartes`, `classes`, `colleges`, `eleves`, `observations`, `otps`, `users`.
Déjà protégées par nature : `notifications_brouillon`, `notifications_cartes`, `payments_kkiapay`.

**Aucune policy définie** — RLS activé sans policy = accès total bloqué par défaut via l'API PostgREST publique de Supabase (clé `anon`). Le backend Express contourne RLS nativement car il se connecte via `DATABASE_URL` avec un rôle qui a les privilèges complets — **aucun impact sur le fonctionnement de l'API**.

But : si la clé `anon` de Supabase fuitait un jour, aucun accès direct aux données ne serait possible sans policy explicite.

---

## Comment ajouter un changement de schéma

1. `npm run migrate create nom_du_changement` — crée un fichier daté dans `migrations/`
2. Écrire `up` (et `down` si raisonnable) dans ce fichier
3. Tester en local (`npm run migrate up`, `npm run migrate down` pour vérifier le rollback)
4. **Mettre à jour ce fichier `SCHEMA.md`** avec le changement
5. Appliquer en prod avec `npm run migrate up` (déploiement manuel, pas automatique sur Render)

**Ne jamais** :
- Modifier le schéma directement dans l'éditeur SQL Supabase sans créer une migration correspondante après coup
- Réécrire une migration déjà appliquée en prod — toujours en créer une nouvelle