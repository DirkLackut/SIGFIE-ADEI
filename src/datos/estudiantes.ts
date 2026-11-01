/**
 * Registro y edición de estudiantes (T22). Arma lo que la base espera y traduce
 * su respuesta a algo que la pantalla puede mostrar. Las reglas las decide la
 * base (registrar_estudiante, actualizar_estudiante: migración 008).
 */
import type { Rpc } from "./rpc";
import { traducirError } from "./errores";

export interface Candidato {
  id: string; codigo_adei: string; nombres: string; apellidos: string; cedula: string | null; fecha_nacimiento: string;
}
export interface DatosTutor { cedula: string; nombre_completo?: string; telefono?: string }
export interface DatosEstudiante {
  cedula?: string; nombres: string; apellidos: string; fecha_nacimiento: string;
  telefono?: string; correo?: string; direccion?: string; contacto_emergencia?: string;
  sucursal_id: string; tutores?: DatosTutor[];
}

export type RespuestaRegistro =
  | { estado: "registrado"; id: string; codigo_adei: string }
  | { estado: "cedula_existente"; expediente: Pick<Candidato, "id" | "codigo_adei" | "nombres" | "apellidos"> }
  | { estado: "coincidencias" | "completar"; candidatos: Candidato[] }
  | { estado: "error"; campo?: string; mensaje: string };

export async function registrarEstudiante(rpc: Rpc, datos: DatosEstudiante, confirmarDistinto = false): Promise<RespuestaRegistro> {
  const { data, error } = await rpc<RespuestaRegistro>("registrar_estudiante",
    { p_datos: datos, p_confirmar_distinto: confirmarDistinto });
  if (error) return { estado: "error", ...traducirError(error) };
  return data!;
}

export type RespuestaEdicion =
  | { estado: "actualizado"; version: number; advertencias: string[] }
  | { estado: "conflicto" }
  | { estado: "cedula_existente"; expediente: Pick<Candidato, "id" | "codigo_adei" | "nombres" | "apellidos"> }
  | { estado: "error"; campo?: string; mensaje: string };

export async function actualizarEstudiante(rpc: Rpc, id: string, version: number, cambios: Partial<DatosEstudiante>): Promise<RespuestaEdicion> {
  const { data, error } = await rpc<RespuestaEdicion>("actualizar_estudiante", { p_id: id, p_version: version, p_datos: cambios });
  if (error) return { estado: "error", ...traducirError(error) };
  return data!;
}

export async function vincularTutor(rpc: Rpc, estudianteId: string, tutor: DatosTutor | { id: string }) {
  const { error } = await rpc("vincular_tutor", { p_estudiante: estudianteId, p_tutor: tutor });
  return error ? { ok: false as const, ...traducirError(error) } : { ok: true as const };
}

export async function desvincularTutor(rpc: Rpc, estudianteId: string, tutorId: string) {
  const { error } = await rpc("desvincular_tutor", { p_estudiante: estudianteId, p_tutor: tutorId });
  return error ? { ok: false as const, ...traducirError(error) } : { ok: true as const };
}

/** Quita los campos vacíos: la base trata "" como dato y fallaría su formato. */
export function limpiarVacios<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as T;
}
