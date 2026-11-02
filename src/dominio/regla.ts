/**
 * Formulario de la regla de aprobación (spec 002, CE-24 a CE-26). Avisa antes de
 * enviar; la base vuelve a comprobarlo todo, y la superposición (CE-26) y la
 * regla confirmada (CE-28) solo las decide ella.
 */
import { PROGRAMAS } from "./catalogos";
import type { DatosRegla } from "@/datos/actas";

export type Revision = { datos: DatosRegla; errores: Record<string, string> };

const entero = (v: string | undefined, min: number, max: number) => {
  const t = (v ?? "").trim();
  return /^\d{1,3}$/.test(t) && Number(t) >= min && Number(t) <= max ? Number(t) : null;
};
const fechaValida = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

export function revisarRegla(v: Record<string, string>): Revision {
  const e: Record<string, string> = {};
  const programa = (v.programa ?? "").trim();
  if (!PROGRAMAS.includes(programa as never)) e.programa = "Elija el programa.";
  const desde = entero(v.nivel_desde, 1, 99), hasta = entero(v.nivel_hasta, 1, 99);
  if (desde === null) e.nivel_desde = "Un número de nivel del 1 al 99.";
  if (hasta === null) e.nivel_hasta = "Un número de nivel del 1 al 99.";
  else if (desde !== null && hasta < desde) e.nivel_hasta = "Debe ser igual o mayor que el nivel inicial.";
  const vigente = (v.vigente_desde ?? "").trim();
  if (!fechaValida(vigente)) e.vigente_desde = "Escriba una fecha válida.";
  const minima = entero(v.nota_minima, 0, 100);
  if (minima === null) e.nota_minima = "Un número entero del 0 al 100.";
  const textoFranja = (v.condicionado_desde ?? "").trim();
  const franja = textoFranja === "" ? null : entero(textoFranja, 0, 100);
  if (textoFranja !== "" && franja === null) e.condicionado_desde = "Un número entero del 0 al 100, o vacío si no hay Condicionado.";
  else if (franja !== null && minima !== null && franja >= minima) e.condicionado_desde = "Debe ser menor que la nota mínima.";
  return {
    errores: e,
    datos: {
      programa, nivel_desde: desde ?? 0, nivel_hasta: hasta ?? 0, vigente_desde: vigente, nota_minima: minima ?? 0,
      // RN-05: en el nivel siguiente, el Condicionado exige la nota mínima.
      condicionado_desde: franja, nota_condicion: franja === null ? null : minima,
      provisional: v.provisional === "on" || v.provisional === "true",
    },
  };
}
