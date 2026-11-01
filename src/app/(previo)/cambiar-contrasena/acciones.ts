"use server";
import { redirect } from "next/navigation";
import { clienteServicio, clienteSesion } from "@/servidor/supabase";
import { obtenerEstado } from "@/servidor/sesion";
import { validarContrasenaNueva } from "@/dominio/contrasena";

export interface EstadoCambio { errores?: { nueva?: string; confirmacion?: string }; mensaje?: string }

/**
 * CE-9, CE-78. Supabase Auth guarda la contraseña nueva (bcrypt, CE-12). Solo si
 * eso salió bien, el servidor quita la marca de temporal con la clave de
 * servicio: la persona no puede quitársela sola (migración 010).
 */
export async function accionCambiarContrasena(_p: EstadoCambio, datos: FormData): Promise<EstadoCambio> {
  const nueva = String(datos.get("nueva") ?? "");
  const errores = validarContrasenaNueva(nueva, String(datos.get("confirmacion") ?? ""));
  if (errores.nueva || errores.confirmacion) return { errores };

  const estado = await obtenerEstado();
  if (!estado?.cuenta) redirect("/ingresar");

  const supabase = await clienteSesion();
  const { data: quien } = await supabase.auth.getUser();
  if (!quien.user) redirect("/ingresar");

  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    if (error.code === "same_password")
      return { errores: { nueva: "Debe ser distinta de la contraseña actual." } };
    if (error.code === "weak_password")
      return { errores: { nueva: "Es demasiado fácil de adivinar. Use una frase o combine palabras y números." } };
    return { mensaje: "No se pudo cambiar la contraseña. Intente de nuevo." };
  }

  if (estado.debe_cambiar) {
    const { error: e2 } = await clienteServicio().from("usuario")
      .update({ debe_cambiar_contrasena: false, contrasena_temporal_emitida: null }).eq("id", quien.user.id);
    if (e2) return { mensaje: "La contraseña se cambió, pero no se pudo completar el registro. Intente de nuevo." };
  }
  redirect(estado.aviso_aceptado ? "/inicio?aviso=contrasena" : "/aviso");
}
