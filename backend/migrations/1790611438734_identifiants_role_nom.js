export const up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      account record;
      base_username text;
      candidate text;
      suffix integer;
    BEGIN
      UPDATE users
      SET username = '__role_name_sync__' || id::text,
          username_locked = false
      WHERE role IN ('directeur', 'secretaire', 'comptable', 'censeur')
        AND NULLIF(BTRIM(nom), '') IS NOT NULL
        AND BTRIM(nom) <> CASE role
          WHEN 'directeur' THEN 'Directeur'
          WHEN 'secretaire' THEN 'Secrétaire'
          WHEN 'comptable' THEN 'Comptable'
          WHEN 'censeur' THEN 'Censeur'
        END
        AND LENGTH(role || '-' || BTRIM(nom)) <= 100;

      FOR account IN
        SELECT id, role, BTRIM(nom) AS nom
        FROM users
        WHERE LEFT(username, LENGTH('__role_name_sync__')) = '__role_name_sync__'
        ORDER BY role, BTRIM(nom), id
      LOOP
        base_username := account.role || '-' || account.nom;
        candidate := base_username;
        suffix := 2;

        WHILE EXISTS (
          SELECT 1 FROM users WHERE username = candidate AND id <> account.id
        ) LOOP
          candidate := base_username || '-' || suffix::text;
          suffix := suffix + 1;
          IF LENGTH(candidate) > 100 THEN
            RAISE EXCEPTION 'Impossible de générer un identifiant unique de 100 caractères maximum pour le compte %', account.id;
          END IF;
        END LOOP;

        UPDATE users
        SET username = candidate, username_locked = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = account.id;
      END LOOP;
    END $$;
  `);
};

export const down = (pgm) => {};
