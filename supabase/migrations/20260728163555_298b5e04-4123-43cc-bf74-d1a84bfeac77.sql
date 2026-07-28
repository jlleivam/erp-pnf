
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'requisiciones','cuentas_por_pagar','obra_nominas',
    'caja_chica_fondos','caja_chica_reembolsos','caja_chica_gastos',
    'vales_gasolina','gastos_oficina','obra_rentas',
    'ordenes_compra','obra_tareas',
    'obra_presupuestos','obra_estimaciones',
    'obra_destajos','obra_subcontratos'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
