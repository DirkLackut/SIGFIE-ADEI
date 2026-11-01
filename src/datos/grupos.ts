/** Grupos e inscripciones (T24). Las reglas las decide la base (008). */
import type { Rpc } from "./rpc";
import { traducirError } from "./errores";

export interface DatosGrupo {
  nivel_id: string; modalidad_id: string; horario_id: string; profesor_id: string;
  sucursal_id: string; fecha_inicio: string; fecha_termino: string;
}

export async function abrirGrupo(rpc: Rpc, d: DatosGrupo) {
  const { data, error } = await rpc<{ estado: "abierto"; id: string; codigo_grupo: string }>("abrir_grupo", { p_datos: d });
  return error ? { estado: "error" as const, ...traducirError(error) } : data!;
}

export type RespuestaInscripcion =
  | { estado: "inscrito"; id: string }
  | { estado: "ya_inscrito" }
  | { estado: "superposicion"; grupos: { grupo_id: string; codigo_grupo: string }[] }
  | { estado: "error"; mensaje: string };

export async function inscribir(rpc: Rpc, estudianteId: string, grupoId: string, confirmar = false): Promise<RespuestaInscripcion> {
  const { data, error } = await rpc<RespuestaInscripcion>("inscribir", { p_estudiante: estudianteId, p_grupo: grupoId, p_confirmar: confirmar });
  return error ? { estado: "error", mensaje: traducirError(error).mensaje } : data!;
}

export async function anularInscripcion(rpc: Rpc, inscripcionId: string, motivo: string) {
  const { error } = await rpc("anular_inscripcion", { p_inscripcion: inscripcionId, p_motivo: motivo });
  return error ? { ok: false as const, mensaje: traducirError(error).mensaje } : { ok: true as const };
}

export async function cambiarProfesor(rpc: Rpc, grupoId: string, profesorId: string, motivo: string) {
  const { error } = await rpc("cambiar_profesor", { p_grupo: grupoId, p_profesor: profesorId, p_motivo: motivo });
  return error ? { ok: false as const, mensaje: traducirError(error).mensaje } : { ok: true as const };
}
