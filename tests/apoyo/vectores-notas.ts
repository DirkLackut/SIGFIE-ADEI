/**
 * Vectores del cálculo de la nota (D25): los usan la prueba de la vista en SQL
 * (t19) y la de dominio/notas.ts, para que las dos implementaciones digan lo mismo.
 * El estado se da para la regla de 80 con franja 77–79.
 */
export type Entrada = number | "No presentado" | "Justificado" | null;

export interface Vector {
  caso: string;
  parciales: Entrada[];
  exacta: number | null;
  final: number | null;
  provisional: boolean;
  requiereRetiro: boolean;
  estadoCon80: "Aprobado" | "Reprobado" | "Pendiente";
  enFranja: boolean;
  faltan: number[];
}

export const VECTORES_DE_NOTAS: Vector[] = [
  { caso: "CE-14 · tres parciales registrados: promedio", parciales: [85, 90, 80],
    exacta: 85, final: 85, provisional: false, requiereRetiro: false, estadoCon80: "Aprobado", enFranja: false, faltan: [] },
  { caso: "CE-17 · 79.5 redondea a 80 (mitad hacia arriba)", parciales: [80, 79, "Justificado"],
    exacta: 79.5, final: 80, provisional: false, requiereRetiro: false, estadoCon80: "Aprobado", enFranja: false, faltan: [] },
  { caso: "CE-17 · 79.67 redondea a 80", parciales: [80, 80, 79],
    exacta: 79.67, final: 80, provisional: false, requiereRetiro: false, estadoCon80: "Aprobado", enFranja: false, faltan: [] },
  { caso: "CE-17 · 79.33 redondea a 79: reprueba, dentro de la franja", parciales: [80, 79, 79],
    exacta: 79.33, final: 79, provisional: false, requiereRetiro: false, estadoCon80: "Reprobado", enFranja: true, faltan: [] },
  { caso: "CE-15 · No presentado vale 0 y cuenta", parciales: [90, 90, "No presentado"],
    exacta: 60, final: 60, provisional: false, requiereRetiro: false, estadoCon80: "Reprobado", enFranja: false, faltan: [] },
  { caso: "CE-15 · Justificado no cuenta en el promedio", parciales: [90, "Justificado", 70],
    exacta: 80, final: 80, provisional: false, requiereRetiro: false, estadoCon80: "Aprobado", enFranja: false, faltan: [] },
  { caso: "CE-15 · dos Justificados: la nota es el parcial que queda", parciales: ["Justificado", "Justificado", 72],
    exacta: 72, final: 72, provisional: false, requiereRetiro: false, estadoCon80: "Reprobado", enFranja: false, faltan: [] },
  { caso: "CE-15 · tres No presentado: 0", parciales: ["No presentado", "No presentado", "No presentado"],
    exacta: 0, final: 0, provisional: false, requiereRetiro: false, estadoCon80: "Reprobado", enFranja: false, faltan: [] },
  { caso: "CE-16 · un parcial sin condición: provisional y Pendiente", parciales: [85, 85, null],
    exacta: 85, final: 85, provisional: true, requiereRetiro: false, estadoCon80: "Pendiente", enFranja: false, faltan: [3] },
  { caso: "CE-16 · sin parciales: sin nota", parciales: [null, null, null],
    exacta: null, final: null, provisional: true, requiereRetiro: false, estadoCon80: "Pendiente", enFranja: false, faltan: [1, 2, 3] },
  { caso: "CE-18 · tres Justificados: sin nota, decidir retiro", parciales: ["Justificado", "Justificado", "Justificado"],
    exacta: null, final: null, provisional: false, requiereRetiro: true, estadoCon80: "Pendiente", enFranja: false, faltan: [] },
];
