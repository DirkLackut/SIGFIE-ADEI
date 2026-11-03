/** Períodos del panel de actas y del reporte (spec 003, CE-76, CE-83). */
import { fecha } from "./formato";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** El mes que contiene `hoy` (AAAA-MM-DD, en Managua). */
export function mesEnCurso(hoy: string): { desde: string; hasta: string } {
  const [a, m] = hoy.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { desde: `${a}-${mm}-01`, hasta: `${a}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

/** «noviembre de 2026» si es un mes completo; si no, «del 15/10/2026 al 14/11/2026». */
export function describirPeriodo(desde: string, hasta: string): string {
  const mes = mesEnCurso(desde);
  if (mes.desde === desde && mes.hasta === hasta) return `${MESES[Number(desde.slice(5, 7)) - 1]} de ${desde.slice(0, 4)}`;
  return `del ${fecha(desde)} al ${fecha(hasta)}`;
}
