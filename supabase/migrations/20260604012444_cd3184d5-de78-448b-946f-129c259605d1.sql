
DO $$
DECLARE
  r RECORD;
  table_list TEXT := '';
BEGIN
  FOR r IN
    SELECT format('%I.%I', schemaname, tablename) AS qname
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    table_list := table_list || r.qname || ',';
  END LOOP;

  IF length(table_list) > 0 THEN
    table_list := rtrim(table_list, ',');
    EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;

DELETE FROM auth.users;
