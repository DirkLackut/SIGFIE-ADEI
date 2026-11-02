/**
 * Cálculo de la nota y del estado académico (spec 002, CE-14 a CE-23, CE-29, CE-30).
 *
 * Es la vista previa que ve el profesor mientras escribe. La verdad está en la
 * vista resultado_academico de la 012 (D24); las dos se prueban con los mismos
 * vectores (D25, tests/apoyo/vectores-notas.ts). Si se cambia una, se cambia la otra.
 */
import { valido, invalido, type Resultado } from "./resultado";

export type Condicion = "Registrado" | "No presentado" | "Justificado" | "Reprogramado";
export const CONDICIONES: Condicion[] = ["Registrado", "No presentado", "Justificado", "Reprogramado"];
export type EstadoAcademico = "Aprobado" | "Reprobado" | "Condicionado" | "Pendiente";

/** Un parcial con condición. `null` en su lugar = parcial sin condición todavía (D27). */
export interface ParcialCapturado {
  condicion: Condicion;
  valor: number | null;
}

export interface Nota {
  /** Promedio con dos decimales; null si no hay parciales que cuenten. */
  exacta: number | null;
  /** Entera, redondeada (CE-17); null si no hay nota o hay que decidir retiro. */
  final: number | null;
  /** Falta la condición de algún parcial (CE-16). */
  provisional: boolean;
  /** Los tres parciales Justificados: la Asistente decide un retiro (CE-18). */
  requiereRetiro: boolean;
  /** Números de los parciales sin condición. */
  faltan: number[];
}

export interface ReglaAplicable {
  notaMinima: number;
  /** Inicio de la franja de Condicionado; null si la regla no tiene franja. */
  condicionadoDesde: number | null;
}

export interface Situacion {
  estadoInscripcion?: "En curso" | "Completada" | "Retirada" | "Trasladada";
  condicionado?: boolean;
  bajaInasistencia?: boolean;
}

/**
 * CE-14 a CE-18. Cuentan Registrado y Reprogramado con su nota y No presentado
 * con 0; Justificado no cuenta. La nota final redondea la mitad hacia arriba,
 * como round() de PostgreSQL con números positivos.
 */
export function calcularNota(parciales: (ParcialCapturado | null)[]): Nota {
  const tres = [0, 1, 2].map((i) => parciales[i] ?? null);
  const faltan = tres.flatMap((p, i) => (p === null ? [i + 1] : []));
  const con = tres.filter((p): p is ParcialCapturado => p !== null);
  const cuentan = con.filter((p) => p.condicion !== "Justificado");
  const suma = cuentan.reduce((s, p) => s + (p.valor ?? 0), 0);
  const n = cuentan.length;
  const requiereRetiro = con.length === 3 && n === 0;
  // Con enteros: (2·suma + n) / (2·n) truncado es suma/n redondeado hacia arriba en la mitad.
  const final = n === 0 ? null : Math.floor((2 * suma + n) / (2 * n));
  return {
    exacta: n === 0 ? null : Math.round((suma * 100) / n) / 100,
    final: requiereRetiro ? null : final,
    provisional: faltan.length > 0,
    requiereRetiro,
    faltan,
  };
}

/** CE-19 a CE-23, CE-29, CE-38 a CE-40. Mismo orden que la vista de la base (plan §3). */
export function estadoAcademico(nota: Nota, regla: ReglaAplicable | null, s: Situacion = {}): EstadoAcademico | null {
  if (s.estadoInscripcion === "Retirada" || s.estadoInscripcion === "Trasladada") return null;
  if (s.bajaInasistencia) return "Reprobado";
  if (nota.provisional || nota.requiereRetiro || nota.final === null) return "Pendiente";
  if (regla === null) return "Pendiente";
  if (s.condicionado) return "Condicionado";
  return nota.final >= regla.notaMinima ? "Aprobado" : "Reprobado";
}

/** CE-30: la nota final, completa, cae entre el inicio de la franja y la mínima − 1. */
export function enFranja(nota: Nota, regla: ReglaAplicable | null): boolean {
  if (!regla || regla.condicionadoDesde === null || nota.provisional || nota.final === null) return false;
  return nota.final >= regla.condicionadoDesde && nota.final < regla.notaMinima;
}

/** CE-8, RN-03: lo que el profesor escribe en la casilla de un parcial. */
export function leerValorParcial(texto: string): Resultado<number> {
  const t = texto.trim();
  if (!/^\d{1,3}$/.test(t) || Number(t) > 100) return invalido("Escriba un número entero del 0 al 100.");
  return valido(Number(t));
}
