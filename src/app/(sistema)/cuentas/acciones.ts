"use server";
import { revalidatePath } from "next/cache";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { dependenciasCuentas } from "@/servidor/cuentas-accion";
import { crearCuentaCompleta, restablecerContrasena, cambiarEstadoCuenta, type Errores } from "@/servidor/cuentas";
import { traducirError } from "@/datos/errores";
import type { Rol } from "@/dominio/acceso";

export interface EstadoCuenta {
  ok?: boolean; mensaje?: string; errores?: Errores; valores?: Record<string, string | string[]>;
  /** CE-8: la contraseña temporal viaja una sola vez, en esta respuesta. No se guarda en ningún lado. */
  temporal?: { usuario: string; clave: string };
}

const rolesDe = (fd: FormData) => fd.getAll("roles").map(String) as Rol[];

export async function accionCrearCuenta(_p: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  const entrada = { nombre_usuario: String(fd.get("nombre_usuario") ?? ""), correo: String(fd.get("correo") ?? ""),
    roles: rolesDe(fd), profesor_id: String(fd.get("profesor_id") ?? "") };
  const r = await crearCuentaCompleta(await dependenciasCuentas(), entrada);
  if (!r.ok) return { errores: r.errores, mensaje: r.mensaje, valores: entrada };
  revalidatePath("/cuentas");
  return { ok: true, temporal: { usuario: r.nombre_usuario, clave: r.temporal } };
}

export async function accionRestablecer(_p: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  const r = await restablecerContrasena(await dependenciasCuentas(), String(fd.get("id")));
  revalidatePath("/cuentas");
  return r.ok ? { ok: true, temporal: { usuario: String(fd.get("nombre_usuario")), clave: r.temporal } } : { mensaje: r.mensaje };
}

export async function accionEstado(_p: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  const activar = fd.get("operacion") === "activar";
  const r = await cambiarEstadoCuenta(await dependenciasCuentas(), String(fd.get("id")), activar);
  revalidatePath("/cuentas");
  return r.ok ? { ok: true, mensaje: activar ? "Cuenta reactivada." : "Cuenta desactivada: ya no puede ingresar ni ver datos." } : { mensaje: r.mensaje };
}

export async function accionRoles(_p: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  await exigirAcceso(["asistente"]);
  const roles = rolesDe(fd);
  if (!roles.length) return { mensaje: "Elija al menos un rol." };
  const profesor = String(fd.get("profesor_id") ?? "");
  if (roles.includes("profesor") && !profesor) return { mensaje: "Elija a qué profesor del catálogo pertenece la cuenta." };
  const s = await clienteSesion();
  const { error } = await s.rpc("asignar_roles", { p_usuario: String(fd.get("id")), p_roles: roles, p_profesor: (profesor || null) as string });
  revalidatePath("/cuentas");
  return error ? { mensaje: traducirError(error).mensaje } : { ok: true, mensaje: "Roles actualizados." };
}
