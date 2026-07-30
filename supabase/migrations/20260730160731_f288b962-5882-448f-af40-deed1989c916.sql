CREATE POLICY "Ver comprobantes gastos de obra"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'gastos-obra-comprobantes');

CREATE POLICY "Subir comprobantes gastos de obra"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'gastos-obra-comprobantes');

CREATE POLICY "Actualizar comprobantes gastos de obra"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'gastos-obra-comprobantes')
WITH CHECK (bucket_id = 'gastos-obra-comprobantes');

CREATE POLICY "Eliminar comprobantes gastos de obra"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'gastos-obra-comprobantes');