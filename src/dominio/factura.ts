/**
 * Factura registrada (spec 003, CE-52 a CE-58; diccionario de datos, Factura).
 * El sistema solo registra lo impreso en el talonario: no genera facturas (CE-64).
 * La base vuelve a revisar todo; esto avisa en el formulario.
 */
import { esFechaReal } from "./edad";

export const MONEDAS = ["USD", "NIO"] as const;
export type Moneda = (typeof MONEDAS)[number];
export const FORMAS_PAGO = ["Efectivo", "Tarjeta", "Transferencia"] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];

/** CE-56: más de US$200, o lo mismo en córdobas a la tasa oficial fija del BCN
 *  (36.6243 C$ por dólar): C$7,325. */
export const UMBRAL_ATIPICO: Record<Moneda, number> = { USD: 200, NIO: 7325 };
export const esMontoAtipico = (monto: number, moneda: Moneda) => monto > UMBRAL_ATIPICO[moneda];

const SIMBOLO: Record<Moneda, string> = { USD: "US$", NIO: "C$" };
/** 1245.5 → «C$1,245.50». */
export function formatoMonto(monto: number, moneda: string): string {
  const s = SIMBOLO[moneda as Moneda] ?? `${moneda} `;
  return `${s}${monto.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Lo que se escribe en el formulario: la coma separa miles, el punto los decimales. */
export function leerMonto(texto: string): number | null {
  const t = texto.trim().replace(/^(US\$|C\$|\$)\s*/i, "");
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(t)) return null;
  return Number(t.replace(/,/g, ""));
}

export interface FormularioFactura {
  serie: string; numero: string; fecha_emision: string; monto: string; moneda: string; forma_pago: string;
  estudiantes: string[]; inscripcion_id?: string;
}
export interface DatosFactura {
  serie: string; numero: number; fecha_emision: string; monto: number; moneda: Moneda; forma_pago: FormaPago;
  estudiantes: string[]; inscripcion_id: string | null;
}

/** CE-52 a CE-57. `hoy` en Managua (AAAA-MM-DD), como parámetro: se puede probar. */
export function revisarFactura(f: FormularioFactura, hoy: string): { errores: Partial<Record<keyof FormularioFactura, string>>; datos: DatosFactura | null } {
  const errores: Partial<Record<keyof FormularioFactura, string>> = {};
  const serie = (f.serie || "B").trim().toUpperCase();
  if (!/^[A-Z]$/.test(serie)) errores.serie = "La serie es una sola letra.";
  const numero = Number(f.numero.trim());
  if (!/^\d{1,5}$/.test(f.numero.trim()) || numero < 1) errores.numero = "El número es un entero de 1 a 5 cifras.";
  const fecha = f.fecha_emision.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) errores.fecha_emision = "Escriba el día, el mes y el año (dd/mm/aaaa).";
  else if (!esFechaReal(fecha)) errores.fecha_emision = "Esa fecha no existe.";
  else if (fecha > hoy) errores.fecha_emision = "La fecha de emisión no puede ser posterior a hoy.";
  const monto = leerMonto(f.monto);
  if (monto === null || monto < 0.01 || monto > 9999.99) errores.monto = "El monto va de 0.01 a 9,999.99, con dos decimales como máximo.";
  if (!(MONEDAS as readonly string[]).includes(f.moneda)) errores.moneda = "Elija US$ o C$.";
  const forma = f.forma_pago || "Efectivo";
  if (!(FORMAS_PAGO as readonly string[]).includes(forma)) errores.forma_pago = "Elija Efectivo, Tarjeta o Transferencia.";
  const estudiantes = [...new Set(f.estudiantes.filter(Boolean))];
  if (estudiantes.length === 0) errores.estudiantes = "La factura debe amparar al menos un estudiante.";
  if (Object.keys(errores).length) return { errores, datos: null };
  return { errores, datos: { serie, numero, fecha_emision: fecha, monto: monto!, moneda: f.moneda as Moneda,
    forma_pago: forma as FormaPago, estudiantes, inscripcion_id: f.inscripcion_id || null } };
}
