"use server";
/**
 * Facturas y estado de matrícula desde el expediente (spec 003). El servidor
 * revisa el rol y el formulario (dominio); la base vuelve a revisar todo (014).
 */
import { revalidatePath } from "next/cache";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { registrarFactura, corregirFactura, anularFactura, cambiarEstadoMatricula } from "@/datos/facturas";
import { revisarFactura, type FormularioFactura } from "@/dominio/factura";
import { revisarCambioEstado } from "@/dominio/estado-matricula";
import { hoyEnManagua } from "@/dominio/edad";

export interface EstadoFactura {
  ok?: boolean; mensaje?: string; errores?: Record<string, string>; valores?: Record<string, string>;
  atipico?: string; duplicada?: string;
}

const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

/** Los códigos ADEI de los hermanos amparados, convertidos a id (CE-59). */
async function idsDeCodigos(codigos: string): Promise<{ ids: string[]; faltan: string[] }> {
  const lista = [...new Set(codigos.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (!lista.length) return { ids: [], faltan: [] };
  const { data } = await (await clienteSesion()).from("estudiante").select("id, codigo_adei").in("codigo_adei", lista);
  const encontrados = new Map((data ?? []).map((x) => [x.codigo_adei, x.id]));
  return { ids: [...encontrados.values()], faltan: lista.filter((c) => !encontrados.has(c)) };
}

/** CE-52 a CE-62: registra o, si trae id, corrige. */
export async function accionGuardarFactura(_p: EstadoFactura, d: FormData): Promise<EstadoFactura> {
  await exigirAcceso(["asistente"]);
  const valores = Object.fromEntries([...d.entries()].map(([k, v]) => [k, String(v)]));
  const estudiante = texto(d, "estudiante");
  const otros = await idsDeCodigos(texto(d, "otros"));
  if (otros.faltan.length) return { ok: false, valores, errores: { otros: `No se encontró: ${otros.faltan.join(", ")}.` } };
  const form: FormularioFactura = {
    serie: texto(d, "serie"), numero: texto(d, "numero"), fecha_emision: texto(d, "fecha_emision"), monto: texto(d, "monto"),
    moneda: texto(d, "moneda"), forma_pago: texto(d, "forma_pago"), estudiantes: [estudiante, ...otros.ids],
    inscripcion_id: texto(d, "inscripcion_id") || undefined,
  };
  const { errores, datos } = revisarFactura(form, hoyEnManagua(new Date()));
  if (!datos) return { ok: false, valores, errores: errores as Record<string, string> };

  const rpc = rpcDeSupabase(await clienteSesion());
  const confirmar = d.get("confirmar") === "1";
  const id = texto(d, "id");
  const r = id
    ? await corregirFactura(rpc, id, Number(texto(d, "version")), datos, texto(d, "motivo"), confirmar)
    : await registrarFactura(rpc, datos, confirmar);
  if (r.estado === "registrada" || r.estado === "corregida") {
    revalidatePath(`/estudiantes/${estudiante}`);
    return { ok: true, mensaje: r.estado === "registrada" ? `Factura ${datos.serie}-${datos.numero} registrada.` : "Factura corregida. El valor anterior queda en la auditoría." };
  }
  if (r.estado === "atipico") return { ok: false, valores, atipico: `El monto ${datos.moneda === "USD" ? "US$" : "C$"}${datos.monto} es más alto que lo usual. ¿Lo registra de todos modos?` };
  if (r.estado === "duplicada") return { ok: false, valores, duplicada: `La factura ${r.serie}-${r.numero} ya está registrada.`, errores: { numero: "Ya hay una factura con esa serie y ese número." } };
  if (r.estado === "conflicto") return { ok: false, valores, mensaje: "Otra sesión cambió esta factura mientras tanto. Recargue la página y vuelva a intentarlo." };
  const f = r as Extract<typeof r, { estado: "error" }>;
  return { ok: false, valores, mensaje: f.mensaje, errores: f.campo ? { [f.campo]: f.mensaje } : undefined };
}

/** CE-63 */
export async function accionAnularFactura(_p: EstadoFactura, d: FormData): Promise<EstadoFactura> {
  await exigirAcceso(["asistente"]);
  const r = await anularFactura(rpcDeSupabase(await clienteSesion()), texto(d, "id"), texto(d, "motivo"));
  if (r.ok) revalidatePath(`/estudiantes/${texto(d, "estudiante")}`);
  return r.ok ? { ok: true, mensaje: "Factura anulada. Sus datos quedan en la auditoría." } : { ok: false, mensaje: r.mensaje };
}

export interface EstadoCambio {
  ok?: boolean; mensaje?: string; errores?: Record<string, string>; valores?: Record<string, string>;
  advertir?: { inscripcion_id: string; grupo_id: string; codigo_grupo: string; nivel: string }[];
}

/** CE-67 a CE-74 */
export async function accionCambiarEstado(_p: EstadoCambio, d: FormData): Promise<EstadoCambio> {
  await exigirAcceso(["asistente"]);
  const valores = Object.fromEntries([...d.entries()].map(([k, v]) => [k, String(v)]));
  const estudiante = texto(d, "estudiante");
  const { errores, datos } = revisarCambioEstado({ actual: texto(d, "actual"), nuevo: texto(d, "nuevo"), fecha: texto(d, "fecha"),
    ultimoCambio: texto(d, "ultimo") || null, observacion: texto(d, "observacion") }, hoyEnManagua(new Date()));
  if (!datos) return { ok: false, valores, errores: errores as Record<string, string> };
  const r = await cambiarEstadoMatricula(rpcDeSupabase(await clienteSesion()), estudiante, datos.estado, datos.fecha,
    datos.observacion, d.get("confirmar") === "1");
  if (r.estado === "cambiado") {
    revalidatePath(`/estudiantes/${estudiante}`);
    return { ok: true, mensaje: `Estado cambiado a ${r.estado_matricula}.` };
  }
  if (r.estado === "advertir") return { ok: false, valores, advertir: r.inscripciones };
  return { ok: false, valores, mensaje: r.mensaje };
}
