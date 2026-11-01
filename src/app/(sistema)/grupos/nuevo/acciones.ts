"use server";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { abrirGrupo, type DatosGrupo } from "@/datos/grupos";

export interface EstadoNuevoGrupo { valores?: Partial<DatosGrupo>; errores?: Record<string, string>; mensaje?: string }
const CAMPOS = ["nivel_id", "modalidad_id", "horario_id", "profesor_id", "sucursal_id", "fecha_inicio", "fecha_termino"] as const;
const ETIQUETA: Record<string, string> = { nivel_id: "el nivel", modalidad_id: "la modalidad", horario_id: "el horario",
  profesor_id: "el profesor", sucursal_id: "la sucursal", fecha_inicio: "la fecha de inicio", fecha_termino: "la fecha de término" };

/** CE-47 a CE-50, CE-91, CE-92. */
export async function accionAbrirGrupo(_p: EstadoNuevoGrupo, datos: FormData): Promise<EstadoNuevoGrupo> {
  await exigirAcceso(["asistente"]);
  const valores = Object.fromEntries(CAMPOS.map((c) => [c, String(datos.get(c) ?? "")])) as unknown as DatosGrupo;
  const errores: Record<string, string> = {};
  for (const c of CAMPOS) if (!valores[c]) errores[c] = `Elija ${ETIQUETA[c]}.`;
  if (!errores.fecha_inicio && !errores.fecha_termino && valores.fecha_termino <= valores.fecha_inicio)
    errores.fecha_termino = "Debe ser posterior a la fecha de inicio.";
  if (Object.keys(errores).length) return { valores, errores };

  const r = await abrirGrupo(rpcDeSupabase(await clienteSesion()), valores);
  if (r.estado === "abierto") redirect(`/grupos/${r.id}?abierto=1` as Route);
  const campo = r.campo ?? (/término ya pasó/.test(r.mensaje) ? "fecha_termino" : /modalidad/.test(r.mensaje) ? "horario_id" : undefined);
  return { valores, errores: campo ? { [campo]: r.mensaje } : undefined, mensaje: campo ? undefined : r.mensaje };
}
