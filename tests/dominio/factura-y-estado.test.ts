import { describe, test, expect } from "vitest";
import { revisarFactura, esMontoAtipico, formatoMonto, leerMonto } from "@/dominio/factura";
import { revisarCambioEstado } from "@/dominio/estado-matricula";
import { mesEnCurso, describirPeriodo } from "@/dominio/periodo";
import { enmascarar } from "@/dominio/enmascarar";
import { VECTORES_ENMASCARAR } from "../apoyo/vectores-enmascarar";

const hoy = "2026-11-02";
const form = { serie: "b", numero: "42501", fecha_emision: "2026-10-30", monto: "34", moneda: "USD", forma_pago: "", estudiantes: ["e1", "e1", "e2"] };

describe("factura (CE-52 a CE-58)", () => {
  test("CE-52, CE-53 · una factura válida: serie en mayúscula, Efectivo por omisión, sin estudiantes repetidos", () => {
    expect(revisarFactura(form, hoy)).toEqual({ errores: {}, datos: { serie: "B", numero: 42501, fecha_emision: "2026-10-30",
      monto: 34, moneda: "USD", forma_pago: "Efectivo", estudiantes: ["e1", "e2"], inscripcion_id: null } });
  });

  test("CE-53, CE-55, CE-57 · los errores, uno por campo", () => {
    const r = revisarFactura({ serie: "BB", numero: "123456", fecha_emision: "2026-11-03", monto: "0", moneda: "EUR", forma_pago: "Cheque", estudiantes: [] }, hoy);
    expect(Object.keys(r.errores).sort()).toEqual(["estudiantes", "fecha_emision", "forma_pago", "moneda", "monto", "numero", "serie"]);
    expect(r.errores.fecha_emision).toMatch(/posterior a hoy/);
    expect(r.datos).toBeNull();
    expect(revisarFactura({ ...form, fecha_emision: "2026-02-30" }, hoy).errores.fecha_emision).toMatch(/no existe/);
    expect(revisarFactura({ ...form, numero: "0" }, hoy).errores.numero).toBeDefined();
  });

  test("CE-55 · el monto: miles con coma, decimales con punto, hasta dos", () => {
    expect(leerMonto("1,245.50")).toBe(1245.5);
    expect(leerMonto("C$ 1245.5")).toBe(1245.5);
    expect(leerMonto("12.345")).toBeNull();
    expect(leerMonto("12,5")).toBeNull();
    expect(leerMonto("abc")).toBeNull();
    expect(revisarFactura({ ...form, monto: "10000" }, hoy).errores.monto).toBeDefined();
    expect(revisarFactura({ ...form, monto: "9,999.99" }, hoy).errores.monto).toBeUndefined();
  });

  test("CE-56 · monto atípico: más de US$200 o de C$7,325", () => {
    expect([esMontoAtipico(200, "USD"), esMontoAtipico(200.01, "USD"), esMontoAtipico(7325, "NIO"), esMontoAtipico(7400, "NIO")])
      .toEqual([false, true, false, true]);
  });

  test("CE-58 · el monto se muestra en su moneda", () => {
    expect(formatoMonto(34, "USD")).toBe("US$34.00");
    expect(formatoMonto(1245.5, "NIO")).toBe("C$1,245.50");
  });
});

describe("estado de matrícula (CE-67 a CE-70)", () => {
  const base = { actual: "Activo", nuevo: "Desertor", fecha: "", ultimoCambio: null as string | null, observacion: "" };
  test("CE-69 · sin fecha, hoy; una anterior se acepta", () => {
    expect(revisarCambioEstado(base, hoy)).toEqual({ errores: {}, datos: { estado: "Desertor", fecha: hoy, observacion: null } });
    expect(revisarCambioEstado({ ...base, fecha: "2026-10-01", observacion: "  Se mudó  " }, hoy).datos)
      .toEqual({ estado: "Desertor", fecha: "2026-10-01", observacion: "Se mudó" });
  });

  test("CE-68, CE-69, CE-70 · mismo estado, fecha futura, anterior al último cambio, observación larga", () => {
    expect(revisarCambioEstado({ ...base, nuevo: "Activo" }, hoy).errores.nuevo).toMatch(/ya está en estado Activo/);
    expect(revisarCambioEstado({ ...base, fecha: "2026-11-03" }, hoy).errores.fecha).toMatch(/posterior a hoy/);
    expect(revisarCambioEstado({ ...base, fecha: "2026-09-01", ultimoCambio: "2026-10-01" }, hoy).errores.fecha).toMatch(/01\/10\/2026/);
    expect(revisarCambioEstado({ ...base, observacion: "x".repeat(301) }, hoy).errores.observacion).toMatch(/300/);
    expect(revisarCambioEstado({ ...base, nuevo: "Suspendido" }, hoy).errores.nuevo).toBeDefined();
  });
});

describe("período (CE-76, CE-83)", () => {
  test("el mes en curso, también en febrero de un año bisiesto", () => {
    expect(mesEnCurso("2026-11-02")).toEqual({ desde: "2026-11-01", hasta: "2026-11-30" });
    expect(mesEnCurso("2028-02-15")).toEqual({ desde: "2028-02-01", hasta: "2028-02-29" });
    expect(mesEnCurso("2026-12-31")).toEqual({ desde: "2026-12-01", hasta: "2026-12-31" });
  });

  test("en palabras: el mes completo se dice por su nombre", () => {
    expect(describirPeriodo("2026-11-01", "2026-11-30")).toBe("noviembre de 2026");
    expect(describirPeriodo("2026-10-15", "2026-11-14")).toBe("del 15/10/2026 al 14/11/2026");
  });
});

describe("CE-94 · enmascarar cédulas y teléfonos (mismos casos que la base)", () => {
  test.each(VECTORES_ENMASCARAR)("%s", (entrada, salida) => expect(enmascarar(entrada)).toBe(salida));
});
