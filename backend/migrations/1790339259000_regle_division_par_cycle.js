/** Valide les groupes/séries à partir du cycle du niveau. */

export const up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION verifier_division_classe_annuelle()
    RETURNS trigger AS $$
    DECLARE
      regle varchar(20);
    BEGIN
      SELECT cy.type_division INTO regle
      FROM classes c
      JOIN cycles cy ON cy.id = c.cycle_id
      WHERE c.id = NEW.classe_id;

      IF regle IS NULL THEN
        RAISE EXCEPTION 'Cycle introuvable pour la classe annuelle.';
      END IF;

      IF NEW.division_type NOT IN ('groupe', 'serie')
         OR (regle <> 'libre' AND NEW.division_type <> regle) THEN
        RAISE EXCEPTION 'Le type de division est incompatible avec le cycle (%).', regle;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_verifier_division_classe_annuelle ON classes_annuelles;
    CREATE TRIGGER trigger_verifier_division_classe_annuelle
      BEFORE INSERT OR UPDATE OF classe_id, division_type
      ON classes_annuelles
      FOR EACH ROW EXECUTE FUNCTION verifier_division_classe_annuelle();
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS trigger_verifier_division_classe_annuelle ON classes_annuelles');
  pgm.sql('DROP FUNCTION IF EXISTS verifier_division_classe_annuelle()');
};
