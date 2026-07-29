REVOKE EXECUTE ON FUNCTION public.recompute_requisicion_estatus(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_oc_recompute_requisicion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_requisicion_estatus(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_oc_recompute_requisicion() TO service_role;