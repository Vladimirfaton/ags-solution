/** Ajoute le référentiel primaire aux installations primaires existantes. */
export const up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      primaire_id uuid;
      type_etablissement varchar;
    BEGIN
      SELECT type INTO type_etablissement
      FROM etablissement
      WHERE singleton = true;

      IF type_etablissement = 'primaire' THEN
        SELECT id INTO primaire_id FROM cycles WHERE nom = 'Primaire' LIMIT 1;
        IF primaire_id IS NULL THEN
          INSERT INTO cycles (id, nom, ordre, type_division, actif)
          VALUES (gen_random_uuid(), 'Primaire', 1, 'groupe', true)
          RETURNING id INTO primaire_id;
        END IF;

        INSERT INTO niveaux_scolaires (id, cycle_id, code, libelle, ordre, actif)
        SELECT gen_random_uuid(), primaire_id, v.code, v.libelle, v.ordre, true
        FROM (VALUES
          ('CI', 'CI', 1), ('CP', 'CP', 2), ('CE1', 'CE1', 3),
          ('CE2', 'CE2', 4), ('CM1', 'CM1', 5), ('CM2', 'CM2', 6)
        ) AS v(code, libelle, ordre)
        WHERE NOT EXISTS (
          SELECT 1 FROM niveaux_scolaires n
          WHERE n.cycle_id = primaire_id AND n.code = v.code
        );
      END IF;
    END $$;
  `);
};

export const down = (pgm) => {};
