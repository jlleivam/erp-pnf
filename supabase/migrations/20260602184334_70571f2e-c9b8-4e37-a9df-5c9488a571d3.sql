INSERT INTO public.obra_destajo_trabajadores (destajo_id, trabajador_id, asignado_por)
SELECT DISTINCT ON (d.destajista_id) d.id, d.destajista_id, d.creado_por
FROM public.obra_destajos d
WHERE NOT EXISTS (
  SELECT 1 FROM public.obra_destajo_trabajadores t
  WHERE t.trabajador_id = d.destajista_id
    AND t.desasignado_at IS NULL
)
ORDER BY d.destajista_id, d.created_at ASC;