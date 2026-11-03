/**
 * Consulta y reportes (spec 003). Las reglas y los permisos los decide la base
 * (014); aquí solo se llaman las operaciones y se traducen sus errores.
 */
import type { Rpc, ErrorBD } from "./rpc";
import { traducirError } from "./errores";
import type { Criterios, Vista } from "@/dominio/filtro";
import type { FilaEstudiante, FilaInscripcion, RespaldoArchivo } from "@/dominio/exportacion";
import type { DatosHoja } from "@/dominio/hoja-matricula";
import type { ParcialImpreso } from "@/dominio/acta-impresa";

export type Destino = "pantalla" | "exportar" | "imprimir";
type Error_ = { estado: "error"; mensaje: string };
const error = (e: ErrorBD): Error_ => ({ estado: "error", mensaje: traducirError(e).mensaje });

// --------------------------------------------------------------------- filtrado
export type Filtrado =
  | { estado: "ok"; vista: "inscripciones"; total: number; pagina: number; por_pagina: number; filas: FilaInscripcion[] }
  | { estado: "ok"; vista: "estudiantes"; total: number; pagina: number; por_pagina: number; filas: FilaEstudiante[] }
  | { estado: "criterios_invalidos"; campo: string; mensaje: string }
  | { estado: "incompleto"; total: number; esperados: number; obtenidos: number }
  | { estado: "denegado" }
  | Error_;

/** CE-1 a CE-28 */
export async function filtrar(rpc: Rpc, criterios: Criterios, vista: Vista, pagina: number, destino: Destino): Promise<Filtrado> {
  const { data, error: e } = await rpc<Filtrado>("filtrar", { p_criterios: criterios, p_vista: vista, p_pagina: pagina, p_destino: destino });
  return e ? error(e) : data!;
}

// -------------------------------------------------------------------- historial
export interface FacturaBD {
  id: string; serie: string; numero: number; fecha_emision: string; monto: number; moneda: string; forma_pago: string;
  inscripcion_id: string | null; version: number; codigo_grupo?: string | null; amparados?: number;
  otros_amparados?: { id: string; codigo_adei: string; nombre: string }[];
}
export interface InscripcionHistorial {
  id: string; grupo_id: string; codigo_grupo: string; programa: string; nivel: string; modalidad: string;
  hora_inicio: string; hora_fin: string; profesor: string; sucursal: string; fecha_inicio: string; fecha_termino: string;
  estado_acta: string; estado_inscripcion: string; parciales: ParcialImpreso[]; nota_final: number | null;
  provisional: boolean; estado_academico: string | null; condicionado: boolean; justificacion_condicionado: string | null;
  factura: FacturaBD | null;
}
export interface EstudianteHistorial {
  id: string; codigo_adei: string; nombres: string; apellidos: string; cedula: string | null; sucursal: string;
  estado_matricula: string; fecha_cambio_estado: string | null; origen_registro: string;
}
export type Historial =
  | { estado: "ok"; estudiante: EstudianteHistorial; inscripciones: InscripcionHistorial[]; facturas: FacturaBD[] }
  | { estado: "denegado" } | { estado: "no_existe" } | Error_;

/** CE-36 a CE-42, CE-65 */
export async function historialAcademico(rpc: Rpc, estudianteId: string): Promise<Historial> {
  const { data, error: e } = await rpc<Historial>("historial_academico", { p_estudiante: estudianteId });
  if (e) return e.code === "PT404" ? { estado: "no_existe" } : error(e);
  return data!;
}

export type Hoja = ({ estado: "ok" } & DatosHoja) | { estado: "denegado" } | { estado: "no_existe" } | Error_;
/** CE-44 a CE-51 */
export async function hojaMatricula(rpc: Rpc, inscripcionId: string): Promise<Hoja> {
  const { data, error: e } = await rpc<Hoja>("hoja_matricula", { p_inscripcion: inscripcionId });
  if (e) return e.code === "PT404" ? { estado: "no_existe" } : error(e);
  return data!;
}

// ------------------------------------------------------------- panel y reporte
export interface GrupoPanel {
  grupo_id: string; codigo_grupo: string; nivel: string; modalidad: string; hora_inicio: string; hora_fin: string;
  fecha_inicio: string; fecha_termino: string; estado_acta: string; fecha_entrega_acta: string | null; vencida: boolean;
  completas: number; total: number;
}
export interface ConteoActas { grupos: number; entregadas: number; pendientes: number; vencidas: number }
export interface ProfesorPanel extends ConteoActas { profesor_id: string; profesor: string; detalle: GrupoPanel[] }
export type Panel =
  | { estado: "ok"; desde: string; hasta: string; hoy: string; totales: ConteoActas; profesores: ProfesorPanel[] }
  | { estado: "incompleto" } | { estado: "denegado" } | Error_;

/** CE-75 a CE-80 */
export async function panelActas(rpc: Rpc, desde: string | null, hasta: string | null): Promise<Panel> {
  const { data, error: e } = await rpc<Panel>("panel_actas", { p_desde: desde, p_hasta: hasta });
  return e ? error(e) : data!;
}

export interface ConteoSucursal {
  activos: number; desertores: number; egresados: number; total: number; registrados: number; a_desertor: number; a_egresado: number;
}
export interface FilaReporte extends ConteoSucursal { sucursal_id: string; sucursal: string }
export type Reporte =
  | { estado: "ok"; desde: string; hasta: string; sucursales: FilaReporte[]; totales: ConteoSucursal; sin_datos: boolean }
  | { estado: "incompleto" } | { estado: "denegado" } | { estado: "no_existe" } | Error_;

/** CE-81 a CE-86 */
export async function reporteSucursales(rpc: Rpc, desde: string | null, hasta: string | null, sucursal: string | null): Promise<Reporte> {
  const { data, error: e } = await rpc<Reporte>("reporte_sucursales", { p_desde: desde, p_hasta: hasta, p_sucursal: sucursal });
  if (e) return e.code === "PT404" ? { estado: "no_existe" } : error(e);
  return data!;
}

// ----------------------------------------------------------------- bitácora
export interface RegistroBitacora {
  id: number; fecha_hora: string; usuario: string | null; tipo_accion: string; entidad: string;
  registro_afectado: string | null; detalle: string | null; cambios: { campo: string; anterior: unknown; nuevo: unknown }[];
}
export interface FiltrosBitacora { desde?: string; hasta?: string; usuario_id?: string; tipo_accion?: string; entidad?: string }
export type Bitacora =
  | { estado: "ok"; total: number; pagina: number; por_pagina: number; filas: RegistroBitacora[];
      usuarios: { id: string; nombre_usuario: string }[]; entidades: string[] }
  | { estado: "criterios_invalidos"; campo: string; mensaje: string } | { estado: "denegado" } | Error_;

/** CE-89 a CE-94 */
export async function bitacora(rpc: Rpc, filtros: FiltrosBitacora, pagina: number): Promise<Bitacora> {
  const { data, error: e } = await rpc<Bitacora>("bitacora", { p_filtros: filtros, p_pagina: pagina });
  return e ? error(e) : data!;
}

// ----------------------------------------------------------------- respaldo
export type Respaldo = ({ estado: "ok" } & RespaldoArchivo) | { estado: "incompleto"; hojas: string } | { estado: "denegado" } | Error_;
/** CE-31 a CE-35. La llama el navegador (plan §6): pesa demasiado para pasar por Vercel. */
export async function respaldo(rpc: Rpc): Promise<Respaldo> {
  const { data, error: e } = await rpc<Respaldo>("respaldo");
  return e ? error(e) : data!;
}
