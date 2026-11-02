"use server";
import { revalidatePath } from "next/cache";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { inscribir, anularInscripcion, cambiarProfesor, type RespuestaInscripcion } from "@/datos/grupos";

/** CE-54 a CE-57, CE-84, CE-93. */
/** 002·CE-54 a CE-56: con antecedentes, la base pide un motivo. */
export async function accionInscribir(grupoId: string, estudianteId: string, confirmar: boolean,
                                      motivo: string | null = null): Promise<RespuestaInscripcion> {
  await exigirAcceso(["asistente"]);
  const r = await inscribir(rpcDeSupabase(await clienteSesion()), estudianteId, grupoId, confirmar, motivo);
  if (r.estado === "inscrito") revalidatePath(`/grupos/${grupoId}`);
  return r;
}

export interface EstadoAccion { ok?: boolean; mensaje?: string }

/** CE-58, CE-59. */
export async function accionAnular(_p: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAcceso(["asistente"]);
  const r = await anularInscripcion(rpcDeSupabase(await clienteSesion()), String(datos.get("inscripcion")), String(datos.get("motivo") ?? ""));
  if (r.ok) revalidatePath(`/grupos/${datos.get("grupo")}`);
  return r.ok ? { ok: true, mensaje: "Inscripción anulada. Sus datos quedan en la auditoría." } : { ok: false, mensaje: r.mensaje };
}

/** CE-51 a CE-53. */
export async function accionCambiarProfesor(_p: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAcceso(["asistente"]);
  const profesor = String(datos.get("profesor_id") ?? "");
  if (!profesor) return { ok: false, mensaje: "Elija el profesor nuevo." };
  const grupo = String(datos.get("grupo"));
  const r = await cambiarProfesor(rpcDeSupabase(await clienteSesion()), grupo, profesor, String(datos.get("motivo") ?? ""));
  if (r.ok) revalidatePath(`/grupos/${grupo}`);
  return r.ok ? { ok: true, mensaje: "Profesor cambiado. El anterior ya no ve este grupo." } : { ok: false, mensaje: r.mensaje };
}
