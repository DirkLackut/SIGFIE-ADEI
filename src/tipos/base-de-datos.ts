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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      aceptacion_privacidad: {
        Row: {
          fecha_hora: string
          id: number
          organizacion_id: string
          sesion: string
          usuario_id: string
          version: string
        }
        Insert: {
          fecha_hora?: string
          id?: never
          organizacion_id: string
          sesion: string
          usuario_id: string
          version: string
        }
        Update: {
          fecha_hora?: string
          id?: never
          organizacion_id?: string
          sesion?: string
          usuario_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "aceptacion_privacidad_organizacion_id_usuario_id_fkey"
            columns: ["organizacion_id", "usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "aceptacion_privacidad_organizacion_id_version_fkey"
            columns: ["organizacion_id", "version"]
            isOneToOne: false
            referencedRelation: "aviso_privacidad"
            referencedColumns: ["organizacion_id", "version"]
          },
        ]
      }
      auditoria: {
        Row: {
          detalle: string | null
          entidad: string
          fecha_hora: string
          id: number
          organizacion_id: string | null
          registro_afectado: string | null
          tipo_accion: string
          usuario_id: string | null
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          detalle?: string | null
          entidad: string
          fecha_hora?: string
          id?: never
          organizacion_id?: string | null
          registro_afectado?: string | null
          tipo_accion: string
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          detalle?: string | null
          entidad?: string
          fecha_hora?: string
          id?: never
          organizacion_id?: string | null
          registro_afectado?: string | null
          tipo_accion?: string
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      aviso_privacidad: {
        Row: {
          organizacion_id: string
          texto: string
          version: string
          vigente_desde: string
        }
        Insert: {
          organizacion_id: string
          texto: string
          version: string
          vigente_desde?: string
        }
        Update: {
          organizacion_id?: string
          texto?: string
          version?: string
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "aviso_privacidad_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      calificacion: {
        Row: {
          aviso_inasistencia: string | null
          aviso_inasistencia_en: string | null
          baja_inasistencia: boolean
          condicionado: boolean
          inscripcion_id: string
          justificacion_condicionado: string | null
          organizacion_id: string
          version: number
        }
        Insert: {
          aviso_inasistencia?: string | null
          aviso_inasistencia_en?: string | null
          baja_inasistencia?: boolean
          condicionado?: boolean
          inscripcion_id: string
          justificacion_condicionado?: string | null
          organizacion_id?: string
          version?: number
        }
        Update: {
          aviso_inasistencia?: string | null
          aviso_inasistencia_en?: string | null
          baja_inasistencia?: boolean
          condicionado?: boolean
          inscripcion_id?: string
          justificacion_condicionado?: string | null
          organizacion_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calificacion_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calificacion_organizacion_id_inscripcion_id_fkey"
            columns: ["organizacion_id", "inscripcion_id"]
            isOneToOne: false
            referencedRelation: "inscripcion"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "calificacion_organizacion_id_inscripcion_id_fkey"
            columns: ["organizacion_id", "inscripcion_id"]
            isOneToOne: false
            referencedRelation: "resultado_academico"
            referencedColumns: ["organizacion_id", "inscripcion_id"]
          },
        ]
      }
      correlativo: {
        Row: {
          anio: number
          organizacion_id: string
          tipo: string
          ultimo: number
        }
        Insert: {
          anio: number
          organizacion_id: string
          tipo: string
          ultimo: number
        }
        Update: {
          anio?: number
          organizacion_id?: string
          tipo?: string
          ultimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "correlativo_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      estudiante: {
        Row: {
          apellidos: string
          busqueda: string | null
          cedula: string | null
          codigo_adei: string
          contacto_emergencia: string | null
          correo: string | null
          creado_en: string
          direccion: string | null
          estado_matricula: string
          fecha_cambio_estado: string | null
          fecha_nacimiento: string
          id: string
          nombres: string
          organizacion_id: string
          origen_registro: string
          sucursal_id: string
          telefono: string | null
          version: number
        }
        Insert: {
          apellidos: string
          busqueda?: string | null
          cedula?: string | null
          codigo_adei: string
          contacto_emergencia?: string | null
          correo?: string | null
          creado_en?: string
          direccion?: string | null
          estado_matricula?: string
          fecha_cambio_estado?: string | null
          fecha_nacimiento: string
          id?: string
          nombres: string
          organizacion_id?: string
          origen_registro?: string
          sucursal_id: string
          telefono?: string | null
          version?: number
        }
        Update: {
          apellidos?: string
          busqueda?: string | null
          cedula?: string | null
          codigo_adei?: string
          contacto_emergencia?: string | null
          correo?: string | null
          creado_en?: string
          direccion?: string | null
          estado_matricula?: string
          fecha_cambio_estado?: string | null
          fecha_nacimiento?: string
          id?: string
          nombres?: string
          organizacion_id?: string
          origen_registro?: string
          sucursal_id?: string
          telefono?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "estudiante_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estudiante_organizacion_id_sucursal_id_fkey"
            columns: ["organizacion_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursal"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      estudiante_tutor: {
        Row: {
          estudiante_id: string
          organizacion_id: string
          tutor_id: string
        }
        Insert: {
          estudiante_id: string
          organizacion_id?: string
          tutor_id: string
        }
        Update: {
          estudiante_id?: string
          organizacion_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estudiante_tutor_organizacion_id_estudiante_id_fkey"
            columns: ["organizacion_id", "estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiante"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "estudiante_tutor_organizacion_id_tutor_id_fkey"
            columns: ["organizacion_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutor"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      grupo: {
        Row: {
          codigo_grupo: string
          estado_acta: string
          fecha_entrega_acta: string | null
          fecha_inicio: string
          fecha_termino: string
          horario_id: string
          id: string
          nivel_id: string
          organizacion_id: string
          profesor_id: string
          sucursal_id: string
        }
        Insert: {
          codigo_grupo: string
          estado_acta?: string
          fecha_entrega_acta?: string | null
          fecha_inicio: string
          fecha_termino: string
          horario_id: string
          id?: string
          nivel_id: string
          organizacion_id?: string
          profesor_id: string
          sucursal_id: string
        }
        Update: {
          codigo_grupo?: string
          estado_acta?: string
          fecha_entrega_acta?: string | null
          fecha_inicio?: string
          fecha_termino?: string
          horario_id?: string
          id?: string
          nivel_id?: string
          organizacion_id?: string
          profesor_id?: string
          sucursal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupo_organizacion_id_horario_id_fkey"
            columns: ["organizacion_id", "horario_id"]
            isOneToOne: false
            referencedRelation: "horario"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "grupo_organizacion_id_nivel_id_fkey"
            columns: ["organizacion_id", "nivel_id"]
            isOneToOne: false
            referencedRelation: "nivel"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "grupo_organizacion_id_profesor_id_fkey"
            columns: ["organizacion_id", "profesor_id"]
            isOneToOne: false
            referencedRelation: "profesor"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "grupo_organizacion_id_sucursal_id_fkey"
            columns: ["organizacion_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursal"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      horario: {
        Row: {
          activo: boolean
          hora_fin: string
          hora_inicio: string
          id: string
          modalidad_id: string
          organizacion_id: string
        }
        Insert: {
          activo?: boolean
          hora_fin: string
          hora_inicio: string
          id?: string
          modalidad_id: string
          organizacion_id?: string
        }
        Update: {
          activo?: boolean
          hora_fin?: string
          hora_inicio?: string
          id?: string
          modalidad_id?: string
          organizacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horario_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horario_organizacion_id_modalidad_id_fkey"
            columns: ["organizacion_id", "modalidad_id"]
            isOneToOne: false
            referencedRelation: "modalidad"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      inscripcion: {
        Row: {
          estado_inscripcion: string
          estudiante_id: string
          fecha_inscripcion: string
          grupo_id: string
          id: string
          observaciones: string | null
          organizacion_id: string
        }
        Insert: {
          estado_inscripcion?: string
          estudiante_id: string
          fecha_inscripcion?: string
          grupo_id: string
          id?: string
          observaciones?: string | null
          organizacion_id?: string
        }
        Update: {
          estado_inscripcion?: string
          estudiante_id?: string
          fecha_inscripcion?: string
          grupo_id?: string
          id?: string
          observaciones?: string | null
          organizacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscripcion_organizacion_id_estudiante_id_fkey"
            columns: ["organizacion_id", "estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiante"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "inscripcion_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_organizacion_id_grupo_id_fkey"
            columns: ["organizacion_id", "grupo_id"]
            isOneToOne: false
            referencedRelation: "grupo"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      modalidad: {
        Row: {
          activo: boolean
          dias_de_clase: string
          id: string
          nombre: string
          organizacion_id: string
        }
        Insert: {
          activo?: boolean
          dias_de_clase: string
          id?: string
          nombre: string
          organizacion_id?: string
        }
        Update: {
          activo?: boolean
          dias_de_clase?: string
          id?: string
          nombre?: string
          organizacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modalidad_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      nivel: {
        Row: {
          activo: boolean
          codigo: string
          id: string
          nombre: string
          orden: number
          organizacion_id: string
          programa: string
          publico: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          id?: string
          nombre: string
          orden: number
          organizacion_id?: string
          programa: string
          publico: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          id?: string
          nombre?: string
          orden?: number
          organizacion_id?: string
          programa?: string
          publico?: string
        }
        Relationships: [
          {
            foreignKeyName: "nivel_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacion: {
        Row: {
          codigo: string
          creado_en: string
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          creado_en?: string
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          creado_en?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      parcial: {
        Row: {
          condicion: string
          id: string
          inscripcion_id: string
          numero: number
          organizacion_id: string
          recibo_reprogramacion: string | null
          reprogramacion_autorizada: string | null
          valor: number | null
        }
        Insert: {
          condicion: string
          id?: string
          inscripcion_id: string
          numero: number
          organizacion_id?: string
          recibo_reprogramacion?: string | null
          reprogramacion_autorizada?: string | null
          valor?: number | null
        }
        Update: {
          condicion?: string
          id?: string
          inscripcion_id?: string
          numero?: number
          organizacion_id?: string
          recibo_reprogramacion?: string | null
          reprogramacion_autorizada?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcial_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcial_organizacion_id_inscripcion_id_fkey"
            columns: ["organizacion_id", "inscripcion_id"]
            isOneToOne: false
            referencedRelation: "inscripcion"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "parcial_organizacion_id_inscripcion_id_fkey"
            columns: ["organizacion_id", "inscripcion_id"]
            isOneToOne: false
            referencedRelation: "resultado_academico"
            referencedColumns: ["organizacion_id", "inscripcion_id"]
          },
        ]
      }
      profesor: {
        Row: {
          activo: boolean
          apellidos: string
          id: string
          nombres: string
          organizacion_id: string
          telefono: string
        }
        Insert: {
          activo?: boolean
          apellidos: string
          id?: string
          nombres: string
          organizacion_id?: string
          telefono: string
        }
        Update: {
          activo?: boolean
          apellidos?: string
          id?: string
          nombres?: string
          organizacion_id?: string
          telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "profesor_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      regla_aprobacion: {
        Row: {
          condicionado_desde: number | null
          creado_en: string
          id: string
          nivel_desde: number
          nivel_hasta: number
          nota_condicion: number | null
          nota_minima: number
          organizacion_id: string
          programa: string
          provisional: boolean
          vigente_desde: string
        }
        Insert: {
          condicionado_desde?: number | null
          creado_en?: string
          id?: string
          nivel_desde: number
          nivel_hasta: number
          nota_condicion?: number | null
          nota_minima: number
          organizacion_id?: string
          programa: string
          provisional?: boolean
          vigente_desde: string
        }
        Update: {
          condicionado_desde?: number | null
          creado_en?: string
          id?: string
          nivel_desde?: number
          nivel_hasta?: number
          nota_condicion?: number | null
          nota_minima?: number
          organizacion_id?: string
          programa?: string
          provisional?: boolean
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "regla_aprobacion_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursal: {
        Row: {
          direccion: string
          es_central: boolean
          id: string
          nombre: string
          organizacion_id: string
          telefono: string | null
        }
        Insert: {
          direccion: string
          es_central?: boolean
          id?: string
          nombre: string
          organizacion_id?: string
          telefono?: string | null
        }
        Update: {
          direccion?: string
          es_central?: boolean
          id?: string
          nombre?: string
          organizacion_id?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucursal_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor: {
        Row: {
          cedula: string
          id: string
          nombre_completo: string
          organizacion_id: string
          telefono: string
        }
        Insert: {
          cedula: string
          id?: string
          nombre_completo: string
          organizacion_id?: string
          telefono: string
        }
        Update: {
          cedula?: string
          id?: string
          nombre_completo?: string
          organizacion_id?: string
          telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario: {
        Row: {
          contrasena_temporal_emitida: string | null
          correo: string | null
          creado_en: string
          debe_cambiar_contrasena: boolean
          estado: string
          id: string
          nombre_usuario: string
          organizacion_id: string
          profesor_id: string | null
          ultimo_acceso: string | null
        }
        Insert: {
          contrasena_temporal_emitida?: string | null
          correo?: string | null
          creado_en?: string
          debe_cambiar_contrasena?: boolean
          estado?: string
          id: string
          nombre_usuario: string
          organizacion_id: string
          profesor_id?: string | null
          ultimo_acceso?: string | null
        }
        Update: {
          contrasena_temporal_emitida?: string | null
          correo?: string | null
          creado_en?: string
          debe_cambiar_contrasena?: boolean
          estado?: string
          id?: string
          nombre_usuario?: string
          organizacion_id?: string
          profesor_id?: string | null
          ultimo_acceso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuario_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_organizacion_id_profesor_id_fkey"
            columns: ["organizacion_id", "profesor_id"]
            isOneToOne: false
            referencedRelation: "profesor"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      usuario_rol: {
        Row: {
          organizacion_id: string
          rol: Database["public"]["Enums"]["rol"]
          usuario_id: string
        }
        Insert: {
          organizacion_id: string
          rol: Database["public"]["Enums"]["rol"]
          usuario_id: string
        }
        Update: {
          organizacion_id?: string
          rol?: Database["public"]["Enums"]["rol"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_rol_organizacion_id_usuario_id_fkey"
            columns: ["organizacion_id", "usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
    }
    Views: {
      resultado_academico: {
        Row: {
          aviso_inasistencia: string | null
          aviso_inasistencia_en: string | null
          baja_inasistencia: boolean | null
          condicionado: boolean | null
          condicionado_desde: number | null
          considerados: number | null
          en_franja: boolean | null
          estado_academico: string | null
          estado_acta: string | null
          estado_inscripcion: string | null
          estudiante_id: string | null
          excluida: boolean | null
          faltan: number[] | null
          fecha_inicio: string | null
          fecha_inscripcion: string | null
          fecha_termino: string | null
          filas: number | null
          grupo_id: string | null
          inscripcion_id: string | null
          justificacion_condicionado: string | null
          justificados: number | null
          nivel: string | null
          nivel_id: string | null
          nota_condicion: number | null
          nota_exacta: number | null
          nota_final: number | null
          nota_minima: number | null
          observaciones: string | null
          orden: number | null
          organizacion_id: string | null
          parciales: Json | null
          posicion: number | null
          programa: string | null
          provisional: boolean | null
          regla_id: string | null
          regla_provisional: boolean | null
          requiere_retiro: boolean | null
          ruta: string | null
          sin_regla: boolean | null
          suma: number | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inscripcion_organizacion_id_estudiante_id_fkey"
            columns: ["organizacion_id", "estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiante"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "inscripcion_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_organizacion_id_grupo_id_fkey"
            columns: ["organizacion_id", "grupo_id"]
            isOneToOne: false
            referencedRelation: "grupo"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
    }
    Functions: {
      abrir_grupo: { Args: { p_datos: Json }; Returns: Json }
      acceso_habilitado: { Args: never; Returns: boolean }
      aceptar_aviso: { Args: { p_version: string }; Returns: undefined }
      acta_del_grupo: { Args: { p_grupo: string }; Returns: Json }
      actualizar_estudiante: {
        Args: { p_datos: Json; p_id: string; p_version: number }
        Returns: Json
      }
      anular_inscripcion: {
        Args: { p_inscripcion: string; p_motivo: string }
        Returns: undefined
      }
      asignar_roles: {
        Args: {
          p_profesor: string
          p_roles: Database["public"]["Enums"]["rol"][]
          p_usuario: string
        }
        Returns: undefined
      }
      autorizar_reprogramacion: {
        Args: { p_inscripcion: string; p_numero: number; p_recibo?: string }
        Returns: Json
      }
      avisar_inasistencia: {
        Args: { p_inscripcion: string; p_observacion: string }
        Returns: Json
      }
      aviso_vigente: { Args: { p_organizacion: string }; Returns: string }
      buscar_estudiantes: {
        Args: { p_pagina?: number; p_texto: string }
        Returns: Json
      }
      cambiar_profesor: {
        Args: { p_grupo: string; p_motivo: string; p_profesor: string }
        Returns: undefined
      }
      condicionar: {
        Args: { p_inscripcion: string; p_justificacion: string }
        Returns: Json
      }
      crear_cuenta: {
        Args: {
          p_correo: string
          p_id: string
          p_nombre_usuario: string
          p_profesor: string
          p_roles: Database["public"]["Enums"]["rol"][]
        }
        Returns: undefined
      }
      decidir_salida: {
        Args: {
          p_confirmar?: boolean
          p_decision: string
          p_inscripcion: string
          p_motivo: string
        }
        Returns: Json
      }
      desvincular_tutor: {
        Args: { p_estudiante: string; p_tutor: string }
        Returns: undefined
      }
      edad: { Args: { hoy: string; nacimiento: string }; Returns: number }
      eliminar_regla: { Args: { p_id: string }; Returns: undefined }
      entregar_acta: {
        Args: { p_confirmar?: boolean; p_grupo: string }
        Returns: Json
      }
      guardar_parciales: {
        Args: {
          p_inscripcion: string
          p_motivo?: string
          p_parciales: Json
          p_version: number
        }
        Returns: Json
      }
      guardar_regla: { Args: { p_datos: Json }; Returns: Json }
      hoy_managua: { Args: never; Returns: string }
      inscribir: {
        Args: {
          p_confirmar?: boolean
          p_estudiante: string
          p_grupo: string
          p_motivo?: string
        }
        Returns: Json
      }
      mi_estado_acceso: { Args: never; Returns: Json }
      mi_organizacion: { Args: never; Returns: string }
      mi_profesor_id: { Args: never; Returns: string }
      mis_grupos: { Args: never; Returns: Json }
      normalizar: { Args: { texto: string }; Returns: string }
      quitar_condicionado: {
        Args: { p_inscripcion: string; p_motivo: string }
        Returns: Json
      }
      registrar_estudiante: {
        Args: { p_confirmar_distinto?: boolean; p_datos: Json }
        Returns: Json
      }
      registrar_evento: {
        Args: {
          p_detalle?: string
          p_entidad: string
          p_registro?: string
          p_tipo: string
        }
        Returns: undefined
      }
      registrar_ingreso_denegado: {
        Args: { p_detalle?: string; p_nombre_usuario: string }
        Returns: undefined
      }
      siguiente_correlativo: {
        Args: { p_anio: number; p_organizacion: string; p_tipo: string }
        Returns: number
      }
      tiene_rol: {
        Args: { p_rol: Database["public"]["Enums"]["rol"] }
        Returns: boolean
      }
      vincular_tutor: {
        Args: { p_estudiante: string; p_tutor: Json }
        Returns: string
      }
    }
    Enums: {
      rol: "asistente" | "direccion" | "profesor" | "admin_tecnico"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      rol: ["asistente", "direccion", "profesor", "admin_tecnico"],
    },
  },
} as const
