import type { FechaISO } from "./edad";

/** Lo que importa de una inscripción para saber si choca con otra. */
export interface Cursada {
  modalidadId: string;
  fechaInicio: FechaISO;
  fechaTermino: FechaISO;
  /** "HH:MM", 24 horas */
  horaInicio: string;
  horaFin: string;
}

/**
 * CE-84: dos inscripciones se cruzan si son de la misma modalidad, sus fechas
 * comparten al menos un día y sus horas se pisan.
 *
 * Supuesto: cada modalidad se imparte en días distintos (Diario, Sabatino,
 * Dominical, Viernino), así que dos modalidades diferentes no chocan. El
 * catálogo guarda los días como texto libre ("diasDeClase"), que no permite
 * compararlos con seguridad. Como el resultado solo produce una ADVERTENCIA que
 * la Asistente confirma, un falso negativo cuesta poco; un falso positivo en
 * cada inscripción enseñaría a ignorar el aviso.
 */
export function seSuperponen(a: Cursada, b: Cursada): boolean {
  if (a.modalidadId !== b.modalidadId) return false;
  // Fechas: rangos cerrados. Si uno termina el 27 y otro empieza el 27, comparten el 27.
  const fechas = a.fechaInicio <= b.fechaTermino && b.fechaInicio <= a.fechaTermino;
  // Horas: rangos semiabiertos. 08:00–10:00 y 10:00–12:00 no se pisan.
  const horas = a.horaInicio < b.horaFin && b.horaInicio < a.horaFin;
  return fechas && horas;
}
