/** Profils initiaux modifiables pour les comptes de gestion. */
export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO permissions (code, module, libelle, description) VALUES
      ('etablissement.consulter', 'pilotage', 'Consulter l’établissement', 'Voir le tableau de bord global.'),
      ('annee_scolaire.gerer', 'pilotage', 'Gérer les années scolaires', 'Créer et activer une année scolaire.'),
      ('site.gerer', 'pilotage', 'Gérer les sites', 'Créer et gérer les sites et filiales.'),
      ('fvs.activer', 'fvs', 'Activer FVS Cartes', 'Demander l’activation du service Cartes.'),
      ('classe.consulter', 'scolarite', 'Consulter les classes', 'Voir les classes et leurs effectifs.'),
      ('classe.gerer', 'scolarite', 'Gérer les classes', 'Créer et modifier les classes annuelles.'),
      ('eleve.consulter', 'scolarite', 'Consulter les élèves', 'Voir les fiches élèves.'),
      ('eleve.modifier', 'scolarite', 'Modifier les élèves', 'Modifier une fiche élève.'),
      ('eleve.transferer', 'scolarite', 'Transférer les élèves', 'Changer la classe ou le site d’un élève.'),
      ('inscription.creer', 'scolarite', 'Enregistrer les inscriptions', 'Créer les inscriptions et réinscriptions.'),
      ('frais.gerer', 'finances', 'Configurer les frais', 'Définir les frais par classe, groupe ou série.'),
      ('caisse.gerer', 'finances', 'Gérer la caisse', 'Encaisser et consulter les paiements.'),
      ('professeur.consulter', 'pedagogie', 'Consulter les professeurs', 'Voir les fiches professeurs.'),
      ('professeur.gerer', 'pedagogie', 'Gérer les professeurs', 'Créer et modifier les fiches professeurs.'),
      ('professeur.affecter_classes', 'pedagogie', 'Affecter les professeurs', 'Attribuer les professeurs aux classes.')
    ON CONFLICT (code) DO UPDATE SET libelle = EXCLUDED.libelle, description = EXCLUDED.description;

    INSERT INTO profils_acces (nom, designation) VALUES
      ('Directeur initial', 'directeur'),
      ('Secrétaire initial', 'secretaire'),
      ('Comptable initial', 'comptable'),
      ('Censeur initial', 'censeur')
    ON CONFLICT (nom) DO UPDATE SET designation = EXCLUDED.designation;

    INSERT INTO profil_permissions (profil_id, permission_code)
    SELECT p.id, v.code
    FROM profils_acces p
    JOIN (VALUES
      ('directeur', 'etablissement.consulter'), ('directeur', 'annee_scolaire.gerer'), ('directeur', 'site.gerer'), ('directeur', 'fvs.activer'),
      ('secretaire', 'classe.consulter'), ('secretaire', 'classe.gerer'), ('secretaire', 'eleve.consulter'), ('secretaire', 'eleve.modifier'), ('secretaire', 'eleve.transferer'),
      ('comptable', 'classe.consulter'), ('comptable', 'eleve.consulter'), ('comptable', 'inscription.creer'), ('comptable', 'frais.gerer'), ('comptable', 'caisse.gerer'),
      ('censeur', 'classe.consulter'), ('censeur', 'eleve.consulter'), ('censeur', 'professeur.consulter'), ('censeur', 'professeur.gerer'), ('censeur', 'professeur.affecter_classes')
    ) AS v(designation, code) ON v.designation = p.designation
    ON CONFLICT DO NOTHING;

    INSERT INTO acces_utilisateur_sites (user_id, site_id, designation, portee)
    SELECT u.id, CASE WHEN u.role = 'directeur' THEN NULL ELSE s.id END, u.role,
      CASE WHEN u.role = 'directeur' THEN 'etablissement' ELSE 'site' END
    FROM users u
    CROSS JOIN (SELECT id FROM sites WHERE est_principal = true LIMIT 1) s
    WHERE u.role IN ('directeur', 'secretaire', 'comptable', 'censeur')
      AND NOT EXISTS (SELECT 1 FROM acces_utilisateur_sites a WHERE a.user_id = u.id AND a.actif = true);

    INSERT INTO acces_utilisateur_profils (acces_id, profil_id)
    SELECT a.id, p.id
    FROM acces_utilisateur_sites a
    JOIN profils_acces p ON p.designation = a.designation
    WHERE NOT EXISTS (SELECT 1 FROM acces_utilisateur_profils ap WHERE ap.acces_id = a.id AND ap.profil_id = p.id);
  `);
};

export const down = () => { throw new Error('Les profils initiaux ne doivent pas être supprimés automatiquement.'); };
