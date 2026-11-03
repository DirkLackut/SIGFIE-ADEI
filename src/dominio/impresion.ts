/** Hojas de un impreso sin formato en papel (listado, historial; plan §5c). */
export function paginar<T>(filas: T[], porHoja: number): T[][] {
  if (filas.length === 0) return [[]];
  return Array.from({ length: Math.ceil(filas.length / porHoja) }, (_, h) => filas.slice(h * porHoja, (h + 1) * porHoja));
}
