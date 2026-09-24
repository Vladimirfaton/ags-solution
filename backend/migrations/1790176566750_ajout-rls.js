export const up = (pgm) => {
    pgm.sql(`
CREATE OR REPLACE FUNCTION public.auto_enable_rls()
RETURNS event_trigger LANGUAGE plpgsql AS $$
DECLARE cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
  END LOOP;
END $$;

CREATE EVENT TRIGGER trg_auto_enable_rls
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
EXECUTE FUNCTION public.auto_enable_rls();
 `);
};

export const down = () => { throw new Error('Pour securite des tables.'); };