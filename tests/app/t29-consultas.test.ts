/**
 * T29 — la spec 003 por el camino de la app (src/datos/consultas.ts y facturas.ts),
 * contra PGlite: las respuestas llegan con la forma que esperan las pantallas y los
 * errores de la base se traducen a un mensaje para la persona. CE-18, CE-95, CE-97.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { crearBanco } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa } from "../apoyo/acta";
import { rpcComo } from "../apoyo/rpc-pglite";
import { diasDesdeHoy } from "../apoyo/escenario";
import type { Rpc } from "@/datos/rpc";
import { filtrar, historialAcademico, hojaMatricula, panelActas, reporteSucursales, bitacora, respaldo } from "@/datos/consultas";
import { registrarFactura, corregirFactura, anularFactura, cambiarEstadoMatricula } from "@/datos/facturas";

let e: EscenarioActa, asis: Rpc, dir: Rpc, prof: Rpc, otra: EscenarioActa, asisOtra: Rpc;

beforeAll(async () => {
  const { db } = await crearBanco();
  e = await crearEscenarioActa(db);
  otra = await crearEscenarioActa(db, "OTRA");
  await e.nivel(6);
  asis = rpcComo(db, e.asis); dir = rpcComo(db, e.dir); prof = rpcComo(db, e.prof); asisOtra = rpcComo(db, otra.asis);
});

const factura = (estudiantes: string[], extra: Record<string, unknown> = {}) => ({
  serie: "B", numero: 45000 + Math.floor(Math.random() * 4000), fecha_emision: diasDesdeHoy(0), monto: 34, moneda: "USD" as const,
  forma_pago: "Efectivo" as const, estudiantes, inscripcion_id: null, ...extra });

describe("T29 · datos/consultas", () => {
  test("CE-10 · filtrar devuelve total y filas; CE-18 · el profesor recibe «denegado»", async () => {
    await e.grupoCon(2);
    const r = await filtrar(asis, {}, "inscripciones", 1, "pantalla");
    expect(r.estado).toBe("ok");
    if (r.estado === "ok") expect(r.filas.length).toBe(r.total);
    expect(await filtrar(prof, {}, "inscripciones", 1, "pantalla")).toEqual({ estado: "denegado" });
  });

  test("CE-6 · criterios incoherentes llegan con su campo y su mensaje", async () => {
    expect(await filtrar(asis, { desde: "2026-10-31", hasta: "2026-10-01" }, "inscripciones", 1, "pantalla"))
      .toMatchObject({ estado: "criterios_invalidos", campo: "hasta", mensaje: expect.stringMatching(/anterior a la inicial/) });
  });

  test("CE-36 a CE-41 · historial; CE-97 · un estudiante ajeno es «no_existe»", async () => {
    const { inscripciones: [i] } = await e.grupoCon(1);
    const est = (await e.db.query<{ estudiante_id: string }>("select estudiante_id from inscripcion where id = $1", [i])).rows[0].estudiante_id;
    const h = await historialAcademico(dir, est);
    expect(h.estado).toBe("ok");
    if (h.estado === "ok") expect(h.inscripciones[0].id).toBe(i);
    expect(await historialAcademico(asisOtra, est)).toEqual({ estado: "no_existe" });
    expect(await historialAcademico(prof, est)).toEqual({ estado: "denegado" });
  });

  test("CE-44 · Hoja de matrícula solo para la Asistente", async () => {
    const { inscripciones: [i] } = await e.grupoCon(1);
    expect((await hojaMatricula(asis, i)).estado).toBe("ok");
    expect(await hojaMatricula(dir, i)).toEqual({ estado: "denegado" });
    expect(await hojaMatricula(asis, "00000000-0000-0000-0000-000000000000")).toEqual({ estado: "no_existe" });
  });

  test("CE-75, CE-81, CE-89, CE-31 · panel, reporte, bitácora y respaldo", async () => {
    expect((await panelActas(asis, null, null)).estado).toBe("ok");
    expect((await reporteSucursales(dir, null, null, null)).estado).toBe("ok");
    expect((await bitacora(dir, {}, 1)).estado).toBe("ok");
    expect(await bitacora(asis, {}, 1)).toEqual({ estado: "denegado" });
    expect((await respaldo(asis)).estado).toBe("ok");
    expect(await respaldo(dir)).toEqual({ estado: "denegado" });
    expect(await panelActas(asis, diasDesdeHoy(5), diasDesdeHoy(-5))).toMatchObject({ estado: "error", mensaje: expect.stringMatching(/anterior a la inicial/) });
  });
});

describe("T29 · datos/facturas", () => {
  test("CE-52, CE-54, CE-56 · registrar: registrada, duplicada y atípico", async () => {
    const est = await e.estudiante();
    const d = factura([est]);
    expect(await registrarFactura(asis, d, false)).toMatchObject({ estado: "registrada" });
    expect(await registrarFactura(asis, d, false)).toMatchObject({ estado: "duplicada", serie: "B", numero: d.numero });
    expect(await registrarFactura(asis, { ...d, numero: d.numero + 1, monto: 250 }, false)).toMatchObject({ estado: "atipico" });
  });

  test("CE-55, CE-66 · los errores de la base llegan en palabras", async () => {
    const est = await e.estudiante();
    expect(await registrarFactura(asis, factura([est], { monto: 0 }), true)).toEqual({ estado: "error", campo: "monto", mensaje: "El monto va de 0.01 a 9,999.99, con dos decimales como máximo." });
    expect(await registrarFactura(dir, factura([est]), true)).toEqual({ estado: "error", mensaje: "Solo la Asistente de Dirección puede hacer esta operación." });
  });

  test("CE-62, CE-63 · corregir y anular", async () => {
    const est = await e.estudiante();
    const d = factura([est]);
    const r = await registrarFactura(asis, d, false);
    const id = (r as { id: string }).id;
    expect(await corregirFactura(asis, id, 1, { ...d, monto: 35 }, "Monto mal copiado", false)).toMatchObject({ estado: "corregida" });
    expect(await anularFactura(asis, id, "Registrada por error")).toEqual({ ok: true });
    expect(await anularFactura(asis, id, "Otra vez")).toEqual({ ok: false, mensaje: "La factura no existe." });
  });

  test("CE-67, CE-71 · cambiar el estado: advertir y cambiado", async () => {
    const { inscripciones: [i] } = await e.grupoCon(1);
    const est = (await e.db.query<{ estudiante_id: string }>("select estudiante_id from inscripcion where id = $1", [i])).rows[0].estudiante_id;
    const r = await cambiarEstadoMatricula(asis, est, "Desertor", null, null, false);
    expect(r.estado).toBe("advertir");
    expect(await cambiarEstadoMatricula(asis, est, "Desertor", null, "Se mudó", true)).toMatchObject({ estado: "cambiado" });
    expect(await cambiarEstadoMatricula(asis, est, "Desertor", null, null, true)).toMatchObject({ estado: "error", mensaje: expect.stringMatching(/ya está en estado Desertor/) });
  });
});
