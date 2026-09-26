# Instructions de travail — FVS / AGS-Solution

## Règle absolue

Le propriétaire du projet applique lui-même les modifications.

L'agent travaille en lecture seule par défaut :

- ne jamais modifier, créer ou supprimer un fichier sans autorisation explicite ;
- après autorisation, proposer un patch précis, mais ne pas l'appliquer directement sauf demande explicite distincte ;
- ne jamais appliquer directement une migration, une suppression de modèle ou une modification de schéma ;
- inspecter les fichiers réels, routes, modèles, contrôleurs, migrations et tests avant toute proposition ;
- distinguer l'état validé du code, les décisions d'architecture et les travaux restant à faire ;
- après application manuelle d'un patch par le propriétaire, proposer les vérifications adaptées.

Préférer des patches ciblés bloc par bloc aux fichiers complets.

## Architecture validée

- Modèle cible : `Establishment` + `AcademicStructure`.
- Ancien modèle `College` / `Class` : transitoire ; suppression uniquement après branchement complet et validation.
- Application mono-établissement avec site principal et sites/filiales rattachés.
- Types d'établissement uniquement `primaire` et `college`.
- Le type `college` inclut le lycée. Aucun type `mixte`.
- Gestion scolaire et FVS Cartes restent des services distinguables et activables/configurables séparément.

## Niveaux et classes

- Niveaux standards : `CI` à `CM2` pour le primaire et `6e` à `Terminale` pour le collège/lycée.
- Les noms standards ne doivent pas devenir des références SQL codées en dur.
- Référence relationnelle interne : `niveaux_scolaires.id`, utilisée par `classes.niveau_id`.
- `code` est conservé comme code technique stable ; `libelle` est le nom affiché ; `ordre` définit la progression.
- Utiliser `niveau_id` pour les relations SQL et conserver `code` avec `id` dans les réponses/API lorsque nécessaire.
- Groupe ou série reste prévu dans la structure.
- Au collège, la détermination automatique groupe/série par niveau peut être conservée.
- Le primaire doit utiliser le modèle commun ; une configuration totalement libre n'est pas prioritaire.

## Rôles

- `directeur` : consultation globale ;
- `secretaire` : classes, niveaux selon les droits retenus, registre élèves et transferts ;
- `comptable` : inscriptions, réinscriptions, scolarité, frais, paiements et caisse ;
- `censeur` : consultation et fonctions pédagogiques prévues ;
- administrateur FVS : installation, sites/filiales et services FVS.

Les permissions sont contrôlées côté serveur et les données isolées par site lorsque le compte est limité.

## Procédure obligatoire

1. Lire `PROJECT_CONTEXT.md` et les fichiers réels concernés.
2. Faire un diagnostic en lecture seule.
3. Identifier les incohérences et les impacts.
4. Proposer un patch précis, sans l'appliquer.
5. Attendre l'application manuelle par le propriétaire.
6. Vérifier ensuite imports, routes, migrations et tests, sans modifier les fichiers.

Avant toute affirmation sur une migration, vérifier le schéma réel, l'ordre des migrations et les risques sur les données existantes. Aucune migration destructive sans signalement explicite et accord séparé.

## État de transition connu

Le chantier `niveau_code` vers `niveau_id` n'est pas terminé. Des références historiques peuvent encore exister et doivent être inventoriées puis corrigées par patches ciblés. Le frontend collège peut encore contenir des règles héritées des niveaux `6e` à `Terminale`. Le primaire reste à implémenter.
