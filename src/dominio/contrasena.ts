/**
 * Contraseña temporal que la Asistente le entrega en persona a un usuario
 * cuando le restablece el acceso (CE-8). Vence a las 72 horas (CE-70).
 */

/** Sin los caracteres que se confunden al dictarla o al copiarla a mano:
 *  0 O o · 1 l I. Quedan 56 símbolos. */
export const ALFABETO_TEMPORAL = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** 12 caracteres de 56 símbolos: unos 69 bits de azar. El mínimo de la spec es 8. */
export const LARGO_TEMPORAL = 12;

export const HORAS_VIGENCIA_TEMPORAL = 72;

type FuenteDeAzar = (bytes: Uint8Array) => Uint8Array;
const azarSeguro: FuenteDeAzar = (b) => crypto.getRandomValues(b);

/**
 * Genera la contraseña con azar criptográfico.
 *
 * Descarta los bytes que caen en el último tramo incompleto (de 224 a 255): si
 * se usara `byte % 56` directamente, los primeros 32 símbolos saldrían un 25 %
 * más que los demás, y la contraseña sería más fácil de adivinar.
 */
export function generarContrasenaTemporal(azar: FuenteDeAzar = azarSeguro): string {
  const n = ALFABETO_TEMPORAL.length;
  const limite = Math.floor(256 / n) * n; // 224
  let resultado = "";
  const lote = new Uint8Array(32);
  while (resultado.length < LARGO_TEMPORAL) {
    azar(lote);
    for (const byte of lote) {
      if (byte < limite) resultado += ALFABETO_TEMPORAL[byte % n];
      if (resultado.length === LARGO_TEMPORAL) break;
    }
  }
  return resultado;
}

/** Momento en que vence una contraseña temporal emitida en `emitida`. */
export function vencimientoTemporal(emitida: Date): Date {
  return new Date(emitida.getTime() + HORAS_VIGENCIA_TEMPORAL * 3_600_000);
}

/** A las 72 horas exactas ya no sirve. `ahora` se recibe, no se lee del reloj. */
export function temporalVencida(emitida: Date, ahora: Date): boolean {
  return ahora.getTime() >= vencimientoTemporal(emitida).getTime();
}

/**
 * Contraseña propia que elige la persona (CE-5: mínimo 8 caracteres; CE-9). El
 * máximo de 72 es el límite de bcrypt, el algoritmo con que Supabase la guarda
 * (CE-12): más allá de 72 bytes, el resto se ignoraría sin avisar.
 */
export function validarContrasenaNueva(nueva: string, confirmacion: string): { nueva?: string; confirmacion?: string } {
  const errores: { nueva?: string; confirmacion?: string } = {};
  if (nueva.trim().length < 8) errores.nueva = "Debe tener al menos 8 caracteres.";
  else if (new TextEncoder().encode(nueva).length > 72) errores.nueva = "Puede tener como máximo 72 caracteres.";
  if (!errores.nueva && nueva !== confirmacion) errores.confirmacion = "No coincide con la contraseña nueva.";
  return errores;
}
