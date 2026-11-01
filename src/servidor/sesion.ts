import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { clienteSesion } from "./supabase";
import type { EstadoAcceso, Rol } from "@/dominio/acceso";

export type EstadoConCuenta = Extract<EstadoAcceso, { cuenta: true }>;

/** Estado de acceso de quien pide la página. Una sola consulta por petición
 *  aunque lo pidan el menú y la página a la vez (cache de React). */
export const obtenerEstado = cache(async (): Promise<EstadoAcceso | null> => {
  const supabase = await clienteSesion();
  const { data: sesion } = await supabase.auth.getClaims();
  if (!sesion?.claims) return null;
  const { data, error } = await supabase.rpc("mi_estado_acceso");
  return error ? null : (data as unknown as EstadoAcceso);
});

/**
 * Para pantallas del sistema: exige acceso completo y, si se indican, uno de los
 * roles. proxy.ts ya redirige; esto es la segunda comprobación en el servidor
 * (la tercera, y definitiva, es RLS).
 */
export async function exigirAcceso(roles?: Rol[]): Promise<EstadoConCuenta> {
  const e = await obtenerEstado();
  if (!e) redirect("/ingresar");
  if (!e.cuenta || !e.activo) redirect("/salir?motivo=cuenta");
  if (e.debe_cambiar) redirect("/cambiar-contrasena");
  if (!e.aviso_aceptado) redirect("/aviso");
  if (roles && !roles.some((r) => e.roles.includes(r))) redirect("/inicio?aviso=sin-permiso");
  return e;
}

export const NOMBRE_ROL: Record<Rol, string> = {
  asistente: "Asistente de Dirección",
  direccion: "Dirección",
  profesor: "Profesor",
  admin_tecnico: "Administrador técnico",
};
