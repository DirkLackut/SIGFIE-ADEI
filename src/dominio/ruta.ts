/**
 * Ruta de un nivel (spec 002, D28): dónde está un nivel en la secuencia que sigue
 * un estudiante. Igual que interno.ruta e interno.posicion de la 012.
 *
 *   · el Curso principal va del nivel 1 al 16;
 *   · Conversation sigue con Conversation Avanzada;
 *   · cada otro programa (Especial, Curso de niños) es su propia ruta.
 *
 * Las advertencias de antecedentes (CE-54, CE-55) solo comparan niveles de la misma ruta.
 */
export interface PosicionEnRuta {
  ruta: string;
  posicion: number;
}

export function posicionEnRuta(programa: string, orden: number): PosicionEnRuta {
  if (programa === "Conversation Avanzada") return { ruta: "Conversation", posicion: 100 + orden };
  return { ruta: programa, posicion: orden };
}
