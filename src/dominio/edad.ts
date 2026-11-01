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
  // setUTCFullYear y no Date.UTC: Date.UTC convierte los años 0–99 en 1900–1999,
  // y «0002-05-20» (lo que llega mientras se escribe el año) parecía otra fecha.
  const real = new Date(0);
  real.setUTCFullYear(a, mes - 1, d);
  if (real.getUTCFullYear() !== a || real.getUTCMonth() !== mes - 1 || real.getUTCDate() !== d) return null;
  return [a, mes, d];
}

/** Fecha de calendario que existe, con año de cuatro cifras. El campo de fecha del
 *  navegador acepta años de hasta seis cifras (275760): esos se rechazan aquí. */
export function esFechaReal(f: FechaISO): boolean {
  return partes(f) !== null;
}

/** La misma fecha `n` años después (o antes, si `n` es negativo). Un 29 de
 *  febrero pasa al 28 si el año de destino no es bisiesto. */
export function sumarAnios(f: FechaISO, n: number): FechaISO {
  const p = partes(f);
  if (!p) throw new Error(`Fecha inválida: ${f}`);
  const a = p[0] + n, bisiesto = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  const d = p[1] === 2 && p[2] === 29 && !bisiesto ? 28 : p[2];
  return `${String(a).padStart(4, "0")}-${String(p[1]).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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

/**
 * Edad para mostrar mientras se escribe la fecha: nunca lanza. Mientras se teclea
 * el año, el campo pasa por «0002», «0020», «0201»… y nada de eso debe romper la
 * pantalla. Devuelve null si la fecha todavía no es válida o no es creíble.
 */
export function edadMientrasSeEscribe(nacimiento: FechaISO, hoy: FechaISO): number | null {
  if (!partes(nacimiento) || !partes(hoy) || nacimiento > hoy) return null;
  const e = calcularEdad(nacimiento, hoy);
  return e <= 120 ? e : null;
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
