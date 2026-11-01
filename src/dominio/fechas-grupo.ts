import { esFechaReal, sumarAnios, type FechaISO } from "./edad";

/**
 * Fechas de un grupo (CE-50, CE-50a, CE-91, CE-92). Los niveles duran semanas,
 * así que una fecha a más de un año de distancia es un error de escritura, como
 * el año «602026» que el campo de fecha del navegador deja teclear.
 */
export const LIMITE_ANIOS = 1;

/** Lo que el campo de fecha del navegador deja elegir. Con un máximo de cuatro
 *  cifras en el año, el navegador tampoco deja teclear un año de seis. */
export function limitesFechasGrupo(hoy: FechaISO) {
  return {
    inicio: { min: sumarAnios(hoy, -LIMITE_ANIOS), max: sumarAnios(hoy, LIMITE_ANIOS) },
    termino: { min: hoy, max: sumarAnios(hoy, 2 * LIMITE_ANIOS) },
  };
}

export type ErroresFechas = Partial<Record<"fecha_inicio" | "fecha_termino", string>>;

/** Errores por campo; vacío si las dos fechas cumplen. Las fechas vacías las
 *  reporta quien llama («Elija la fecha…»). */
export function validarFechasGrupo(inicio: FechaISO, termino: FechaISO, hoy: FechaISO): ErroresFechas {
  const e: ErroresFechas = {};
  const noExiste = "La fecha no existe. Escriba día, mes y un año de cuatro cifras.";
  const limite = LIMITE_ANIOS === 1 ? "un año" : `${LIMITE_ANIOS} años`;

  if (inicio && !esFechaReal(inicio)) e.fecha_inicio = noExiste;
  else if (inicio && inicio < sumarAnios(hoy, -LIMITE_ANIOS)) e.fecha_inicio = `No puede ser de hace más de ${limite}.`;
  else if (inicio && inicio > sumarAnios(hoy, LIMITE_ANIOS)) e.fecha_inicio = `No puede ser dentro de más de ${limite}.`;

  if (termino && !esFechaReal(termino)) e.fecha_termino = noExiste;
  else if (termino && termino < hoy) e.fecha_termino = "La fecha de término ya pasó: no se puede abrir el grupo.";
  else if (inicio && termino && !e.fecha_inicio && termino <= inicio) e.fecha_termino = "Debe ser posterior a la fecha de inicio.";
  else if (inicio && termino && !e.fecha_inicio && termino > sumarAnios(inicio, LIMITE_ANIOS))
    e.fecha_termino = `No puede ser más de ${limite} después del inicio.`;
  return e;
}
