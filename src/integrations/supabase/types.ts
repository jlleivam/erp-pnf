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
      almacen_movimientos_semana: {
        Row: {
          created_at: string
          id: string
          insumo_id: string
          inv_inicial: number
          precio_unitario: number
          recibido: number
          semana_id: string
          updated_at: string
          utilizado: number
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id: string
          inv_inicial?: number
          precio_unitario?: number
          recibido?: number
          semana_id: string
          updated_at?: string
          utilizado?: number
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string
          inv_inicial?: number
          precio_unitario?: number
          recibido?: number
          semana_id?: string
          updated_at?: string
          utilizado?: number
        }
        Relationships: [
          {
            foreignKeyName: "almacen_movimientos_semana_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "almacen_movimientos_semana_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "almacen_semanas"
            referencedColumns: ["id"]
          },
        ]
      }
      almacen_recepcion_partidas: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          insumo_id: string
          precio_unitario: number
          recepcion_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          insumo_id: string
          precio_unitario?: number
          recepcion_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          insumo_id?: string
          precio_unitario?: number
          recepcion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "almacen_recepcion_partidas_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "almacen_recepcion_partidas_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "almacen_recepciones"
            referencedColumns: ["id"]
          },
        ]
      }
      almacen_recepciones: {
        Row: {
          company_id: string
          created_at: string
          fecha: string
          folio_remision: string | null
          id: string
          notas: string | null
          obra_id: string
          oc_id: string
          recibido_por: string
        }
        Insert: {
          company_id: string
          created_at?: string
          fecha?: string
          folio_remision?: string | null
          id?: string
          notas?: string | null
          obra_id: string
          oc_id: string
          recibido_por: string
        }
        Update: {
          company_id?: string
          created_at?: string
          fecha?: string
          folio_remision?: string | null
          id?: string
          notas?: string | null
          obra_id?: string
          oc_id?: string
          recibido_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "almacen_recepciones_oc_id_fkey"
            columns: ["oc_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      almacen_semanas: {
        Row: {
          cerrada_at: string | null
          cerrada_por: string | null
          company_id: string
          created_at: string
          estatus: Database["public"]["Enums"]["almacen_semana_estatus"]
          id: string
          obra_id: string
          semana_fin: string
          semana_inicio: string
        }
        Insert: {
          cerrada_at?: string | null
          cerrada_por?: string | null
          company_id: string
          created_at?: string
          estatus?: Database["public"]["Enums"]["almacen_semana_estatus"]
          id?: string
          obra_id: string
          semana_fin: string
          semana_inicio: string
        }
        Update: {
          cerrada_at?: string | null
          cerrada_por?: string | null
          company_id?: string
          created_at?: string
          estatus?: Database["public"]["Enums"]["almacen_semana_estatus"]
          id?: string
          obra_id?: string
          semana_fin?: string
          semana_inicio?: string
        }
        Relationships: []
      }
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
            foreignKeyName: "cotizacion_paquete_insumos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
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
          prefijo: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          nombre: string
          prefijo: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          nombre?: string
          prefijo?: string
        }
        Relationships: []
      }
      insumo_unidades: {
        Row: {
          codigo: string
          company_id: string
          created_at: string
          id: string
          nombre: string | null
        }
        Insert: {
          codigo: string
          company_id: string
          created_at?: string
          id?: string
          nombre?: string | null
        }
        Update: {
          codigo?: string
          company_id?: string
          created_at?: string
          id?: string
          nombre?: string | null
        }
        Relationships: []
      }
      insumos: {
        Row: {
          autorizado_at: string | null
          autorizado_por: string | null
          categoria_id: string | null
          codigo: string | null
          company_id: string
          created_at: string
          disponible_renta: boolean
          estatus: Database["public"]["Enums"]["insumo_estatus"]
          id: string
          nombre: string
          solicitado_por: string | null
          unidad: string
        }
        Insert: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          categoria_id?: string | null
          codigo?: string | null
          company_id: string
          created_at?: string
          disponible_renta?: boolean
          estatus?: Database["public"]["Enums"]["insumo_estatus"]
          id?: string
          nombre: string
          solicitado_por?: string | null
          unidad: string
        }
        Update: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          categoria_id?: string | null
          codigo?: string | null
          company_id?: string
          created_at?: string
          disponible_renta?: boolean
          estatus?: Database["public"]["Enums"]["insumo_estatus"]
          id?: string
          nombre?: string
          solicitado_por?: string | null
          unidad?: string
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
      obra_destajo_estimacion_renglones: {
        Row: {
          cantidad_ejecutada: number
          cantidad_vigente: number
          concepto: string
          created_at: string
          estimacion_id: string
          id: string
          importe_ejecutado: number
          pu_vigente: number
          renglon_clave: string
          unidad: string | null
        }
        Insert: {
          cantidad_ejecutada?: number
          cantidad_vigente?: number
          concepto: string
          created_at?: string
          estimacion_id: string
          id?: string
          importe_ejecutado?: number
          pu_vigente?: number
          renglon_clave: string
          unidad?: string | null
        }
        Update: {
          cantidad_ejecutada?: number
          cantidad_vigente?: number
          concepto?: string
          created_at?: string
          estimacion_id?: string
          id?: string
          importe_ejecutado?: number
          pu_vigente?: number
          renglon_clave?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_destajo_estimacion_renglones_estimacion_id_fkey"
            columns: ["estimacion_id"]
            isOneToOne: false
            referencedRelation: "obra_destajo_estimaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_destajo_estimaciones: {
        Row: {
          cerrada_at: string | null
          cerrada_por: string | null
          company_id: string
          creado_por: string
          created_at: string
          destajo_id: string
          estatus: Database["public"]["Enums"]["destajo_estimacion_estatus"]
          id: string
          monto_total: number
          numero: number
          semana_fin: string
          semana_inicio: string
          updated_at: string
        }
        Insert: {
          cerrada_at?: string | null
          cerrada_por?: string | null
          company_id: string
          creado_por: string
          created_at?: string
          destajo_id: string
          estatus?: Database["public"]["Enums"]["destajo_estimacion_estatus"]
          id?: string
          monto_total?: number
          numero?: number
          semana_fin: string
          semana_inicio: string
          updated_at?: string
        }
        Update: {
          cerrada_at?: string | null
          cerrada_por?: string | null
          company_id?: string
          creado_por?: string
          created_at?: string
          destajo_id?: string
          estatus?: Database["public"]["Enums"]["destajo_estimacion_estatus"]
          id?: string
          monto_total?: number
          numero?: number
          semana_fin?: string
          semana_inicio?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_destajo_estimaciones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_destajo_estimaciones_destajo_id_fkey"
            columns: ["destajo_id"]
            isOneToOne: false
            referencedRelation: "obra_destajos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_destajo_presupuestos: {
        Row: {
          autorizado_at: string | null
          autorizado_por: string | null
          creado_por: string
          created_at: string
          descripcion: string | null
          destajo_id: string
          enviado_at: string | null
          enviado_por: string | null
          estatus: Database["public"]["Enums"]["destajo_doc_estatus"]
          id: string
          monto_total: number
          nombre: string
          numero: number
          rechazado_at: string | null
          rechazado_por: string | null
          rechazo_motivo: string | null
          tipo: Database["public"]["Enums"]["destajo_presupuesto_tipo"]
          updated_at: string
        }
        Insert: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          creado_por: string
          created_at?: string
          descripcion?: string | null
          destajo_id: string
          enviado_at?: string | null
          enviado_por?: string | null
          estatus?: Database["public"]["Enums"]["destajo_doc_estatus"]
          id?: string
          monto_total?: number
          nombre: string
          numero?: number
          rechazado_at?: string | null
          rechazado_por?: string | null
          rechazo_motivo?: string | null
          tipo: Database["public"]["Enums"]["destajo_presupuesto_tipo"]
          updated_at?: string
        }
        Update: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          creado_por?: string
          created_at?: string
          descripcion?: string | null
          destajo_id?: string
          enviado_at?: string | null
          enviado_por?: string | null
          estatus?: Database["public"]["Enums"]["destajo_doc_estatus"]
          id?: string
          monto_total?: number
          nombre?: string
          numero?: number
          rechazado_at?: string | null
          rechazado_por?: string | null
          rechazo_motivo?: string | null
          tipo?: Database["public"]["Enums"]["destajo_presupuesto_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_destajo_presupuestos_destajo_id_fkey"
            columns: ["destajo_id"]
            isOneToOne: false
            referencedRelation: "obra_destajos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_destajo_renglones: {
        Row: {
          cantidad: number | null
          clave: string
          concepto: string
          created_at: string
          es_grupo: boolean
          id: string
          importe: number
          importe_delta: number
          nivel: number
          orden: number
          parent_clave: string | null
          precio_unitario: number | null
          presupuesto_destajo_id: string
          tipo_movimiento: Database["public"]["Enums"]["presupuesto_movimiento"]
          unidad: string | null
        }
        Insert: {
          cantidad?: number | null
          clave: string
          concepto: string
          created_at?: string
          es_grupo?: boolean
          id?: string
          importe?: number
          importe_delta?: number
          nivel: number
          orden?: number
          parent_clave?: string | null
          precio_unitario?: number | null
          presupuesto_destajo_id: string
          tipo_movimiento?: Database["public"]["Enums"]["presupuesto_movimiento"]
          unidad?: string | null
        }
        Update: {
          cantidad?: number | null
          clave?: string
          concepto?: string
          created_at?: string
          es_grupo?: boolean
          id?: string
          importe?: number
          importe_delta?: number
          nivel?: number
          orden?: number
          parent_clave?: string | null
          precio_unitario?: number | null
          presupuesto_destajo_id?: string
          tipo_movimiento?: Database["public"]["Enums"]["presupuesto_movimiento"]
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_destajo_renglones_presupuesto_destajo_id_fkey"
            columns: ["presupuesto_destajo_id"]
            isOneToOne: false
            referencedRelation: "obra_destajo_presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_destajo_trabajadores: {
        Row: {
          asignado_at: string
          asignado_por: string
          desasignado_at: string | null
          desasignado_por: string | null
          destajo_id: string
          id: string
          trabajador_id: string
        }
        Insert: {
          asignado_at?: string
          asignado_por: string
          desasignado_at?: string | null
          desasignado_por?: string | null
          destajo_id: string
          id?: string
          trabajador_id: string
        }
        Update: {
          asignado_at?: string
          asignado_por?: string
          desasignado_at?: string | null
          desasignado_por?: string | null
          destajo_id?: string
          id?: string
          trabajador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_destajo_trabajadores_destajo_id_fkey"
            columns: ["destajo_id"]
            isOneToOne: false
            referencedRelation: "obra_destajos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_destajo_trabajadores_trabajador_id_fkey"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "trabajadores"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_destajos: {
        Row: {
          company_id: string
          creado_por: string
          created_at: string
          descripcion: string | null
          destajista_id: string
          estatus: Database["public"]["Enums"]["destajo_doc_estatus"]
          id: string
          monto_total: number
          nombre: string
          numero: number
          obra_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          creado_por: string
          created_at?: string
          descripcion?: string | null
          destajista_id: string
          estatus?: Database["public"]["Enums"]["destajo_doc_estatus"]
          id?: string
          monto_total?: number
          nombre: string
          numero?: number
          obra_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          creado_por?: string
          created_at?: string
          descripcion?: string | null
          destajista_id?: string
          estatus?: Database["public"]["Enums"]["destajo_doc_estatus"]
          id?: string
          monto_total?: number
          nombre?: string
          numero?: number
          obra_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_destajos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_destajos_destajista_id_fkey"
            columns: ["destajista_id"]
            isOneToOne: false
            referencedRelation: "trabajadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_destajos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_estimacion_renglones: {
        Row: {
          cantidad_ejecutada: number
          cantidad_vigente: number
          concepto: string
          created_at: string
          estimacion_id: string
          id: string
          importe_ejecutado: number
          pu_vigente: number
          renglon_clave: string
          unidad: string | null
        }
        Insert: {
          cantidad_ejecutada?: number
          cantidad_vigente?: number
          concepto: string
          created_at?: string
          estimacion_id: string
          id?: string
          importe_ejecutado?: number
          pu_vigente?: number
          renglon_clave: string
          unidad?: string | null
        }
        Update: {
          cantidad_ejecutada?: number
          cantidad_vigente?: number
          concepto?: string
          created_at?: string
          estimacion_id?: string
          id?: string
          importe_ejecutado?: number
          pu_vigente?: number
          renglon_clave?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_estimacion_renglones_estimacion_id_fkey"
            columns: ["estimacion_id"]
            isOneToOne: false
            referencedRelation: "obra_estimaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_estimaciones: {
        Row: {
          cerrada_at: string | null
          cerrada_por: string | null
          company_id: string
          creado_por: string
          created_at: string
          estatus: Database["public"]["Enums"]["estimacion_estatus"]
          id: string
          monto_total: number
          numero: number
          obra_id: string
          semana_fin: string
          semana_inicio: string
          updated_at: string
        }
        Insert: {
          cerrada_at?: string | null
          cerrada_por?: string | null
          company_id: string
          creado_por: string
          created_at?: string
          estatus?: Database["public"]["Enums"]["estimacion_estatus"]
          id?: string
          monto_total?: number
          numero?: number
          obra_id: string
          semana_fin: string
          semana_inicio: string
          updated_at?: string
        }
        Update: {
          cerrada_at?: string | null
          cerrada_por?: string | null
          company_id?: string
          creado_por?: string
          created_at?: string
          estatus?: Database["public"]["Enums"]["estimacion_estatus"]
          id?: string
          monto_total?: number
          numero?: number
          obra_id?: string
          semana_fin?: string
          semana_inicio?: string
          updated_at?: string
        }
        Relationships: []
      }
      obra_nomina_asistencias: {
        Row: {
          created_at: string
          fecha: string
          horas_extras: number
          id: string
          jornada: number
          nota_extras: string | null
          renglon_id: string
        }
        Insert: {
          created_at?: string
          fecha: string
          horas_extras?: number
          id?: string
          jornada?: number
          nota_extras?: string | null
          renglon_id: string
        }
        Update: {
          created_at?: string
          fecha?: string
          horas_extras?: number
          id?: string
          jornada?: number
          nota_extras?: string | null
          renglon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_nomina_asistencias_renglon_id_fkey"
            columns: ["renglon_id"]
            isOneToOne: false
            referencedRelation: "obra_nomina_renglones"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_nomina_renglones: {
        Row: {
          created_at: string
          dias_trabajados: number
          horas_extras_total: number
          id: string
          importe_extras: number
          importe_jornadas: number
          importe_total: number
          multiplicador_extras: number
          nomina_id: string
          sueldo_diario_snapshot: number
          trabajador_id: string
        }
        Insert: {
          created_at?: string
          dias_trabajados?: number
          horas_extras_total?: number
          id?: string
          importe_extras?: number
          importe_jornadas?: number
          importe_total?: number
          multiplicador_extras?: number
          nomina_id: string
          sueldo_diario_snapshot?: number
          trabajador_id: string
        }
        Update: {
          created_at?: string
          dias_trabajados?: number
          horas_extras_total?: number
          id?: string
          importe_extras?: number
          importe_jornadas?: number
          importe_total?: number
          multiplicador_extras?: number
          nomina_id?: string
          sueldo_diario_snapshot?: number
          trabajador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_nomina_renglones_nomina_id_fkey"
            columns: ["nomina_id"]
            isOneToOne: false
            referencedRelation: "obra_nominas"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_nominas: {
        Row: {
          cerrada_at: string | null
          cerrada_por: string | null
          company_id: string
          creado_por: string
          created_at: string
          estatus: Database["public"]["Enums"]["nomina_estatus"]
          id: string
          monto_total: number
          numero: number
          obra_id: string
          semana_fin: string
          semana_inicio: string
          updated_at: string
        }
        Insert: {
          cerrada_at?: string | null
          cerrada_por?: string | null
          company_id: string
          creado_por: string
          created_at?: string
          estatus?: Database["public"]["Enums"]["nomina_estatus"]
          id?: string
          monto_total?: number
          numero?: number
          obra_id: string
          semana_fin: string
          semana_inicio: string
          updated_at?: string
        }
        Update: {
          cerrada_at?: string | null
          cerrada_por?: string | null
          company_id?: string
          creado_por?: string
          created_at?: string
          estatus?: Database["public"]["Enums"]["nomina_estatus"]
          id?: string
          monto_total?: number
          numero?: number
          obra_id?: string
          semana_fin?: string
          semana_inicio?: string
          updated_at?: string
        }
        Relationships: []
      }
      obra_presupuesto_renglones: {
        Row: {
          cantidad: number | null
          clave: string
          concepto: string
          created_at: string
          es_grupo: boolean
          id: string
          importe: number
          importe_delta: number
          nivel: number
          orden: number
          parent_clave: string | null
          precio_unitario: number | null
          presupuesto_id: string
          tipo_movimiento: Database["public"]["Enums"]["presupuesto_movimiento"]
          unidad: string | null
        }
        Insert: {
          cantidad?: number | null
          clave: string
          concepto: string
          created_at?: string
          es_grupo?: boolean
          id?: string
          importe?: number
          importe_delta?: number
          nivel: number
          orden?: number
          parent_clave?: string | null
          precio_unitario?: number | null
          presupuesto_id: string
          tipo_movimiento?: Database["public"]["Enums"]["presupuesto_movimiento"]
          unidad?: string | null
        }
        Update: {
          cantidad?: number | null
          clave?: string
          concepto?: string
          created_at?: string
          es_grupo?: boolean
          id?: string
          importe?: number
          importe_delta?: number
          nivel?: number
          orden?: number
          parent_clave?: string | null
          precio_unitario?: number | null
          presupuesto_id?: string
          tipo_movimiento?: Database["public"]["Enums"]["presupuesto_movimiento"]
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_presupuesto_renglones_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "obra_presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_presupuestos: {
        Row: {
          autorizado_at: string | null
          autorizado_por: string | null
          company_id: string
          created_at: string
          created_by: string
          descripcion: string | null
          estatus: Database["public"]["Enums"]["presupuesto_estatus"]
          id: string
          monto_total: number
          nombre: string
          numero: number
          obra_id: string
          tipo: Database["public"]["Enums"]["presupuesto_tipo"]
          updated_at: string
        }
        Insert: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          company_id: string
          created_at?: string
          created_by: string
          descripcion?: string | null
          estatus?: Database["public"]["Enums"]["presupuesto_estatus"]
          id?: string
          monto_total?: number
          nombre: string
          numero?: number
          obra_id: string
          tipo: Database["public"]["Enums"]["presupuesto_tipo"]
          updated_at?: string
        }
        Update: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          descripcion?: string | null
          estatus?: Database["public"]["Enums"]["presupuesto_estatus"]
          id?: string
          monto_total?: number
          nombre?: string
          numero?: number
          obra_id?: string
          tipo?: Database["public"]["Enums"]["presupuesto_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_presupuestos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_presupuestos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_renta_eventos: {
        Row: {
          creado_por: string
          created_at: string
          descripcion: string
          evidencia_url: string | null
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          renta_id: string
          tipo: Database["public"]["Enums"]["renta_evento_tipo"]
        }
        Insert: {
          creado_por: string
          created_at?: string
          descripcion: string
          evidencia_url?: string | null
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          renta_id: string
          tipo: Database["public"]["Enums"]["renta_evento_tipo"]
        }
        Update: {
          creado_por?: string
          created_at?: string
          descripcion?: string
          evidencia_url?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          renta_id?: string
          tipo?: Database["public"]["Enums"]["renta_evento_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "obra_renta_eventos_renta_id_fkey"
            columns: ["renta_id"]
            isOneToOne: false
            referencedRelation: "obra_rentas"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_renta_pagos: {
        Row: {
          creado_por: string
          created_at: string
          id: string
          monto: number
          notas: string | null
          pagado_at: string
          periodo_fin: string
          periodo_inicio: string
          referencia: string | null
          renta_id: string
        }
        Insert: {
          creado_por: string
          created_at?: string
          id?: string
          monto?: number
          notas?: string | null
          pagado_at?: string
          periodo_fin: string
          periodo_inicio: string
          referencia?: string | null
          renta_id: string
        }
        Update: {
          creado_por?: string
          created_at?: string
          id?: string
          monto?: number
          notas?: string | null
          pagado_at?: string
          periodo_fin?: string
          periodo_inicio?: string
          referencia?: string | null
          renta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_renta_pagos_renta_id_fkey"
            columns: ["renta_id"]
            isOneToOne: false
            referencedRelation: "obra_rentas"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_renta_renovaciones: {
        Row: {
          autorizado_at: string | null
          autorizado_por: string | null
          created_at: string
          estatus: Database["public"]["Enums"]["renta_renovacion_estatus"]
          fecha_fin_anterior: string
          fecha_fin_nueva: string
          id: string
          motivo: string | null
          numero: number
          rechazado_at: string | null
          rechazado_por: string | null
          rechazo_motivo: string | null
          renta_id: string
          solicitado_por: string
          tarifa_nueva: number | null
        }
        Insert: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          created_at?: string
          estatus?: Database["public"]["Enums"]["renta_renovacion_estatus"]
          fecha_fin_anterior: string
          fecha_fin_nueva: string
          id?: string
          motivo?: string | null
          numero?: number
          rechazado_at?: string | null
          rechazado_por?: string | null
          rechazo_motivo?: string | null
          renta_id: string
          solicitado_por: string
          tarifa_nueva?: number | null
        }
        Update: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          created_at?: string
          estatus?: Database["public"]["Enums"]["renta_renovacion_estatus"]
          fecha_fin_anterior?: string
          fecha_fin_nueva?: string
          id?: string
          motivo?: string | null
          numero?: number
          rechazado_at?: string | null
          rechazado_por?: string | null
          rechazo_motivo?: string | null
          renta_id?: string
          solicitado_por?: string
          tarifa_nueva?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_renta_renovaciones_renta_id_fkey"
            columns: ["renta_id"]
            isOneToOne: false
            referencedRelation: "obra_rentas"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_rentas: {
        Row: {
          autorizado_at: string | null
          autorizado_por: string | null
          cantidad: number
          company_id: string
          condiciones: string | null
          cotizado_at: string | null
          cotizado_por: string | null
          creado_por: string
          created_at: string
          deposito: number
          descripcion: string | null
          dias_aviso_vencimiento: number
          equipo: string
          estatus: Database["public"]["Enums"]["renta_estatus"]
          fecha_devolucion_real: string | null
          fecha_estimada_inicio: string | null
          fecha_fin_programada: string | null
          fecha_llegada_real: string | null
          id: string
          insumo_id: string | null
          numero: number
          obra_id: string
          periodicidad: Database["public"]["Enums"]["renta_periodicidad"] | null
          periodos_estimados: number | null
          proveedor_id: string | null
          rechazado_at: string | null
          rechazado_por: string | null
          rechazo_motivo: string | null
          tarifa_unitaria: number
          updated_at: string
        }
        Insert: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          cantidad?: number
          company_id: string
          condiciones?: string | null
          cotizado_at?: string | null
          cotizado_por?: string | null
          creado_por: string
          created_at?: string
          deposito?: number
          descripcion?: string | null
          dias_aviso_vencimiento?: number
          equipo: string
          estatus?: Database["public"]["Enums"]["renta_estatus"]
          fecha_devolucion_real?: string | null
          fecha_estimada_inicio?: string | null
          fecha_fin_programada?: string | null
          fecha_llegada_real?: string | null
          id?: string
          insumo_id?: string | null
          numero?: number
          obra_id: string
          periodicidad?:
            | Database["public"]["Enums"]["renta_periodicidad"]
            | null
          periodos_estimados?: number | null
          proveedor_id?: string | null
          rechazado_at?: string | null
          rechazado_por?: string | null
          rechazo_motivo?: string | null
          tarifa_unitaria?: number
          updated_at?: string
        }
        Update: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          cantidad?: number
          company_id?: string
          condiciones?: string | null
          cotizado_at?: string | null
          cotizado_por?: string | null
          creado_por?: string
          created_at?: string
          deposito?: number
          descripcion?: string | null
          dias_aviso_vencimiento?: number
          equipo?: string
          estatus?: Database["public"]["Enums"]["renta_estatus"]
          fecha_devolucion_real?: string | null
          fecha_estimada_inicio?: string | null
          fecha_fin_programada?: string | null
          fecha_llegada_real?: string | null
          id?: string
          insumo_id?: string | null
          numero?: number
          obra_id?: string
          periodicidad?:
            | Database["public"]["Enums"]["renta_periodicidad"]
            | null
          periodos_estimados?: number | null
          proveedor_id?: string | null
          rechazado_at?: string | null
          rechazado_por?: string | null
          rechazo_motivo?: string | null
          tarifa_unitaria?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_rentas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rentas_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rentas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rentas_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_subcontrato_estimacion_renglones: {
        Row: {
          cantidad_ejecutada: number
          cantidad_vigente: number
          concepto: string
          created_at: string
          estimacion_id: string
          id: string
          importe_ejecutado: number
          pu_vigente: number
          renglon_clave: string
          unidad: string | null
        }
        Insert: {
          cantidad_ejecutada?: number
          cantidad_vigente?: number
          concepto: string
          created_at?: string
          estimacion_id: string
          id?: string
          importe_ejecutado?: number
          pu_vigente?: number
          renglon_clave: string
          unidad?: string | null
        }
        Update: {
          cantidad_ejecutada?: number
          cantidad_vigente?: number
          concepto?: string
          created_at?: string
          estimacion_id?: string
          id?: string
          importe_ejecutado?: number
          pu_vigente?: number
          renglon_clave?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_subcontrato_estimacion_renglones_estimacion_fkey"
            columns: ["estimacion_id"]
            isOneToOne: false
            referencedRelation: "obra_subcontrato_estimaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_subcontrato_estimaciones: {
        Row: {
          cerrada_at: string | null
          cerrada_por: string | null
          company_id: string
          creado_por: string
          created_at: string
          estatus: Database["public"]["Enums"]["destajo_estimacion_estatus"]
          id: string
          monto_total: number
          numero: number
          semana_fin: string
          semana_inicio: string
          subcontrato_id: string
          updated_at: string
        }
        Insert: {
          cerrada_at?: string | null
          cerrada_por?: string | null
          company_id: string
          creado_por: string
          created_at?: string
          estatus?: Database["public"]["Enums"]["destajo_estimacion_estatus"]
          id?: string
          monto_total?: number
          numero?: number
          semana_fin: string
          semana_inicio: string
          subcontrato_id: string
          updated_at?: string
        }
        Update: {
          cerrada_at?: string | null
          cerrada_por?: string | null
          company_id?: string
          creado_por?: string
          created_at?: string
          estatus?: Database["public"]["Enums"]["destajo_estimacion_estatus"]
          id?: string
          monto_total?: number
          numero?: number
          semana_fin?: string
          semana_inicio?: string
          subcontrato_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_subcontrato_estimaciones_subcontrato_id_fkey"
            columns: ["subcontrato_id"]
            isOneToOne: false
            referencedRelation: "obra_subcontratos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_subcontrato_presupuestos: {
        Row: {
          autorizado_at: string | null
          autorizado_por: string | null
          creado_por: string
          created_at: string
          descripcion: string | null
          enviado_at: string | null
          enviado_por: string | null
          estatus: Database["public"]["Enums"]["destajo_doc_estatus"]
          id: string
          monto_total: number
          nombre: string
          numero: number
          rechazado_at: string | null
          rechazado_por: string | null
          rechazo_motivo: string | null
          subcontrato_id: string
          tipo: Database["public"]["Enums"]["destajo_presupuesto_tipo"]
          updated_at: string
        }
        Insert: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          creado_por: string
          created_at?: string
          descripcion?: string | null
          enviado_at?: string | null
          enviado_por?: string | null
          estatus?: Database["public"]["Enums"]["destajo_doc_estatus"]
          id?: string
          monto_total?: number
          nombre: string
          numero?: number
          rechazado_at?: string | null
          rechazado_por?: string | null
          rechazo_motivo?: string | null
          subcontrato_id: string
          tipo: Database["public"]["Enums"]["destajo_presupuesto_tipo"]
          updated_at?: string
        }
        Update: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          creado_por?: string
          created_at?: string
          descripcion?: string | null
          enviado_at?: string | null
          enviado_por?: string | null
          estatus?: Database["public"]["Enums"]["destajo_doc_estatus"]
          id?: string
          monto_total?: number
          nombre?: string
          numero?: number
          rechazado_at?: string | null
          rechazado_por?: string | null
          rechazo_motivo?: string | null
          subcontrato_id?: string
          tipo?: Database["public"]["Enums"]["destajo_presupuesto_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_subcontrato_presupuestos_subcontrato_id_fkey"
            columns: ["subcontrato_id"]
            isOneToOne: false
            referencedRelation: "obra_subcontratos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_subcontrato_renglones: {
        Row: {
          cantidad: number | null
          clave: string
          concepto: string
          created_at: string
          es_grupo: boolean
          id: string
          importe: number
          importe_delta: number
          nivel: number
          orden: number
          parent_clave: string | null
          precio_unitario: number | null
          presupuesto_subcontrato_id: string
          tipo_movimiento: Database["public"]["Enums"]["presupuesto_movimiento"]
          unidad: string | null
        }
        Insert: {
          cantidad?: number | null
          clave: string
          concepto: string
          created_at?: string
          es_grupo?: boolean
          id?: string
          importe?: number
          importe_delta?: number
          nivel: number
          orden?: number
          parent_clave?: string | null
          precio_unitario?: number | null
          presupuesto_subcontrato_id: string
          tipo_movimiento?: Database["public"]["Enums"]["presupuesto_movimiento"]
          unidad?: string | null
        }
        Update: {
          cantidad?: number | null
          clave?: string
          concepto?: string
          created_at?: string
          es_grupo?: boolean
          id?: string
          importe?: number
          importe_delta?: number
          nivel?: number
          orden?: number
          parent_clave?: string | null
          precio_unitario?: number | null
          presupuesto_subcontrato_id?: string
          tipo_movimiento?: Database["public"]["Enums"]["presupuesto_movimiento"]
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_subcontrato_renglones_presupuesto_fkey"
            columns: ["presupuesto_subcontrato_id"]
            isOneToOne: false
            referencedRelation: "obra_subcontrato_presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_subcontratos: {
        Row: {
          company_id: string
          contratista_id: string
          creado_por: string
          created_at: string
          descripcion: string | null
          estatus: Database["public"]["Enums"]["destajo_doc_estatus"]
          id: string
          monto_total: number
          nombre: string
          numero: number
          obra_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contratista_id: string
          creado_por: string
          created_at?: string
          descripcion?: string | null
          estatus?: Database["public"]["Enums"]["destajo_doc_estatus"]
          id?: string
          monto_total?: number
          nombre: string
          numero?: number
          obra_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contratista_id?: string
          creado_por?: string
          created_at?: string
          descripcion?: string | null
          estatus?: Database["public"]["Enums"]["destajo_doc_estatus"]
          id?: string
          monto_total?: number
          nombre?: string
          numero?: number
          obra_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_subcontratos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_subcontratos_contratista_id_fkey"
            columns: ["contratista_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_subcontratos_obra_id_fkey"
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
          disponible_renta: boolean
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
          disponible_renta?: boolean
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
          disponible_renta?: boolean
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
      vales_gasolina: {
        Row: {
          autorizado_at: string | null
          autorizado_por: string | null
          cancelado_at: string | null
          cancelado_por: string | null
          codigo_vale: string | null
          company_id: string
          confirmado_at: string | null
          confirmado_por: string | null
          created_at: string
          descripcion: string
          estatus: Database["public"]["Enums"]["vale_gasolina_estatus"]
          folio: string
          id: string
          ligado_at: string | null
          ligado_por: string | null
          monto_autorizado: number | null
          monto_solicitado: number
          motivo_rechazo: string | null
          obra_id: string | null
          rechazado_at: string | null
          rechazado_por: string | null
          solicitado_at: string
          solicitado_por: string
          tipo_combustible: Database["public"]["Enums"]["vale_gasolina_tipo"]
          updated_at: string
        }
        Insert: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          cancelado_at?: string | null
          cancelado_por?: string | null
          codigo_vale?: string | null
          company_id: string
          confirmado_at?: string | null
          confirmado_por?: string | null
          created_at?: string
          descripcion: string
          estatus?: Database["public"]["Enums"]["vale_gasolina_estatus"]
          folio: string
          id?: string
          ligado_at?: string | null
          ligado_por?: string | null
          monto_autorizado?: number | null
          monto_solicitado: number
          motivo_rechazo?: string | null
          obra_id?: string | null
          rechazado_at?: string | null
          rechazado_por?: string | null
          solicitado_at?: string
          solicitado_por: string
          tipo_combustible: Database["public"]["Enums"]["vale_gasolina_tipo"]
          updated_at?: string
        }
        Update: {
          autorizado_at?: string | null
          autorizado_por?: string | null
          cancelado_at?: string | null
          cancelado_por?: string | null
          codigo_vale?: string | null
          company_id?: string
          confirmado_at?: string | null
          confirmado_por?: string | null
          created_at?: string
          descripcion?: string
          estatus?: Database["public"]["Enums"]["vale_gasolina_estatus"]
          folio?: string
          id?: string
          ligado_at?: string | null
          ligado_por?: string | null
          monto_autorizado?: number | null
          monto_solicitado?: number
          motivo_rechazo?: string | null
          obra_id?: string | null
          rechazado_at?: string | null
          rechazado_por?: string | null
          solicitado_at?: string
          solicitado_por?: string
          tipo_combustible?: Database["public"]["Enums"]["vale_gasolina_tipo"]
          updated_at?: string
        }
        Relationships: []
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
      siguiente_codigo_insumo: {
        Args: { _categoria_id: string; _company_id: string }
        Returns: string
      }
      siguiente_folio_oc: { Args: { _company_id: string }; Returns: string }
      siguiente_folio_requisicion: {
        Args: { _company_id: string }
        Returns: string
      }
      siguiente_folio_sc: { Args: { _company_id: string }; Returns: string }
      siguiente_folio_vale_gasolina: {
        Args: { _company_id: string }
        Returns: string
      }
    }
    Enums: {
      almacen_semana_estatus: "abierta" | "cerrada"
      app_role:
        | "director"
        | "residente"
        | "auxiliar"
        | "administrativo"
        | "supervisor"
      destajo_doc_estatus: "borrador" | "enviado" | "autorizado" | "rechazado"
      destajo_estimacion_estatus: "borrador" | "cerrada"
      destajo_presupuesto_tipo: "base" | "adenda"
      estimacion_estatus: "borrador" | "cerrada"
      insumo_estatus: "autorizado" | "pendiente"
      nomina_estatus: "borrador" | "cerrada"
      oc_estatus:
        | "borrador"
        | "pendiente_autorizacion"
        | "autorizada"
        | "enviada"
        | "rechazada"
        | "pagada"
        | "recibida_parcial"
        | "recibida"
      presupuesto_estatus: "borrador" | "autorizado"
      presupuesto_movimiento:
        | "renglon"
        | "modificacion"
        | "adicion"
        | "eliminacion"
      presupuesto_tipo: "base" | "adenda"
      renta_estatus:
        | "borrador"
        | "cotizada"
        | "autorizada"
        | "rechazada"
        | "activa"
        | "devuelta"
      renta_evento_tipo: "averia" | "inactividad" | "nota"
      renta_periodicidad: "diaria" | "semanal" | "quincenal" | "mensual"
      renta_renovacion_estatus: "pendiente" | "autorizada" | "rechazada"
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
      vale_gasolina_estatus:
        | "pendiente_autorizacion"
        | "autorizado"
        | "rechazado"
        | "cancelado"
        | "entregado"
        | "confirmado"
      vale_gasolina_tipo: "magna" | "premium" | "diesel"
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
      almacen_semana_estatus: ["abierta", "cerrada"],
      app_role: [
        "director",
        "residente",
        "auxiliar",
        "administrativo",
        "supervisor",
      ],
      destajo_doc_estatus: ["borrador", "enviado", "autorizado", "rechazado"],
      destajo_estimacion_estatus: ["borrador", "cerrada"],
      destajo_presupuesto_tipo: ["base", "adenda"],
      estimacion_estatus: ["borrador", "cerrada"],
      insumo_estatus: ["autorizado", "pendiente"],
      nomina_estatus: ["borrador", "cerrada"],
      oc_estatus: [
        "borrador",
        "pendiente_autorizacion",
        "autorizada",
        "enviada",
        "rechazada",
        "pagada",
        "recibida_parcial",
        "recibida",
      ],
      presupuesto_estatus: ["borrador", "autorizado"],
      presupuesto_movimiento: [
        "renglon",
        "modificacion",
        "adicion",
        "eliminacion",
      ],
      presupuesto_tipo: ["base", "adenda"],
      renta_estatus: [
        "borrador",
        "cotizada",
        "autorizada",
        "rechazada",
        "activa",
        "devuelta",
      ],
      renta_evento_tipo: ["averia", "inactividad", "nota"],
      renta_periodicidad: ["diaria", "semanal", "quincenal", "mensual"],
      renta_renovacion_estatus: ["pendiente", "autorizada", "rechazada"],
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
      vale_gasolina_estatus: [
        "pendiente_autorizacion",
        "autorizado",
        "rechazado",
        "cancelado",
        "entregado",
        "confirmado",
      ],
      vale_gasolina_tipo: ["magna", "premium", "diesel"],
    },
  },
} as const
