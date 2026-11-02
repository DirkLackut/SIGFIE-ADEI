"use server";
/**
 * Acciones del acta (spec 002). Cada una comprueba el rol en el servidor; la base
 * vuelve a comprobar rol, grupo, estado del acta y fechas (D26). Después de un
 * cambio se refrescan las páginas que muestran esa acta.
 */
import { revalidatePath } from "next/cache";
import { exigirAcceso } from "./sesion";
import { clienteSesion } from "./supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import * as actas from "@/datos/actas";
import type { Decision, ParcialEnviado } from "@/datos/actas";

const rpc = async () => rpcDeSupabase(await clienteSesion());
const refrescar = (grupoId: string) => {
  revalidatePath(`/mis-grupos/${grupoId}`);
  revalidatePath(`/grupos/${grupoId}`);
  revalidatePath("/mis-grupos");
};

/** 002·CE-7 a CE-13 (profesor) y CE-48, CE-49 (Asistente, acta entregada). */
export async function accionGuardarParciales(grupoId: string, inscripcionId: string, parciales: ParcialEnviado[],
                                             version: number, motivo: string | null) {
  await exigirAcceso(["profesor", "asistente"]);
  const r = await actas.guardarParciales(await rpc(), inscripcionId, parciales, version, motivo);
  if (r.estado === "guardado") refrescar(grupoId);
  return r;
}

/** 002·CE-37 */
export async function accionAvisar(grupoId: string, inscripcionId: string, observacion: string) {
  await exigirAcceso(["profesor"]);
  const r = await actas.avisarInasistencia(await rpc(), inscripcionId, observacion);
  if (r.ok) refrescar(grupoId);
  return r;
}

/** 002·CE-42 a CE-46 */
export async function accionEntregar(grupoId: string, confirmar: boolean) {
  await exigirAcceso(["profesor"]);
  const r = await actas.entregarActa(await rpc(), grupoId, confirmar);
  if (r.estado === "entregada") refrescar(grupoId);
  return r;
}

/** 002·CE-32, CE-33 */
export async function accionReprogramar(grupoId: string, inscripcionId: string, numero: number, recibo: string) {
  await exigirAcceso(["asistente"]);
  const r = await actas.autorizarReprogramacion(await rpc(), inscripcionId, numero, recibo.trim() || null);
  if (r.ok) refrescar(grupoId);
  return r;
}

/** 002·CE-37 a CE-41 */
export async function accionDecidir(grupoId: string, inscripcionId: string, decision: Decision, motivo: string, confirmar: boolean) {
  await exigirAcceso(["asistente"]);
  const r = await actas.decidirSalida(await rpc(), inscripcionId, decision, motivo, confirmar);
  if (r.ok) refrescar(grupoId);
  return r;
}

/** 002·CE-29 a CE-31 */
export async function accionCondicionar(grupoId: string, inscripcionId: string, quitar: boolean, texto: string) {
  await exigirAcceso(["asistente"]);
  const r = quitar ? await actas.quitarCondicionado(await rpc(), inscripcionId, texto)
                   : await actas.condicionar(await rpc(), inscripcionId, texto);
  if (r.ok) refrescar(grupoId);
  return r;
}
