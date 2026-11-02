/**
 * Acta, parciales y regla de aprobación (spec 002). Las reglas las decide la base
 * (012); aquí solo se llaman las operaciones y se traducen sus errores.
 */
import type { Rpc, ErrorBD } from "./rpc";
import { traducirError } from "./errores";
import type { Condicion, EstadoAcademico } from "@/dominio/notas";

export interface ParcialBD {
  numero: number; condicion: Condicion; valor: number | null;
  reprogramacion_autorizada: string | null; recibo: string | null;
}

/** Lo que la base calcula de una inscripción (vista resultado_academico). */
export interface ResultadoBD {
  inscripcion_id: string; version: number; parciales: ParcialBD[]; faltan: number[];
  nota_exacta: number | null; nota_final: number | null; provisional: boolean; requiere_retiro: boolean;
  estado: EstadoAcademico | null; sin_regla: boolean; regla_provisional: boolean | null;
  nota_minima: number | null; condicionado_desde: number | null; en_franja: boolean;
  condicionado: boolean; justificacion_condicionado: string | null;
  aviso_inasistencia: string | null; baja_inasistencia: boolean;
  estado_inscripcion: "En curso" | "Completada" | "Retirada" | "Trasladada"; observaciones: string | null;
}

export interface FilaActa extends ResultadoBD { codigo_adei: string; nombres: string; apellidos: string }

export interface GrupoActa {
  id: string; codigo_grupo: string; nivel: string; programa: string; orden: number;
  modalidad: string; dias_de_clase: string; hora_inicio: string; hora_fin: string;
  sucursal: string; sucursal_direccion: string; profesor: string;
  fecha_inicio: string; fecha_termino: string; estado_acta: "Abierta" | "Entregada"; fecha_entrega_acta: string | null;
}

export interface Resumen {
  inscritos: number; aprobados: number; reprobados: number; condicionados: number;
  pendientes: number; retirados: number; trasladados: number; promedio: number | null;
}

export interface Permisos { capturar: boolean; entregar: boolean; asistente: boolean; modificar_entregada: boolean; reprogramar: boolean }

export type Acta =
  | { estado: "ok"; grupo: GrupoActa; permisos: Permisos; filas: FilaActa[]; resumen: Resumen }
  | { estado: "denegado" }
  | { estado: "no_existe" }
  | { estado: "error"; mensaje: string };

export interface GrupoProfesor {
  id: string; codigo_grupo: string; nivel: string; modalidad: string; dias_de_clase: string;
  hora_inicio: string; hora_fin: string; sucursal: string; fecha_inicio: string; fecha_termino: string;
  estado_acta: "Abierta" | "Entregada"; completas: number; total: number;
}

type Fallo = { ok: false; mensaje: string };
const fallo = (e: ErrorBD): Fallo => ({ ok: false, mensaje: traducirError(e).mensaje });

/** 002·CE-1 a CE-3 */
export async function misGrupos(rpc: Rpc): Promise<{ ok: true; grupos: GrupoProfesor[] } | Fallo> {
  const { data, error } = await rpc<GrupoProfesor[]>("mis_grupos");
  return error ? fallo(error) : { ok: true, grupos: data ?? [] };
}

/** 002·CE-4 a CE-6, CE-42, CE-58 */
export async function actaDelGrupo(rpc: Rpc, grupoId: string): Promise<Acta> {
  const { data, error } = await rpc<Acta>("acta_del_grupo", { p_grupo: grupoId });
  if (error) return error.code === "PT404" ? { estado: "no_existe" } : { estado: "error", mensaje: traducirError(error).mensaje };
  return data!;
}

/** Un parcial tal como lo manda la pantalla; condición vacía = sin condición. */
export interface ParcialEnviado { numero: number; condicion: Condicion | ""; valor: number | null }

export type RespuestaGuardar =
  | { estado: "guardado"; resultado: ResultadoBD }
  | { estado: "conflicto"; resultado: ResultadoBD }
  | { estado: "error"; mensaje: string };

