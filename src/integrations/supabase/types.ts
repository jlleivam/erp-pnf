export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          banco: string | null
          beneficiario: string | null
          clabe: string | null
          company_id: string
          condiciones_pago: number | null
          constancia_fiscal_url: string | null
          constancia_fiscal_vencimiento: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          correo: string | null
          created_at: string
          curp: string | null
          datos_contacto: Json
          direccion_fiscal: string | null
          id: string
          limite_credito: number | null
          opinion_sat_url: string | null
          opinion_sat_vencimiento: string | null
          razon_social: string
          regimen_fiscal: string | null
          rfc: string
          telefono: string | null
          tipo_persona: Database["public"]["Enums"]["tipo_persona"]
        }
        Insert: {
          banco?: string | null
          beneficiario?: string | null
          clabe?: string | null
          company_id: string
          condiciones_pago?: number | null
          constancia_fiscal_url?: string | null
          constancia_fiscal_vencimiento?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          correo?: string | null
          created_at?: string
          curp?: string | null
          datos_contacto?: Json
          direccion_fiscal?: string | null
          id?: string
          limite_credito?: number | null
          opinion_sat_url?: string | null
          opinion_sat_vencimiento?: string | null
          razon_social: string
          regimen_fiscal?: string | null
          rfc: string
          telefono?: string | null
          tipo_persona: Database["public"]["Enums"]["tipo_persona"]
        }
        Update: {
          banco?: string | null
          beneficiario?: string | null
          clabe?: string | null
          company_id?: string
          condiciones_pago?: number | null
          constancia_fiscal_url?: string | null
          constancia_fiscal_vencimiento?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          correo?: string | null
          created_at?: string
          curp?: string | null
          datos_contacto?: Json
          direccion_fiscal?: string | null
          id?: string
          limite_credito?: number | null
          opinion_sat_url?: string | null
          opinion_sat_vencimiento?: string | null
          razon_social?: string
          regimen_fiscal?: string | null
          rfc?: string
          telefono?: string | null
          tipo_persona?: Database["public"]["Enums"]["tipo_persona"]
        }
        Relationships: [
          {
            foreignKeyName: "clientes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          datos_facturacion: Json
          id: string
          razon_social: string
          rfc: string
          tipo_persona: Database["public"]["Enums"]["tipo_persona"]
        }
        Insert: {
          created_at?: string
          datos_facturacion?: Json
          id?: string
          razon_social: string
          rfc: string
          tipo_persona: Database["public"]["Enums"]["tipo_persona"]
        }
        Update: {
          created_at?: string
          datos_facturacion?: Json
          id?: string
          razon_social?: string
          rfc?: string
          tipo_persona?: Database["public"]["Enums"]["tipo_persona"]
        }
        Relationships: []
      }
      insumo_categorias: {
        Row: {
          company_id: string
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      insumos: {
        Row: {
          autorizado_at: string | null
          autorizado_por: string | null
          categoria_id: string | null
          company_id: string
          created_at: string
          estatus: Database["public"]["Enums"]["insumo_estatus"]
          id: string
          nombre: string
          solicitado_por: string | null
          unidad: Database["public"]["Enums"]["insumo_unidad"]
        }
        Insert: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          categoria_id?: string | null
          company_id: string
          created_at?: string
          estatus?: Database["public"]["Enums"]["insumo_estatus"]
          id?: string
          nombre: string
          solicitado_por?: string | null
          unidad: Database["public"]["Enums"]["insumo_unidad"]
        }
        Update: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          categoria_id?: string | null
          company_id?: string
          created_at?: string
          estatus?: Database["public"]["Enums"]["insumo_estatus"]
          id?: string
          nombre?: string
          solicitado_por?: string | null
          unidad?: Database["public"]["Enums"]["insumo_unidad"]
        }
        Relationships: [
          {
            foreignKeyName: "insumos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "insumo_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos_historial_precios: {
        Row: {
          cantidad: number | null
          created_at: string
          fecha: string
          id: string
          insumo_id: string
          obra_id: string | null
          precio_unitario: number
          proveedor: string | null
        }
        Insert: {
          cantidad?: number | null
          created_at?: string
          fecha?: string
          id?: string
          insumo_id: string
          obra_id?: string | null
          precio_unitario: number
          proveedor?: string | null
        }
        Update: {
          cantidad?: number | null
          created_at?: string
          fecha?: string
          id?: string
          insumo_id?: string
          obra_id?: string | null
          precio_unitario?: number
          proveedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insumos_historial_precios_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_comisiones: {
        Row: {
          base_calculo: string
          created_at: string
          id: string
          obra_id: string
          porcentaje: number
          user_id: string
        }
        Insert: {
          base_calculo?: string
          created_at?: string
          id?: string
          obra_id: string
          porcentaje?: number
          user_id: string
        }
        Update: {
          base_calculo?: string
          created_at?: string
          id?: string
          obra_id?: string
          porcentaje?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_comisiones_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_team: {
        Row: {
          created_at: string
          id: string
          obra_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          obra_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          obra_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_team_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          cliente_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          fecha_inicio: string | null
          fecha_terminacion: string | null
          id: string
          monto_contratado: number | null
          nombre: string
          numero_contrato: string | null
          presupuesto_url: string | null
          tipo_obra: Database["public"]["Enums"]["tipo_obra"]
          ubicacion: string | null
        }
        Insert: {
          cliente_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          fecha_inicio?: string | null
          fecha_terminacion?: string | null
          id?: string
          monto_contratado?: number | null
          nombre: string
          numero_contrato?: string | null
          presupuesto_url?: string | null
          tipo_obra: Database["public"]["Enums"]["tipo_obra"]
          ubicacion?: string | null
        }
        Update: {
          cliente_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          fecha_inicio?: string | null
          fecha_terminacion?: string | null
          id?: string
          monto_contratado?: number | null
          nombre?: string
          numero_contrato?: string | null
          presupuesto_url?: string | null
          tipo_obra?: Database["public"]["Enums"]["tipo_obra"]
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          id: string
          nombre_completo: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string
          id: string
          nombre_completo?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre_completo?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_director_of: { Args: { _company_id: string }; Returns: boolean }
      is_member_of_obra: { Args: { _obra_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "director"
        | "residente"
        | "auxiliar"
        | "administrativo"
        | "supervisor"
      insumo_estatus: "autorizado" | "pendiente"
      insumo_unidad: "KG" | "M2" | "M3" | "ML" | "PZA" | "LT" | "TON"
      tipo_obra:
        | "industrial"
        | "comercial"
        | "residencial"
        | "infraestructura"
        | "vivienda_serie"
        | "urbanizacion"
      tipo_persona: "moral" | "fisica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "director",
        "residente",
        "auxiliar",
        "administrativo",
        "supervisor",
      ],
      insumo_estatus: ["autorizado", "pendiente"],
      insumo_unidad: ["KG", "M2", "M3", "ML", "PZA", "LT", "TON"],
      tipo_obra: [
        "industrial",
        "comercial",
        "residencial",
        "infraestructura",
        "vivienda_serie",
        "urbanizacion",
      ],
      tipo_persona: ["moral", "fisica"],
    },
  },
} as const
