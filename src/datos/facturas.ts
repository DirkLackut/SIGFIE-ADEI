/**
 * Facturas y estado de matrícula (spec 003). La base decide (014, D34); aquí se
 * llaman las operaciones y se traducen sus errores, con el campo cuando se sabe.
 */
import type { Rpc, ErrorBD } from "./rpc";
import { traducirError } from "./errores";
import type { DatosFactura } from "@/dominio/factura";

type Error_ = { estado: "error"; campo?: string; mensaje: string };
const error = (e: ErrorBD): Error_ => {
  const t = traducirError(e);
  return t.campo ? { estado: "error", campo: t.campo, mensaje: t.mensaje } : { estado: "error", mensaje: t.mensaje };
};

export type RespuestaFactura =
  | { estado: "registrada" | "corregida"; id: string }
  | { estado: "duplicada"; id: string; serie: string; numero: number }
  | { estado: "atipico"; monto: number; moneda: string }
  | { estado: "conflicto"; version: number }
  | Error_;

/** CE-52 a CE-61 */
export async function registrarFactura(rpc: Rpc, datos: DatosFactura, confirmar: boolean): Promise<RespuestaFactura> {
  const { data, error: e } = await rpc<RespuestaFactura>("registrar_factura", { p_datos: datos, p_confirmar: confirmar });
  return e ? error(e) : data!;
}

/** CE-62 */
export async function corregirFactura(rpc: Rpc, id: string, version: number, datos: DatosFactura, motivo: string,
                                      confirmar: boolean): Promise<RespuestaFactura> {
  const { data, error: e } = await rpc<RespuestaFactura>("corregir_factura",
    { p_id: id, p_version: version, p_datos: datos, p_motivo: motivo, p_confirmar: confirmar });
  return e ? error(e) : data!;
}

/** CE-63 */
export async function anularFactura(rpc: Rpc, id: string, motivo: string): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const { error: e } = await rpc("anular_factura", { p_id: id, p_motivo: motivo });
  return e ? { ok: false, mensaje: traducirError(e).mensaje } : { ok: true };
}

export type RespuestaEstado =
  | { estado: "cambiado"; estado_matricula: string; fecha: string }
  | { estado: "advertir"; inscripciones: { inscripcion_id: string; grupo_id: string; codigo_grupo: string; nivel: string; estado_acta: string }[] }
  | Error_;

/** CE-67 a CE-74 */
export async function cambiarEstadoMatricula(rpc: Rpc, estudianteId: string, estado: string, fecha: string | null,
                                             observacion: string | null, confirmar: boolean): Promise<RespuestaEstado> {
  const { data, error: e } = await rpc<RespuestaEstado>("cambiar_estado_matricula",
    { p_estudiante: estudianteId, p_estado: estado, p_fecha: fecha, p_observacion: observacion, p_confirmar: confirmar });
  return e ? error(e) : data!;
}
