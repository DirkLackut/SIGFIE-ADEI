"use server";
import { revalidatePath } from "next/cache";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { guardarRegla, eliminarRegla } from "@/datos/actas";
import { revisarRegla } from "@/dominio/regla";

export interface EstadoRegla { ok?: boolean; mensaje?: string; errores?: Record<string, string>; marca?: number }

const CAMPOS = ["programa", "nivel_desde", "nivel_hasta", "vigente_desde", "nota_minima", "condicionado_desde", "provisional"];

/** 002·CE-25 a CE-28: agregar o corregir una regla (solo una provisional se corrige). */
export async function accionGuardarRegla(_p: EstadoRegla, fd: FormData): Promise<EstadoRegla> {
  await exigirAcceso(["asistente"]);
  const v = Object.fromEntries(CAMPOS.map((c) => [c, String(fd.get(c) ?? "")]));
  const { datos, errores } = revisarRegla(v);
  if (Object.keys(errores).length) return { errores };
  const id = String(fd.get("id") ?? "") || undefined;
  const r = await guardarRegla(rpcDeSupabase(await clienteSesion()), { ...datos, id });
  if (!r.ok) return { ok: false, mensaje: r.mensaje };
  revalidatePath("/reglas");
  return { ok: true, mensaje: id ? "Regla corregida." : "Regla agregada.", marca: Date.now() };
}

/** 002·CE-28: solo una regla provisional se borra. */
export async function accionEliminarRegla(_p: EstadoRegla, fd: FormData): Promise<EstadoRegla> {
  await exigirAcceso(["asistente"]);
  const r = await eliminarRegla(rpcDeSupabase(await clienteSesion()), String(fd.get("id")));
  if (!r.ok) return { ok: false, mensaje: r.mensaje };
  revalidatePath("/reglas");
  return { ok: true, mensaje: "Regla eliminada." };
}
