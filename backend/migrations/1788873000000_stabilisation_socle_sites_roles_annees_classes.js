/** Stabilise les règles métier du socle SIS. */
export const up = (pgm) => {
  // Les sites sont une responsabilité exclusive de l'administration FVS.
  pgm.sql(`DELETE FROM profil_permissions pp
    USING profils_acces p
    WHERE pp.profil_id = p.id
      AND p.designation = 'directeur'
      AND pp.permission_code = 'site.gerer'`);

  pgm.addConstraint('annees_scolaires', 'check_dates_annee_coherentes', 'CHECK (date_fin > date_debut)');
  pgm.addColumns('annees_scolaires', {
    cloturee_at: { type: 'timestamp' },
  });

  pgm.createTable('niveaux_scolaires', {
    code: { type: 'varchar(20)', primaryKey: true },
    libelle: { type: 'varchar(30)', notNull: true, unique: true },
    ordre: { type: 'integer', notNull: true, unique: true },
    regle_division: { type: 'varchar(30)', notNull: true },
  });
  pgm.addConstraint('niveaux_scolaires', 'check_regle_division_niveau', "CHECK (regle_division IN ('groupe', 'groupe_ou_serie', 'serie'))");
  pgm.sql(`INSERT INTO niveaux_scolaires (code, libelle, ordre, regle_division) VALUES
    ('6e', '6e', 10, 'groupe'),
    ('5e', '5e', 20, 'groupe'),
    ('4e', '4e', 30, 'groupe'),
    ('3e', '3e', 40, 'groupe_ou_serie'),
    ('2nde', '2nde', 50, 'serie'),
    ('1ere', '1ère', 60, 'serie'),
    ('terminale', 'Terminale', 70, 'serie')`);

  pgm.addColumns('classes', { niveau_code: { type: 'varchar(20)', references: 'niveaux_scolaires(code)' } });
  // Reprend les niveaux déjà saisis avant l'introduction du catalogue fixe.
  pgm.sql(`UPDATE classes SET niveau_code = CASE
    WHEN nom ~* '^\\s*6' THEN '6e'
    WHEN nom ~* '^\\s*5' THEN '5e'
    WHEN nom ~* '^\\s*4' THEN '4e'
    WHEN nom ~* '^\\s*3' THEN '3e'
    WHEN nom ~* '^\\s*2' THEN '2nde'
    WHEN nom ~* '^\\s*1' THEN '1ere'
    WHEN nom ~* '^\\s*(t|term)' THEN 'terminale'
    ELSE NULL END`);
  pgm.sql(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM classes WHERE niveau_code IS NULL) THEN
      RAISE EXCEPTION 'Une classe existante ne correspond pas à un niveau autorisé. Corrigez-la avant la migration.';
    END IF;
  END $$`);
  // Une ancienne saisie comme « 5ème A » est convertie en niveau 5e + groupe A.
  pgm.sql(`UPDATE classes_annuelles ca
    SET division_nom = COALESCE(ca.division_nom, (regexp_match(c.nom, '[[:space:]-]+([^[:space:]-]+)$'))[1])
    FROM classes c
    WHERE c.id = ca.classe_id`);
  pgm.sql(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM classes_annuelles WHERE division_nom IS NULL OR btrim(division_nom) = '') THEN
      RAISE EXCEPTION 'Chaque classe annuelle doit avoir un groupe ou une série avant la migration.';
    END IF;
  END $$`);
  pgm.sql(`UPDATE classes_annuelles ca SET division_type = CASE n.regle_division
    WHEN 'groupe' THEN 'groupe'
    WHEN 'serie' THEN 'serie'
    ELSE CASE WHEN ca.division_type IN ('groupe', 'serie') THEN ca.division_type ELSE 'groupe' END
    END
    FROM classes c JOIN niveaux_scolaires n ON n.code = c.niveau_code
    WHERE c.id = ca.classe_id`);
  // Regroupe les anciens doublons de référence (ex. « 6 » et « 6ème »).
  pgm.sql(`WITH canon AS (
      SELECT cycle_id, niveau_code, id FROM (
        SELECT cycle_id, niveau_code, id,
          row_number() OVER (PARTITION BY cycle_id, niveau_code ORDER BY id) AS rang
        FROM classes
      ) references_classes WHERE rang = 1
    )
    UPDATE classes_annuelles ca SET classe_id = canon.id
    FROM classes c JOIN canon ON canon.cycle_id = c.cycle_id AND canon.niveau_code = c.niveau_code
    WHERE ca.classe_id = c.id AND ca.classe_id <> canon.id`);
  pgm.sql(`DELETE FROM classes c USING (
      SELECT id, row_number() OVER (PARTITION BY cycle_id, niveau_code ORDER BY id) AS rang
      FROM classes
    ) doublon WHERE c.id = doublon.id AND doublon.rang > 1`);
  pgm.sql(`UPDATE classes c SET nom = n.libelle, ordre = n.ordre
    FROM niveaux_scolaires n WHERE n.code = c.niveau_code`);
  pgm.alterColumn('classes', 'niveau_code', { notNull: true });
  pgm.addConstraint('classes', 'uniq_classe_niveau_cycle', 'UNIQUE(cycle_id, niveau_code)');

  pgm.dropConstraint('classes_annuelles', 'uniq_classe_annuelle');
  pgm.alterColumn('classes_annuelles', 'division_nom', { notNull: true });
  pgm.alterColumn('classes_annuelles', 'division_type', { notNull: true });
  pgm.addConstraint('classes_annuelles', 'check_division_type', "CHECK (division_type IN ('groupe', 'serie'))");
  pgm.addConstraint('classes_annuelles', 'uniq_classe_annuelle', 'UNIQUE(annee_scolaire_id, site_id, classe_id, division_type, division_nom)');
  pgm.sql(`CREATE OR REPLACE FUNCTION verifier_division_classe_annuelle()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE regle varchar(30);
    BEGIN
      SELECT n.regle_division INTO regle
      FROM classes c JOIN niveaux_scolaires n ON n.code = c.niveau_code
      WHERE c.id = NEW.classe_id;
      IF regle IS NULL THEN RAISE EXCEPTION 'Niveau de classe introuvable'; END IF;
      IF btrim(NEW.division_nom) = '' THEN RAISE EXCEPTION 'Un groupe ou une série est requis'; END IF;
      IF (regle = 'groupe' AND NEW.division_type <> 'groupe')
        OR (regle = 'serie' AND NEW.division_type <> 'serie')
        OR (regle = 'groupe_ou_serie' AND NEW.division_type NOT IN ('groupe', 'serie')) THEN
        RAISE EXCEPTION 'Type de division invalide pour ce niveau';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER trigger_verifier_division_classe_annuelle
    BEFORE INSERT OR UPDATE OF classe_id, division_nom, division_type ON classes_annuelles
    FOR EACH ROW EXECUTE FUNCTION verifier_division_classe_annuelle();`);
};

export const down = () => { throw new Error('La stabilisation du socle ne possède pas de rollback automatique.'); };
