import { type Resultado, valido, invalido } from "./resultado";

/**
 * Las fechas de calendario se manejan como texto "AAAA-MM-DD", no como Date: un
 * Date tiene hora y huso horario, y eso es justo lo que mueve un cumpleaños de
 * un día a otro cerca de la medianoche.
 */
export type FechaISO = string;

const ZONA = "America/Managua";

/** La fecha del día en Nicaragua para un instante dado (CE-77). El instante se
 *  recibe como parámetro, nunca se lee del sistema: así se puede probar. */
export function hoyEnManagua(instante: Date): FechaISO {
  // en-CA formatea como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(instante);
}

function partes(f: FechaISO): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  if (!m) return null;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(Date.UTC(a, mes - 1, d));
  if (real.getUTCFullYear() !== a || real.getUTCMonth() !== mes - 1 || real.getUTCDate() !== d) return null;
  return [a, mes, d];
}

/**
 * Años cumplidos a la fecha `hoy`. Quien nació un 29 de febrero cumple años el
 * 1 de marzo en los años no bisiestos.
 */
export function calcularEdad(nacimiento: FechaISO, hoy: FechaISO): number {
  const n = partes(nacimiento), h = partes(hoy);
  if (!n || !h) throw new Error(`Fecha inválida: ${!n ? nacimiento : hoy}`);
  const yaCumplio = h[1] > n[1] || (h[1] === n[1] && h[2] >= n[2]);
  return h[0] - n[0] - (yaCumplio ? 0 : 1);
}

/** Menor de 18 años a la fecha dada. El día que cumple 18 ya es mayor de edad. */
export function esMenorDeEdad(nacimiento: FechaISO, hoy: FechaISO): boolean {
  return calcularEdad(nacimiento, hoy) < 18;
}

/** CE-36: no posterior a hoy, y edad entre 4 y 99 años, ambos incluidos. */
export function validarFechaNacimiento(nacimiento: FechaISO, hoy: FechaISO): Resultado {
  if (!partes(nacimiento)) return invalido("La fecha no existe.");
  if (nacimiento > hoy) return invalido("La fecha de nacimiento no puede ser posterior a hoy.");
  const edad = calcularEdad(nacimiento, hoy);
  if (edad < 4 || edad > 99) return invalido("La edad debe estar entre 4 y 99 años.");
  return valido(nacimiento);
}
