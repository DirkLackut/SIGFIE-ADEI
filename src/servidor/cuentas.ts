/**
 * Cuentas de usuario (T20 · CE-5 a CE-8, CE-13, CE-69, CE-70). Como el ingreso,
 * la lógica recibe sus dependencias: se prueba sin Supabase
 * (tests/app/cuentas.test.ts) y cuentas-accion.ts la conecta.
 *
 * Orden de las operaciones, pensado para que un fallo a mitad no deje nada roto:
 *   · crear: usuario de Auth → cuenta y roles (una transacción). Si lo segundo
 *     falla, se borra lo primero.
 *   · restablecer: marca de temporal → contraseña nueva en Auth.
 *   · desactivar: estado en la base (corta el acceso a los datos al instante,
 *     CE-7, y es donde se comprueba CE-13) → suspensión en Auth.
 */
import type { Rol } from "@/dominio/acceso";

export interface NuevaCuenta { nombre_usuario: string; correo: string; roles: Rol[]; profesor_id: string }
export type Errores = Partial<Record<keyof NuevaCuenta, string>>;
type Res = { ok: true } | { ok: false; mensaje: string; campo?: keyof NuevaCuenta };

export interface DependenciasCuentas {
  generarTemporal(): string;
  correoInterno(): string;
  crearUsuarioAuth(correo: string, clave: string): Promise<{ id: string } | { error: "correo_usado" | "otro" }>;
  borrarUsuarioAuth(id: string): Promise<void>;
  crearCuenta(id: string, c: { nombre_usuario: string; correo: string | null; profesor_id: string | null; roles: Rol[] }): Promise<Res>;
  marcarTemporal(id: string): Promise<Res>;
  cambiarClaveAuth(id: string, clave: string): Promise<boolean>;
  cambiarEstado(id: string, estado: "activo" | "inactivo"): Promise<Res>;
  suspenderAuth(id: string, suspender: boolean): Promise<boolean>;
}

const ROLES: Rol[] = ["asistente", "direccion", "profesor", "admin_tecnico"];
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** CE-5, CE-6, CE-69: revisión antes de tocar nada. */
export function revisarNuevaCuenta(e: NuevaCuenta): Errores {
  const errores: Errores = {};
  const nombre = e.nombre_usuario.trim().toLowerCase();
  if (!/^\S{4,30}$/.test(nombre)) errores.nombre_usuario = "De 4 a 30 caracteres, sin espacios. Por ejemplo: aura.gomez";
  if (e.correo.trim() && (!CORREO.test(e.correo.trim()) || e.correo.trim().length > 100)) errores.correo = "No es un correo válido.";
  if (!e.roles.length || e.roles.some((r) => !ROLES.includes(r))) errores.roles = "Elija al menos un rol.";
  if (e.roles.includes("profesor") && !e.profesor_id) errores.profesor_id = "Elija a qué profesor del catálogo pertenece la cuenta.";
  return errores;
}

export type ResultadoCreacion =
  | { ok: true; nombre_usuario: string; temporal: string }
  | { ok: false; errores?: Errores; mensaje?: string };

export async function crearCuentaCompleta(d: DependenciasCuentas, e: NuevaCuenta): Promise<ResultadoCreacion> {
  const errores = revisarNuevaCuenta(e);
  if (Object.keys(errores).length) return { ok: false, errores };
  const nombre = e.nombre_usuario.trim().toLowerCase();
  const correo = e.correo.trim().toLowerCase();

  const temporal = d.generarTemporal();                                            // CE-8: se muestra una vez
  const auth = await d.crearUsuarioAuth(correo || d.correoInterno(), temporal);
  if ("error" in auth) {
    return auth.error === "correo_usado"
      ? { ok: false, errores: { correo: "Ese correo ya lo usa otra cuenta." } }
      : { ok: false, mensaje: "No se pudo crear la cuenta en el servicio de acceso. Intente de nuevo." };
  }
  const r = await d.crearCuenta(auth.id, { nombre_usuario: nombre, correo: correo || null,
    profesor_id: e.roles.includes("profesor") ? e.profesor_id : null, roles: e.roles });
  if (!r.ok) {
    await d.borrarUsuarioAuth(auth.id);   // no deja un usuario de Auth sin cuenta
    return r.campo ? { ok: false, errores: { [r.campo]: r.mensaje } } : { ok: false, mensaje: r.mensaje };
  }
  return { ok: true, nombre_usuario: nombre, temporal };
}

export async function restablecerContrasena(d: DependenciasCuentas, id: string): Promise<{ ok: true; temporal: string } | { ok: false; mensaje: string }> {
  const marca = await d.marcarTemporal(id);                                        // CE-9, CE-70
  if (!marca.ok) return marca;
  const temporal = d.generarTemporal();
  if (!(await d.cambiarClaveAuth(id, temporal))) return { ok: false, mensaje: "No se pudo cambiar la contraseña. Intente de nuevo." };
  return { ok: true, temporal };
}

export async function cambiarEstadoCuenta(d: DependenciasCuentas, id: string, activar: boolean): Promise<Res> {
  const r = await d.cambiarEstado(id, activar ? "activo" : "inactivo");           // CE-7, CE-13
  if (!r.ok) return r;
  if (!(await d.suspenderAuth(id, !activar)))
    return { ok: false, mensaje: activar ? "La cuenta se reactivó, pero el servicio de acceso no respondió: intente de nuevo." 
                                         : "La cuenta quedó sin acceso a los datos, pero el servicio de acceso no respondió: intente de nuevo." };
  return { ok: true };
}
