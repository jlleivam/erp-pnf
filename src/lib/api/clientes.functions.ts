import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const datosContactoSchema = z
  .object({
    nombre_contacto: z.string().trim().max(255).optional().default(""),
    email: z.string().trim().max(255).optional().default(""),
    telefono: z.string().trim().max(50).optional().default(""),
  })
  .default({ nombre_contacto: "", email: "", telefono: "" });

const clienteBaseSchema = z.object({
  tipo_persona: z.enum(["moral", "fisica"]),
  razon_social: z.string().trim().min(1).max(255),
  rfc: z.string().trim().min(12).max(13),
  datos_contacto: datosContactoSchema,
});

export const listClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("clientes")
      .select("id, razon_social, rfc, tipo_persona, datos_contacto, created_at")
      .order("razon_social");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const crearCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clienteBaseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Sin empresa");
    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert({
        company_id: profile.company_id,
        tipo_persona: data.tipo_persona,
        razon_social: data.razon_social,
        rfc: data.rfc.toUpperCase(),
        datos_contacto: data.datos_contacto,
      })
      .select("id, razon_social, rfc, tipo_persona, datos_contacto, created_at")
      .single();
    if (error) throw new Error(error.message);
    return cliente;
  });

export const actualizarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    clienteBaseSchema.extend({ id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("clientes")
      .update({
        tipo_persona: data.tipo_persona,
        razon_social: data.razon_social,
        rfc: data.rfc.toUpperCase(),
        datos_contacto: data.datos_contacto,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("clientes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
