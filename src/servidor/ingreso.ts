/**
 * Ingreso al sistema (T17 · plan §5.1 · CE-1, CE-3, CE-4, CE-18, CE-69, CE-70).
 *
 * La lógica no conoce Supabase: recibe lo que necesita como funciones. Así se
 * prueba completa sin red (tests/app/ingreso.test.ts) y la Server Action solo
 * conecta estas funciones con Supabase.
 *
 * Diferido a la spec 004 (tasks.md, T27): el bloqueo tras 5 intentos fallidos.
 */
import { temporalVencida } from "@/dominio/contrasena";

export interface CuentaParaIngreso {
  id: string;
  activa: boolean;
  debeCambiar: boolean;
  temporalEmitida: Date | null;
  correoAuth: string;
}

export interface DependenciasIngreso {
  /** Busca por nombre de usuario (ya en minúsculas), con la clave de servicio. */
  buscarCuenta(nombreUsuario: string): Promise<CuentaParaIngreso | null>;
  /** Supabase Auth. "credenciales" = contraseña incorrecta; "error" = servicio caído. */
  iniciarSesion(correo: string, contrasena: string): Promise<"ok" | "credenciales" | "error">;
  cerrarSesion(): Promise<void>;
  /** Auditoría de un ingreso negado (sin sesión: lo hace el servidor). Nunca la contraseña. */
  registrarDenegado(nombreUsuario: string, motivo: string): Promise<void>;
  /** Auditoría del ingreso, ya con la sesión de la persona. */
  registrarAcceso(): Promise<void>;
  ahora: Date;
}

export type ResultadoIngreso =
  | { ok: true; destino: "/cambiar-contrasena" | "/aviso" }
  | { ok: false; mensaje: string };

/** CE-3: el mismo mensaje sea cual sea el dato que falló. */
export const MENSAJE_GENERICO = "Usuario o contraseña incorrectos.";
export const MENSAJE_SERVICIO = "No se pudo conectar con el sistema. Intente de nuevo en un momento.";
export const MENSAJE_FALTAN = "Escriba su usuario y su contraseña.";

export async function ingresar(
  d: DependenciasIngreso,
  entrada: { usuario: string; contrasena: string },
): Promise<ResultadoIngreso> {
  const nombre = entrada.usuario.trim().toLowerCase();   // CE-69
  if (!nombre || !entrada.contrasena) return { ok: false, mensaje: MENSAJE_FALTAN };

  const negar = async (motivo: string): Promise<ResultadoIngreso> => {
    await d.registrarDenegado(nombre, motivo);
    return { ok: false, mensaje: MENSAJE_GENERICO };
  };

  const cuenta = await d.buscarCuenta(nombre);
  if (!cuenta) return negar("usuario inexistente");
  if (!cuenta.activa) return negar("cuenta inactiva");                                   // CE-4
  if (cuenta.debeCambiar && cuenta.temporalEmitida && temporalVencida(cuenta.temporalEmitida, d.ahora))
    return negar("contraseña temporal vencida");                                         // CE-70

  const r = await d.iniciarSesion(cuenta.correoAuth, entrada.contrasena);
  if (r === "error") return { ok: false, mensaje: MENSAJE_SERVICIO };
  if (r === "credenciales") return negar("contraseña incorrecta");                       // CE-3

  // CE-20: un ingreso que no queda registrado no se concede.
  try {
    await d.registrarAcceso();                                                           // CE-18
  } catch {
    await d.cerrarSesion();
    return { ok: false, mensaje: MENSAJE_SERVICIO };
  }
  return { ok: true, destino: cuenta.debeCambiar ? "/cambiar-contrasena" : "/aviso" };   // CE-9, CE-14
}
