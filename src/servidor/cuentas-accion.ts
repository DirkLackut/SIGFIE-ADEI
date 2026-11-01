import "server-only";
import { clienteServicio, clienteSesion } from "./supabase";
import { exigirAcceso } from "./sesion";
import { cambiarEstadoCuenta, type DependenciasCuentas } from "./cuentas";
import { generarContrasenaTemporal } from "@/dominio/contrasena";
import { traducirError } from "@/datos/errores";

/**
 * Conecta la lógica de cuentas con Supabase. La clave de servicio solo se usa
 * DESPUÉS de que la base aceptó la operación con la sesión de la Asistente
 * (marcar temporal, cambiar estado, crear la cuenta): RLS confirma que la cuenta
 * es de su organización y que ella es Asistente. Si la base no lo permite, la
 * clave de servicio nunca se usa sobre esa cuenta.
 */
export async function dependenciasCuentas(): Promise<DependenciasCuentas> {
  await exigirAcceso(["asistente"]);
  const sesion = await clienteSesion();
  const servicio = clienteServicio();
  const filaAfectada = (r: { data: unknown[] | null; error: { message: string; code?: string } | null }) =>
    r.error ? { ok: false as const, mensaje: traducirError(r.error).mensaje }
      : r.data?.length ? { ok: true as const } : { ok: false as const, mensaje: "La cuenta no existe o no es de su organización." };

  return {
    generarTemporal: () => generarContrasenaTemporal(),
    // RFC 2606: .invalid nunca recibe correo. Impredecible para no facilitar
    // ataques directos a la API de Auth (plan §5.1, R3).
    correoInterno: () => `u-${crypto.randomUUID()}@sigfie.invalid`,
    async crearUsuarioAuth(email, password) {
      const { data, error } = await servicio.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) return { error: error?.code === "email_exists" ? "correo_usado" : "otro" };
      return { id: data.user.id };
    },
    async borrarUsuarioAuth(id) { await servicio.auth.admin.deleteUser(id); },
    async crearCuenta(id, c) {
      const { error } = await sesion.rpc("crear_cuenta", { p_id: id, p_nombre_usuario: c.nombre_usuario, p_correo: c.correo ?? "",
        p_profesor: c.profesor_id as string, p_roles: c.roles });
      if (!error) return { ok: true };
      const t = traducirError(error);
      const campo = (["nombre_usuario", "correo", "profesor_id"] as const).find((x) => x === t.campo)
        ?? (/profesor/.test(t.mensaje) ? "profesor_id" : undefined);
      return { ok: false, mensaje: t.mensaje, campo };
    },
    async marcarTemporal(id) {
      return filaAfectada(await sesion.from("usuario")
        .update({ debe_cambiar_contrasena: true, contrasena_temporal_emitida: new Date().toISOString() }).eq("id", id).select("id"));
    },
    async cambiarClaveAuth(id, password) {
      const { error } = await servicio.auth.admin.updateUserById(id, { password });
      return !error;
    },
    async cambiarEstado(id, estado) {
      return filaAfectada(await sesion.from("usuario").update({ estado }).eq("id", id).select("id"));
    },
    async suspenderAuth(id, suspender) {
      const { error } = await servicio.auth.admin.updateUserById(id, { ban_duration: suspender ? "876000h" : "none" });
      return !error;
    },
  };
}

/** CE-83: desde el catálogo de profesores, desactivar también su cuenta. */
export async function desactivarCuentaDeSesion(usuarioId: string) {
  return cambiarEstadoCuenta(await dependenciasCuentas(), usuarioId, false);
}
