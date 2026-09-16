/** Le directeur consulte les classes et les élèves de tout l'établissement. */
export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO profil_permissions (profil_id, permission_code)
    SELECT p.id, v.code
    FROM profils_acces p
    JOIN (VALUES ('directeur', 'classe.consulter'), ('directeur', 'eleve.consulter')) AS v(designation, code)
      ON v.designation = p.designation
    ON CONFLICT DO NOTHING;
  `);
};

export const down = () => { throw new Error('Les droits de consultation du directeur ne doivent pas être retirés automatiquement.'); };