/** 002·CE-7 a CE-13, CE-34, CE-47 a CE-49 */
export async function guardarParciales(rpc: Rpc, inscripcionId: string, parciales: ParcialEnviado[], version: number,
                                       motivo: string | null = null): Promise<RespuestaGuardar> {
  const { data, error } = await rpc<RespuestaGuardar>("guardar_parciales",
    { p_inscripcion: inscripcionId, p_parciales: parciales, p_version: version, p_motivo: motivo });
  return error ? { estado: "error", mensaje: traducirError(error).mensaje } : data!;
}

type ConResultado = { ok: true; resultado: ResultadoBD } | Fallo;
async function conResultado(rpc: Rpc, funcion: string, args: Record<string, unknown>): Promise<ConResultado> {
  const { data, error } = await rpc<{ resultado: ResultadoBD }>(funcion, args);
  return error ? fallo(error) : { ok: true, resultado: data!.resultado };
}

/** 002·CE-32, CE-33 */
export const autorizarReprogramacion = (rpc: Rpc, inscripcionId: string, numero: number, recibo: string | null) =>
  conResultado(rpc, "autorizar_reprogramacion", { p_inscripcion: inscripcionId, p_numero: numero, p_recibo: recibo });

/** 002·CE-37 */
export const avisarInasistencia = (rpc: Rpc, inscripcionId: string, observacion: string) =>
  conResultado(rpc, "avisar_inasistencia", { p_inscripcion: inscripcionId, p_observacion: observacion });

export type Decision = "retiro" | "baja" | "traslado" | "continua";

/** 002·CE-37 a CE-41. `advertir` = parciales con nota que dejarán de contar. */
export async function decidirSalida(rpc: Rpc, inscripcionId: string, decision: Decision, motivo: string, confirmar = false)
  : Promise<ConResultado | { ok: false; advertir: number }> {
  const { data, error } = await rpc<{ estado: string; parciales_con_nota?: number; resultado?: ResultadoBD }>("decidir_salida",
    { p_inscripcion: inscripcionId, p_decision: decision, p_motivo: motivo, p_confirmar: confirmar });
  if (error) return fallo(error);
  if (data!.estado === "advertir") return { ok: false, advertir: data!.parciales_con_nota ?? 0 };
  return { ok: true, resultado: data!.resultado! };
}

/** 002·CE-29, CE-30 */
export const condicionar = (rpc: Rpc, inscripcionId: string, justificacion: string) =>
  conResultado(rpc, "condicionar", { p_inscripcion: inscripcionId, p_justificacion: justificacion });

/** 002·CE-31 */
export const quitarCondicionado = (rpc: Rpc, inscripcionId: string, motivo: string) =>
  conResultado(rpc, "quitar_condicionado", { p_inscripcion: inscripcionId, p_motivo: motivo });

export interface Faltante {
  codigo_adei: string; nombres: string; apellidos: string; faltan: number[];
  aviso_sin_decidir: boolean; requiere_retiro: boolean;
}

export type RespuestaEntrega =
  | { estado: "incompleta"; faltan: Faltante[] }
  | { estado: "sin_calificaciones" }
  | { estado: "resumen"; resumen: Resumen }
  | { estado: "entregada"; fecha_entrega_acta: string; resumen: Resumen }
  | { estado: "error"; mensaje: string };

/** 002·CE-42 a CE-46 */
export async function entregarActa(rpc: Rpc, grupoId: string, confirmar = false): Promise<RespuestaEntrega> {
  const { data, error } = await rpc<RespuestaEntrega>("entregar_acta", { p_grupo: grupoId, p_confirmar: confirmar });
  return error ? { estado: "error", mensaje: traducirError(error).mensaje } : data!;
}

export interface DatosRegla {
  id?: string; programa: string; nivel_desde: number; nivel_hasta: number; vigente_desde: string;
  nota_minima: number; condicionado_desde: number | null; nota_condicion: number | null; provisional: boolean;
}

/** 002·CE-25 a CE-28 */
export async function guardarRegla(rpc: Rpc, d: DatosRegla): Promise<{ ok: true; id: string } | Fallo> {
  const { data, error } = await rpc<{ id: string }>("guardar_regla", { p_datos: d });
  return error ? fallo(error) : { ok: true, id: data!.id };
}

export async function eliminarRegla(rpc: Rpc, id: string): Promise<{ ok: true } | Fallo> {
  const { error } = await rpc("eliminar_regla", { p_id: id });
  return error ? fallo(error) : { ok: true };
}
