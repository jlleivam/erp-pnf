CREATE POLICY "Caja chica evidencias read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'caja-chica-evidencias'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

CREATE POLICY "Caja chica evidencias insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'caja-chica-evidencias'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

CREATE POLICY "Caja chica evidencias update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'caja-chica-evidencias'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

CREATE POLICY "Caja chica evidencias delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'caja-chica-evidencias'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );