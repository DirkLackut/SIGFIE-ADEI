/**
 * Cambio de estado de matrícula (spec 003, CE-67 a CE-70, RN-20). La base vuelve a
 * revisar todo (trigger y cambiar_estado_matricula); esto avisa en el formulario.
 */
import { esFechaReal } from "./edad";
import { fecha as formatoFecha } from "./formato";
import { ESTADOS_MATRICULA } from "./filtro";

export type EstadoMatricula = (typeof ESTADOS_MATRICULA)[number];

export interface CambioEstado { actual: string; nuevo: string; fecha: string; ultimoCambio: string | null; observacion: string }

/** `hoy` en Managua (AAAA-MM-DD), como parámetro: se puede probar. */
export function revisarCambioEstado(c: CambioEstado, hoy: string): {
  errores: Partial<Record<"nuevo" | "fecha" | "observacion", string>>;
  datos: { estado: EstadoMatricula; fecha: string; observacion: string | null } | null;
} {
  const errores: Partial<Record<"nuevo" | "fecha" | "observacion", string>> = {};
  if (!(ESTADOS_MATRICULA as readonly string[]).includes(c.nuevo)) errores.nuevo = "Elija Activo, Desertor o Egresado.";
  else if (c.nuevo === c.actual) errores.nuevo = `El estudiante ya está en estado ${c.actual}.`;          // CE-68
  const fecha = c.fecha.trim() || hoy;                                                                  // CE-69
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !esFechaReal(fecha)) errores.fecha = "Escriba una fecha que exista (dd/mm/aaaa).";
  else if (fecha > hoy) errores.fecha = "La fecha del cambio de estado no puede ser posterior a hoy.";
  else if (c.ultimoCambio && fecha < c.ultimoCambio) {
    errores.fecha = `La fecha del cambio no puede ser anterior al último cambio de estado (${formatoFecha(c.ultimoCambio)}).`;
  }
  const observacion = c.observacion.trim();
  if (observacion.length > 300) errores.observacion = "La observación admite hasta 300 caracteres.";        // CE-70
  if (Object.keys(errores).length) return { errores, datos: null };
  return { errores, datos: { estado: c.nuevo as EstadoMatricula, fecha, observacion: observacion || null } };
}
