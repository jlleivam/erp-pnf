
ALTER TABLE public.almacen_recepciones
  ADD COLUMN IF NOT EXISTS sin_remision boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_sin_remision text,
  ADD COLUMN IF NOT EXISTS evidencia_path text;

-- Storage policies for almacen-remisiones bucket (private)
CREATE POLICY "almacen_remisiones_select_auth"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'almacen-remisiones');

CREATE POLICY "almacen_remisiones_insert_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'almacen-remisiones');

CREATE POLICY "almacen_remisiones_update_auth"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'almacen-remisiones');

CREATE POLICY "almacen_remisiones_delete_auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'almacen-remisiones');
