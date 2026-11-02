/**
 * Hoja de registro de notas (spec 002, CE-50 a CE-53; docs/formatos/README.md).
 * Reproduce el formato impreso de ADEI: 20 filas por hoja, numeradas, y una hoja
 * más con la numeración continua cuando el grupo tiene más de 20.
 */
import type { Condicion, EstadoAcademico } from "./notas";

export const FILAS_POR_HOJA = 20;

export interface ParcialImpreso { numero: number; condicion: Condicion; valor: number | null }

export interface FilaImpresa {
  nombres: string;
  apellidos: string;
  estado_inscripcion: string;
  estado: EstadoAcademico | null;
  nota_final: number | null;
  condicionado: boolean;
  /** Falta la condición de algún parcial: la final todavía no vale. */
  provisional: boolean;
  parciales: ParcialImpreso[];
}

export interface RenglonHoja { numero: number; fila: FilaImpresa | null }

/** Divide las filas en hojas de 20 renglones; los que sobran quedan en blanco. */
export function paginarActa(filas: FilaImpresa[]): RenglonHoja[][] {
  const hojas = Math.max(1, Math.ceil(filas.length / FILAS_POR_HOJA));
  return Array.from({ length: hojas }, (_, h) =>
    Array.from({ length: FILAS_POR_HOJA }, (_, i) => {
      const n = h * FILAS_POR_HOJA + i;
      return { numero: n + 1, fila: filas[n] ?? null };
    }));
}

const ABREVIATURA: Record<Condicion, string> = { Registrado: "", "No presentado": "NP", Justificado: "J", Reprogramado: "R" };
export const LEYENDA = "NP: no presentado · J: justificado · R: reprogramado · C: condicionado";

/** CE-53: la condición que no es Registrado se escribe; nunca una celda vacía con condición. */
export function celdaParcial(p: ParcialImpreso | undefined): string {
  if (!p) return "";
  if (p.condicion === "Registrado") return String(p.valor);
  if (p.condicion === "Reprogramado") return `${p.valor} R`;
  return ABREVIATURA[p.condicion];
}

/** La columna «Final». Rojo solo para la nota reprobada (constitución, principio 9). */
export function celdaFinal(f: FilaImpresa): { texto: string; reprobada: boolean } {
  if (f.estado_inscripcion === "Retirada") return { texto: "Retirado", reprobada: false };
  if (f.estado_inscripcion === "Trasladada") return { texto: "Trasladado", reprobada: false };
  if (f.nota_final === null || f.provisional) return { texto: "", reprobada: false };
  if (f.estado === "Condicionado") return { texto: `${f.nota_final} C`, reprobada: false };
  return { texto: String(f.nota_final), reprobada: f.estado === "Reprobado" };
}
