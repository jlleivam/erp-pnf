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
      cotizacion_paquete_insumos: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          insumo_id: string
          paquete_id: string
          precio_unitario: number
          subtotal: number | null
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          insumo_id: string
          paquete_id: string
          precio_unitario?: number
          subtotal?: number | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          insumo_id?: string
          paquete_id?: string
          precio_unitario?: number
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_paquete_insumos_paquete_id_fkey"
            columns: ["paquete_id"]
            isOneToOne: false
            referencedRelation: "cotizacion_paquetes"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_paquetes: {
        Row: {
          company_id: string
          created_at: string
          id: string
          numero: number
          proveedor_id: string | null
          requisicion_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          numero: number
          proveedor_id?: string | null
          requisicion_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          numero?: number
          proveedor_id?: string | null
          requisicion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_paquetes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_paquetes_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_paquetes_requisicion_id_fkey"
            columns: ["requisicion_id"]
            isOneToOne: false
            referencedRelation: "requisiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_solicitud_insumos: {
        Row: {
          cantidad: number
          created_at: string
          disponible: boolean
          id: string
          insumo_id: string
          nota: string | null
          precio_unitario: number | null
          solicitud_id: string
          subtotal: number | null
        }
        Insert: {
          cantidad: number
          created_at?: string
          disponible?: boolean
          id?: string
          insumo_id: string
          nota?: string | null
          precio_unitario?: number | null
          solicitud_id: string
          subtotal?: number | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          disponible?: boolean
          id?: string
          insumo_id?: string
          nota?: string | null
          precio_unitario?: number | null
          solicitud_id?: string
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_solicitud_insumos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_solicitud_insumos_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "cotizacion_solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_solicitudes: {
        Row: {
          company_id: string
          creado_por: string
          created_at: string
          enviada_at: string | null
          estatus: Database["public"]["Enums"]["sc_estatus"]
          folio: string
          id: string
          notas: string | null
          proveedor_id: string
          recibida_at: string | null
          requisicion_id: string
        }
        Insert: {
          company_id: string
          creado_por: string
          created_at?: string
          enviada_at?: string | null
          estatus?: Database["public"]["Enums"]["sc_estatus"]
          folio: string
          id?: string
          notas?: string | null
          proveedor_id: string
          recibida_at?: string | null
          requisicion_id: string
        }
        Update: {
          company_id?: string
          creado_por?: string
          created_at?: string
          enviada_at?: string | null
          estatus?: Database["public"]["Enums"]["sc_estatus"]
          folio?: string
          id?: string
          notas?: string | null
          proveedor_id?: string
          recibida_at?: string | null
          requisicion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_solicitudes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_solicitudes_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_solicitudes_requisicion_id_fkey"
            columns: ["requisicion_id"]
            isOneToOne: false
            referencedRelation: "requisiciones"
            referencedColumns: ["id"]
          },
        ]
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
      notificaciones: {
        Row: {
          company_id: string
          created_at: string
          id: string
          leida_at: string | null
          link: string | null
          mensaje: string
          obra_id: string | null
          oc_id: string | null
          requisicion_id: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          leida_at?: string | null
          link?: string | null
          mensaje: string
          obra_id?: string | null
          oc_id?: string | null
          requisicion_id?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          leida_at?: string | null
          link?: string | null
          mensaje?: string
          obra_id?: string | null
          oc_id?: string | null
          requisicion_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
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
      ordenes_compra: {
        Row: {
          autorizada_at: string | null
          autorizada_por: string | null
          company_id: string
          creado_por: string
          created_at: string
          enviada_proveedor_at: string | null
          enviada_proveedor_por: string | null
          enviada_supervisor_at: string | null
          estatus: Database["public"]["Enums"]["oc_estatus"]
          folio: string
          id: string
          notas_supervisor: string | null
          obra_id: string
          paquete_id: string
          proveedor_id: string
          rechazada_at: string | null
          rechazada_por: string | null
          requisicion_id: string
          total: number
        }
        Insert: {
          autorizada_at?: string | null
          autorizada_por?: string | null
          company_id: string
          creado_por: string
          created_at?: string
          enviada_proveedor_at?: string | null
          enviada_proveedor_por?: string | null
          enviada_supervisor_at?: string | null
          estatus?: Database["public"]["Enums"]["oc_estatus"]
          folio: string
          id?: string
          notas_supervisor?: string | null
          obra_id: string
          paquete_id: string
          proveedor_id: string
          rechazada_at?: string | null
          rechazada_por?: string | null
          requisicion_id: string
          total?: number
        }
        Update: {
          autorizada_at?: string | null
          autorizada_por?: string | null
          company_id?: string
          creado_por?: string
          created_at?: string
          enviada_proveedor_at?: string | null
          enviada_proveedor_por?: string | null
          enviada_supervisor_at?: string | null
          estatus?: Database["public"]["Enums"]["oc_estatus"]
          folio?: string
          id?: string
          notas_supervisor?: string | null
          obra_id?: string
          paquete_id?: string
          proveedor_id?: string
          rechazada_at?: string | null
          rechazada_por?: string | null
          requisicion_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_paquete_id_fkey"
            columns: ["paquete_id"]
            isOneToOne: false
            referencedRelation: "cotizacion_paquetes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_requisicion_id_fkey"
            columns: ["requisicion_id"]
            isOneToOne: false
            referencedRelation: "requisiciones"
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
      requisicion_insumos: {
        Row: {
          cantidad: number
          created_at: string
          fecha_requerida: string
          id: string
          insumo_id: string
          nota: string | null
          requisicion_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          fecha_requerida: string
          id?: string
          insumo_id: string
          nota?: string | null
          requisicion_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          fecha_requerida?: string
          id?: string
          insumo_id?: string
          nota?: string | null
          requisicion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisicion_insumos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicion_insumos_requisicion_id_fkey"
            columns: ["requisicion_id"]
            isOneToOne: false
            referencedRelation: "requisiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      requisiciones: {
        Row: {
          autorizacion_at: string | null
          autorizacion_por: string | null
          company_id: string
          completada_at: string | null
          completada_por: string | null
          cotizacion_at: string | null
          cotizacion_por: string | null
          creado_por: string
          created_at: string
          enviada_at: string | null
          estatus: Database["public"]["Enums"]["requisicion_estatus"]
          folio: string
          id: string
          notas: string | null
          obra_id: string
          oc_at: string | null
          oc_por: string | null
          rechazada_at: string | null
          rechazada_por: string | null
          rechazo_motivo: string | null
        }
        Insert: {
          autorizacion_at?: string | null
          autorizacion_por?: string | null
          company_id: string
          completada_at?: string | null
          completada_por?: string | null
          cotizacion_at?: string | null
          cotizacion_por?: string | null
          creado_por: string
          created_at?: string
          enviada_at?: string | null
          estatus?: Database["public"]["Enums"]["requisicion_estatus"]
          folio: string
          id?: string
          notas?: string | null
          obra_id: string
          oc_at?: string | null
          oc_por?: string | null
          rechazada_at?: string | null
          rechazada_por?: string | null
          rechazo_motivo?: string | null
        }
        Update: {
          autorizacion_at?: string | null
          autorizacion_por?: string | null
          company_id?: string
          completada_at?: string | null
          completada_por?: string | null
          cotizacion_at?: string | null
          cotizacion_por?: string | null
          creado_por?: string
          created_at?: string
          enviada_at?: string | null
          estatus?: Database["public"]["Enums"]["requisicion_estatus"]
          folio?: string
          id?: string
          notas?: string | null
          obra_id?: string
          oc_at?: string | null
          oc_por?: string | null
          rechazada_at?: string | null
          rechazada_por?: string | null
          rechazo_motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisiciones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisiciones_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      terceros: {
        Row: {
          banco: string | null
          beneficiario: string | null
          categoria: Database["public"]["Enums"]["tercero_categoria"]
          categoria_productos: string | null
          clabe: string | null
          company_id: string
          contacto_nombre: string | null
          contacto_telefono: string | null
          correo: string | null
          creado_por: string | null
          created_at: string
          credito_disponible: number | null
          curp: string | null
          dias_credito: number | null
          direccion_fiscal: string | null
          fondo_garantia: boolean
          fondo_garantia_pct: number | null
          id: string
          razon_social: string
          regimen_fiscal: string | null
          requiere_factura: boolean
          retencion_isr: boolean
          retencion_isr_pct: number | null
          retencion_iva: boolean
          retencion_iva_pct: number | null
          rfc: string
          telefono: string | null
          tipo_persona: Database["public"]["Enums"]["tercero_tipo_persona"]
          tipo_trabajos: string | null
        }
        Insert: {
          banco?: string | null
          beneficiario?: string | null
          categoria?: Database["public"]["Enums"]["tercero_categoria"]
          categoria_productos?: string | null
          clabe?: string | null
          company_id: string
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          correo?: string | null
          creado_por?: string | null
          created_at?: string
          credito_disponible?: number | null
          curp?: string | null
          dias_credito?: number | null
          direccion_fiscal?: string | null
          fondo_garantia?: boolean
          fondo_garantia_pct?: number | null
          id?: string
          razon_social: string
          regimen_fiscal?: string | null
          requiere_factura?: boolean
          retencion_isr?: boolean
          retencion_isr_pct?: number | null
          retencion_iva?: boolean
          retencion_iva_pct?: number | null
          rfc: string
          telefono?: string | null
          tipo_persona: Database["public"]["Enums"]["tercero_tipo_persona"]
          tipo_trabajos?: string | null
        }
        Update: {
          banco?: string | null
          beneficiario?: string | null
          categoria?: Database["public"]["Enums"]["tercero_categoria"]
          categoria_productos?: string | null
          clabe?: string | null
          company_id?: string
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          correo?: string | null
          creado_por?: string | null
          created_at?: string
          credito_disponible?: number | null
          curp?: string | null
          dias_credito?: number | null
          direccion_fiscal?: string | null
          fondo_garantia?: boolean
          fondo_garantia_pct?: number | null
          id?: string
          razon_social?: string
          regimen_fiscal?: string | null
          requiere_factura?: boolean
          retencion_isr?: boolean
          retencion_isr_pct?: number | null
          retencion_iva?: boolean
          retencion_iva_pct?: number | null
          rfc?: string
          telefono?: string | null
          tipo_persona?: Database["public"]["Enums"]["tercero_tipo_persona"]
          tipo_trabajos?: string | null
        }
        Relationships: []
      }
      terceros_documentos: {
        Row: {
          created_at: string
          fecha_vencimiento: string | null
          id: string
          tercero_id: string
          tipo: Database["public"]["Enums"]["tercero_documento_tipo"]
          url: string
        }
        Insert: {
          created_at?: string
          fecha_vencimiento?: string | null
          id?: string
          tercero_id: string
          tipo: Database["public"]["Enums"]["tercero_documento_tipo"]
          url: string
        }
        Update: {
          created_at?: string
          fecha_vencimiento?: string | null
          id?: string
          tercero_id?: string
          tipo?: Database["public"]["Enums"]["tercero_documento_tipo"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "terceros_documentos_tercero_id_fkey"
            columns: ["tercero_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
        ]
      }
      trabajadores: {
        Row: {
          company_id: string
          correo: string | null
          creado_por: string | null
          created_at: string
          curp: string | null
          direccion: string | null
          estado_civil: string | null
          estatus_autorizacion: Database["public"]["Enums"]["trabajador_autorizacion"]
          fecha_baja: string | null
          fecha_ingreso: string | null
          fecha_nacimiento: string | null
          id: string
          imss_estatus: Database["public"]["Enums"]["trabajador_imss_estatus"]
          imss_fecha_alta: string | null
          imss_nss: string | null
          imss_sbc: number | null
          imss_tipo_trabajador: string | null
          nombre_completo: string
          nss: string | null
          puesto: Database["public"]["Enums"]["trabajador_puesto"] | null
          rfc: string | null
          sexo: Database["public"]["Enums"]["trabajador_sexo"] | null
          sueldo_diario: number | null
          telefono: string | null
          tipo_contrato:
            | Database["public"]["Enums"]["trabajador_tipo_contrato"]
            | null
        }
        Insert: {
          company_id: string
          correo?: string | null
          creado_por?: string | null
          created_at?: string
          curp?: string | null
          direccion?: string | null
          estado_civil?: string | null
          estatus_autorizacion?: Database["public"]["Enums"]["trabajador_autorizacion"]
          fecha_baja?: string | null
          fecha_ingreso?: string | null
          fecha_nacimiento?: string | null
          id?: string
          imss_estatus?: Database["public"]["Enums"]["trabajador_imss_estatus"]
          imss_fecha_alta?: string | null
          imss_nss?: string | null
          imss_sbc?: number | null
          imss_tipo_trabajador?: string | null
          nombre_completo: string
          nss?: string | null
          puesto?: Database["public"]["Enums"]["trabajador_puesto"] | null
          rfc?: string | null
          sexo?: Database["public"]["Enums"]["trabajador_sexo"] | null
          sueldo_diario?: number | null
          telefono?: string | null
          tipo_contrato?:
            | Database["public"]["Enums"]["trabajador_tipo_contrato"]
            | null
        }
        Update: {
          company_id?: string
          correo?: string | null
          creado_por?: string | null
          created_at?: string
          curp?: string | null
          direccion?: string | null
          estado_civil?: string | null
          estatus_autorizacion?: Database["public"]["Enums"]["trabajador_autorizacion"]
          fecha_baja?: string | null
          fecha_ingreso?: string | null
          fecha_nacimiento?: string | null
          id?: string
          imss_estatus?: Database["public"]["Enums"]["trabajador_imss_estatus"]
          imss_fecha_alta?: string | null
          imss_nss?: string | null
          imss_sbc?: number | null
          imss_tipo_trabajador?: string | null
          nombre_completo?: string
          nss?: string | null
          puesto?: Database["public"]["Enums"]["trabajador_puesto"] | null
          rfc?: string | null
          sexo?: Database["public"]["Enums"]["trabajador_sexo"] | null
          sueldo_diario?: number | null
          telefono?: string | null
          tipo_contrato?:
            | Database["public"]["Enums"]["trabajador_tipo_contrato"]
            | null
        }
        Relationships: []
      }
      trabajadores_documentos: {
        Row: {
          created_at: string
          fecha_vencimiento: string | null
          id: string
          tipo: Database["public"]["Enums"]["trabajador_doc_tipo"]
          trabajador_id: string
          url: string
        }
        Insert: {
          created_at?: string
          fecha_vencimiento?: string | null
          id?: string
          tipo: Database["public"]["Enums"]["trabajador_doc_tipo"]
          trabajador_id: string
          url: string
        }
        Update: {
          created_at?: string
          fecha_vencimiento?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["trabajador_doc_tipo"]
          trabajador_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "trabajadores_documentos_trabajador_id_fkey"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "trabajadores"
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
      siguiente_folio_oc: { Args: { _company_id: string }; Returns: string }
      siguiente_folio_requisicion: {
        Args: { _company_id: string }
        Returns: string
      }
      siguiente_folio_sc: { Args: { _company_id: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "director"
        | "residente"
        | "auxiliar"
        | "administrativo"
        | "supervisor"
      insumo_estatus: "autorizado" | "pendiente"
      insumo_unidad: "KG" | "M2" | "M3" | "ML" | "PZA" | "LT" | "TON" | "BTO"
      oc_estatus:
        | "borrador"
        | "pendiente_autorizacion"
        | "autorizada"
        | "enviada"
        | "rechazada"
        | "pagada"
      requisicion_estatus:
        | "borrador"
        | "enviada"
        | "en_cotizacion"
        | "pendiente_autorizacion"
        | "oc_generada"
        | "completada"
        | "rechazada"
      sc_estatus: "borrador" | "enviada" | "recibida" | "descartada"
      tercero_categoria: "proveedor" | "contratista" | "ambos"
      tercero_documento_tipo:
        | "constancia_fiscal"
        | "opinion_sat"
        | "domicilio_fiscal"
        | "repse"
      tercero_tipo_persona: "moral" | "fisica"
      tipo_obra:
        | "industrial"
        | "comercial"
        | "residencial"
        | "infraestructura"
        | "vivienda_serie"
        | "urbanizacion"
      tipo_persona: "moral" | "fisica"
      trabajador_autorizacion: "autorizado" | "pendiente"
      trabajador_doc_tipo: "ine" | "curp" | "domicilio" | "contrato"
      trabajador_imss_estatus:
        | "alta_activa"
        | "sin_alta"
        | "en_tramite"
        | "baja"
      trabajador_puesto:
        | "oficial"
        | "ayudante"
        | "operador_maquinaria"
        | "sobrestante"
        | "residente"
        | "auxiliar"
        | "administrativo"
      trabajador_sexo: "masculino" | "femenino"
      trabajador_tipo_contrato:
        | "eventual_urbano"
        | "eventual_campo"
        | "permanente"
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
      insumo_unidad: ["KG", "M2", "M3", "ML", "PZA", "LT", "TON", "BTO"],
      oc_estatus: [
        "borrador",
        "pendiente_autorizacion",
        "autorizada",
        "enviada",
        "rechazada",
        "pagada",
      ],
      requisicion_estatus: [
        "borrador",
        "enviada",
        "en_cotizacion",
        "pendiente_autorizacion",
        "oc_generada",
        "completada",
        "rechazada",
      ],
      sc_estatus: ["borrador", "enviada", "recibida", "descartada"],
      tercero_categoria: ["proveedor", "contratista", "ambos"],
      tercero_documento_tipo: [
        "constancia_fiscal",
        "opinion_sat",
        "domicilio_fiscal",
        "repse",
      ],
      tercero_tipo_persona: ["moral", "fisica"],
      tipo_obra: [
        "industrial",
        "comercial",
        "residencial",
        "infraestructura",
        "vivienda_serie",
        "urbanizacion",
      ],
      tipo_persona: ["moral", "fisica"],
      trabajador_autorizacion: ["autorizado", "pendiente"],
      trabajador_doc_tipo: ["ine", "curp", "domicilio", "contrato"],
      trabajador_imss_estatus: [
        "alta_activa",
        "sin_alta",
        "en_tramite",
        "baja",
      ],
      trabajador_puesto: [
        "oficial",
        "ayudante",
        "operador_maquinaria",
        "sobrestante",
        "residente",
        "auxiliar",
        "administrativo",
      ],
      trabajador_sexo: ["masculino", "femenino"],
      trabajador_tipo_contrato: [
        "eventual_urbano",
        "eventual_campo",
        "permanente",
      ],
    },
  },
} as const
