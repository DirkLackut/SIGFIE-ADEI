"use server";
import { redirect } from "next/navigation";
import { clienteSesion } from "@/servidor/supabase";

export interface EstadoAviso { mensaje?: string }

/** CE-16: la base registra quién, cuándo, qué versión y en qué sesión. El
 *  usuario y la sesión salen del token, no del formulario (aceptar_aviso, 008). */
export async function accionAceptarAviso(_p: EstadoAviso, datos: FormData): Promise<EstadoAviso> {
  const version = String(datos.get("version") ?? "");
  const supabase = await clienteSesion();
  const { error } = await supabase.rpc("aceptar_aviso", { p_version: version });
  if (error) {
    return { mensaje: /versión vigente/.test(error.message)
      ? "El aviso se actualizó mientras lo leía. Recargue la página para ver la versión nueva."
      : "No se pudo registrar la aceptación. Intente de nuevo." };
  }
  redirect("/inicio");
}
