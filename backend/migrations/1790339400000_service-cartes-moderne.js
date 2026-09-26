/** Active le catalogue du service Cartes sans l’activer par défaut. */
export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO modules_plateforme (code, libelle, actif)
    VALUES ('cartes', 'Cartes FVS', false)
    ON CONFLICT (code) DO NOTHING;
    INSERT INTO permissions (code, module, libelle, description)
    VALUES ('fvs.consulter', 'fvs', 'Consulter le service Cartes', 'Accéder aux élèves et classes disponibles pour les cartes.')
    ON CONFLICT (code) DO UPDATE SET libelle = EXCLUDED.libelle, description = EXCLUDED.description;
    INSERT INTO profil_permissions (profil_id, permission_code)
    SELECT p.id, 'fvs.consulter'
    FROM profils_acces p
    WHERE p.designation IN ('directeur', 'secretaire', 'censeur')
    ON CONFLICT DO NOTHING;
    INSERT INTO profil_permissions (profil_id, permission_code)
    SELECT p.id, 'fvs.activer' FROM profils_acces p WHERE p.designation = 'directeur'
    ON CONFLICT DO NOTHING;
  `);
};

export const down = () => {
  throw new Error('Migration non réversible automatiquement.');
};
