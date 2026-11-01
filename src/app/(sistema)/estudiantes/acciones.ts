"use server";
import { clienteSesion } from "@/servidor/supabase";

export interface FilaBusqueda {
  id: string; codigo_adei: string; nombres: string; apellidos: string;
  cedula: string | null; estado_matricula: string; sucursal: string;
}
export type RespuestaBusqueda =
  | { estado: "ok"; total: number; pagina: number; por_pagina: number; resultados: FilaBusqueda[] }
  | { estado: "texto_corto"; minimo: number }
  | { estado: "denegado" }
  | { estado: "error" };

/** CE-42 a CE-46, CE-85. La base busca, cuenta, pagina y registra la consulta. */
export async function buscarEstudiantes(texto: string, pagina: number): Promise<RespuestaBusqueda> {
  const supabase = await clienteSesion();
  const { data, error } = await supabase.rpc("buscar_estudiantes", { p_texto: texto, p_pagina: pagina });
  if (error) return { estado: "error" };
  return data as unknown as RespuestaBusqueda;
}
