/**
 * T24 — 014_consulta_y_reportes.sql, parte 1: facturas. CE-52 a CE-66.
 * Datos inventados (constitución, principio 3).
 */
import { describe, test, expect, beforeAll } from "vitest";
import { crearBanco, comoUsuario } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa } from "../apoyo/acta";
import { diasDesdeHoy } from "../apoyo/escenario";

let e: EscenarioActa;
let otra: EscenarioActa;
let numero = 42500;

beforeAll(async () => {
  const { db } = await crearBanco();
  e = await crearEscenarioActa(db);
  otra = await crearEscenarioActa(db, "OTRA");
});

type Datos = Record<string, unknown>;
const datos = (estudiantes: string[], extra: Datos = {}): Datos => ({
  serie: "B", numero: ++numero, fecha_emision: diasDesdeHoy(0), monto: 34, moneda: "USD",
  forma_pago: "Efectivo", estudiantes, ...extra,
});
const registrar = (d: Datos, confirmar = false, quien = e.asis) =>
  e.llamar(quien, "registrar_factura($1, $2)", [JSON.stringify(d), confirmar]);
const factura = async (id: string) =>
  (await e.db.query<Record<string, unknown>>("select * from factura where id = $1", [id])).rows[0];
const amparados = async (id: string) =>
  (await e.db.query<{ estudiante_id: string }>("select estudiante_id from factura_estudiante where factura_id = $1 order by 1", [id]))
    .rows.map((r) => r.estudiante_id);

describe("registrar_factura (CE-52 a CE-61)", () => {
  test("CE-52, CE-58 · registra la factura con su monto en la moneda de origen", async () => {
    const est = await e.estudiante();
    const r = await registrar(datos([est], { monto: 1245.5, moneda: "NIO" }));
    expect(r.estado).toBe("registrada");
    const f = await factura(r.id as string);
    expect([f.serie, Number(f.monto), f.moneda, f.forma_pago]).toEqual(["B", 1245.5, "NIO", "Efectivo"]);
    expect(await amparados(r.id as string)).toEqual([est]);
  });

  test("CE-52 · sin estudiantes no hay factura", async () => {
    await expect(registrar(datos([]))).rejects.toThrow(/al menos un estudiante/);
  });

  test("CE-53 · la serie se guarda en mayúscula; número de 1 a 5 cifras", async () => {
    const est = await e.estudiante();
    const r = await registrar(datos([est], { serie: "b" }));
    expect((await factura(r.id as string)).serie).toBe("B");
    await expect(registrar(datos([est], { numero: 100000 }))).rejects.toMatchObject({ constraint: "factura_numero_rango" });
    await expect(registrar(datos([est], { numero: 0 }))).rejects.toMatchObject({ constraint: "factura_numero_rango" });
    await expect(registrar(datos([est], { serie: "BB" }))).rejects.toMatchObject({ constraint: "factura_serie_formato" });
    await expect(registrar(datos([est], { moneda: "EUR" }))).rejects.toMatchObject({ constraint: "factura_moneda_valida" });
    await expect(registrar(datos([est], { forma_pago: "Cheque" }))).rejects.toMatchObject({ constraint: "factura_forma_pago_valida" });
  });

  test("CE-53 · la forma de pago inicial es Efectivo", async () => {
    const est = await e.estudiante();
    const d = datos([est]); delete d.forma_pago;
    const r = await registrar(d);
    expect((await factura(r.id as string)).forma_pago).toBe("Efectivo");
  });

  test("CE-54 · serie y número repetidos: se rechaza e indica la factura existente", async () => {
    const est = await e.estudiante();
    const d = datos([est]);
    const r1 = await registrar(d);
    const r2 = await registrar({ ...d, estudiantes: [await e.estudiante()] });
    expect(r2).toMatchObject({ estado: "duplicada", id: r1.id, serie: "B", numero: d.numero });
  });

  test("CE-54, CE-98 de la 001 · el mismo número en otra organización no choca", async () => {
    const d = datos([await e.estudiante()]);
    await registrar(d);
    const r = await otra.llamar(otra.asis, "registrar_factura($1, false)", [JSON.stringify({ ...d, estudiantes: [await otra.estudiante()] })]);
    expect(r.estado).toBe("registrada");
  });

  test("CE-55 · el monto va de 0.01 a 9,999.99, con dos decimales como máximo", async () => {
    const est = await e.estudiante();
    for (const monto of [0, -5, 10000, 12.345]) {
      await expect(registrar(datos([est], { monto }), true)).rejects.toMatchObject({ constraint: "factura_monto_rango" });
    }
    expect((await registrar(datos([est], { monto: 0.01 }))).estado).toBe("registrada");
  });

  test("A05 · un dato inválido se rechaza con un mensaje propio, sin devolver la fila (T21)", async () => {
    // Newman (T21): la restricción de la tabla devolvía «Failing row contains (…)» con
    // identificadores internos. La función revisa antes, como la 012 en la spec 002.
    const est = await e.estudiante();
    const casos: [Datos, string, RegExp][] = [
      [{ monto: -10 }, "factura_monto_rango", /^El monto va de 0\.01 a 9,999\.99/],
      [{ monto: 12.345 }, "factura_monto_rango", /^El monto va de/],
      [{ monto: "mucho" }, "factura_monto_rango", /^El monto va de/],
      [{ moneda: "EUR" }, "factura_moneda_valida", /^Elija US\$ o C\$\.$/],
      [{ forma_pago: "Cheque" }, "factura_forma_pago_valida", /^Elija Efectivo, Tarjeta o Transferencia\.$/],
      [{ serie: "BB" }, "factura_serie_formato", /^La serie es una sola letra\.$/],
      [{ numero: "1; delete from factura" }, "factura_numero_rango", /^El número es un entero de 1 a 5 cifras\.$/],
      [{ numero: 0 }, "factura_numero_rango", /^El número es un entero/],
      [{ fecha_emision: "2026-02-31" }, "factura_fecha_valida", /^La fecha de emisión no es válida\.$/],
    ];
    for (const [cambio, restriccion, mensaje] of casos) {
      const err = await registrar(datos([est], cambio), true).then(() => null, (x: { code: string; message: string; detail?: string; constraint?: string }) => x);
      expect(err, JSON.stringify(cambio)).toMatchObject({ code: "23514", constraint: restriccion });
      expect(err!.message, JSON.stringify(cambio)).toMatch(mensaje);
      expect(err!.detail ?? "", JSON.stringify(cambio)).not.toMatch(/Failing row/);
    }
  });

  test("CE-56 · monto atípico: más de US$200 o de C$7,325 pide confirmar", async () => {
    const est = await e.estudiante();
    expect(await registrar(datos([est], { monto: 200 }))).toMatchObject({ estado: "registrada" });
    expect(await registrar(datos([est], { monto: 250 }))).toMatchObject({ estado: "atipico" });
    expect(await registrar(datos([est], { monto: 7325, moneda: "NIO" }))).toMatchObject({ estado: "registrada" });
    expect(await registrar(datos([est], { monto: 7400, moneda: "NIO" }))).toMatchObject({ estado: "atipico" });
    expect(await registrar(datos([est], { monto: 250 }), true)).toMatchObject({ estado: "registrada" });
  });

  test("CE-57 · la fecha de emisión no puede ser posterior a hoy ni tener un año raro", async () => {
    const est = await e.estudiante();
    await expect(registrar(datos([est], { fecha_emision: diasDesdeHoy(1) }))).rejects.toThrow(/posterior a hoy/);
    await expect(registrar(datos([est], { fecha_emision: "0999-01-01" }))).rejects.toThrow(/cuatro cifras/);
    expect((await registrar(datos([est], { fecha_emision: diasDesdeHoy(-400) }))).estado).toBe("registrada");
  });

  test("CE-59 · una factura ampara a varios estudiantes (recibo familiar)", async () => {
    const a = await e.estudiante(), b = await e.estudiante(), c = await e.estudiante();
    const r = await registrar(datos([a, b, c]));
    expect(await amparados(r.id as string)).toEqual([a, b, c].sort());
  });

  test("CE-60 · la inscripción debe ser de un amparado y tener a lo sumo una factura", async () => {
    const { grupo, inscripciones: [i] } = await e.grupoCon(1);
    const est = (await e.db.query<{ estudiante_id: string }>("select estudiante_id from inscripcion where id = $1", [i])).rows[0].estudiante_id;
    const ajeno = await e.estudiante();
    await expect(registrar(datos([ajeno], { inscripcion_id: i }))).rejects.toThrow(/uno de los estudiantes amparados/);
    const r = await registrar(datos([est, ajeno], { inscripcion_id: i }));
    expect((await factura(r.id as string)).inscripcion_id).toBe(i);
    await expect(registrar(datos([est], { inscripcion_id: i }))).rejects.toThrow(/ya tiene la factura B-/);
    expect(grupo).toBeTruthy();
  });

  test("CE-95 · estudiantes o inscripciones de otra organización «no existen»", async () => {
    const ajeno = await otra.estudiante();
    await expect(registrar(datos([ajeno]))).rejects.toMatchObject({ code: "PT404" });
    const { inscripciones: [iAjena] } = await otra.grupoCon(1);
    await expect(registrar(datos([await e.estudiante()], { inscripcion_id: iAjena }))).rejects.toMatchObject({ code: "PT404" });
  });

  test("CE-66 · Dirección y el profesor no registran facturas", async () => {
    const est = await e.estudiante();
    for (const p of [e.dir, e.prof]) await expect(registrar(datos([est]), false, p)).rejects.toThrow(/Solo la Asistente/);
  });

  test("CE-17 de la 001 · la factura y sus vínculos quedan en la bitácora", async () => {
    const r = await registrar(datos([await e.estudiante()]));
    const a = await e.db.query("select 1 from auditoria where entidad = 'factura' and tipo_accion = 'Creación' and registro_afectado = $1 and usuario_id = $2",
      [r.id, e.asis.id]);
    expect(a.rows).toHaveLength(1);
    const v = await e.db.query("select 1 from auditoria where entidad = 'factura_estudiante' and tipo_accion = 'Creación' and registro_afectado like $1",
      [`${r.id}:%`]);
    expect(v.rows).toHaveLength(1);
  });
});

describe("corregir y anular (CE-62, CE-63)", () => {
  test("CE-62 · corregir exige motivo, valida igual y guarda el valor anterior", async () => {
    const est = await e.estudiante(), otro = await e.estudiante();
    const d = datos([est]);
    const r = await registrar(d);
    const corregir = (cambios: Datos, motivo: string | null, version = 1, confirmar = false) =>
      e.llamar(e.asis, "corregir_factura($1, $2, $3, $4, $5)", [r.id, version, JSON.stringify({ ...d, ...cambios }), motivo, confirmar]);
    await expect(corregir({ monto: 35 }, null)).rejects.toThrow(/motivo/);
    await expect(corregir({ monto: 0 }, "Monto mal copiado")).rejects.toMatchObject({ constraint: "factura_monto_rango" });
    await expect(corregir({ moneda: "EUR" }, "Moneda mal copiada")).rejects.toThrow(/^Elija US\$ o C\$\.$/);
    expect(await corregir({ monto: 300 }, "Monto mal copiado")).toMatchObject({ estado: "atipico" });
    expect(await corregir({ monto: 35, estudiantes: [est, otro] }, "Monto mal copiado")).toMatchObject({ estado: "corregida" });
    expect(Number((await factura(r.id as string)).monto)).toBe(35);
    expect(await amparados(r.id as string)).toEqual([est, otro].sort());
    const a = await e.db.query<{ valor_anterior: { monto: number }; detalle: string }>(
      "select valor_anterior, detalle from auditoria where entidad = 'factura' and tipo_accion = 'Modificación' and registro_afectado = $1", [r.id]);
    expect(Number(a.rows[0].valor_anterior.monto)).toBe(34);
    expect(a.rows[0].detalle).toMatch(/Monto mal copiado/);
  });

  test("CE-62 · otra sesión cambió la factura: no se sobrescribe", async () => {
    const r = await registrar(datos([await e.estudiante()]));
    const d = datos([await e.estudiante()]);
    expect(await e.llamar(e.asis, "corregir_factura($1, $2, $3, $4, false)", [r.id, 1, JSON.stringify(d), "Corrección uno"]))
      .toMatchObject({ estado: "corregida" });
    expect(await e.llamar(e.asis, "corregir_factura($1, $2, $3, $4, false)", [r.id, 1, JSON.stringify(d), "Corrección dos"]))
      .toMatchObject({ estado: "conflicto" });
  });

  test("CE-62 · al corregir, la serie y el número siguen siendo únicos", async () => {
    const d1 = datos([await e.estudiante()]); const r1 = await registrar(d1);
    const d2 = datos([await e.estudiante()]); const r2 = await registrar(d2);
    const r = await e.llamar(e.asis, "corregir_factura($1, 1, $2, 'Número mal copiado', false)", [r2.id, JSON.stringify({ ...d2, numero: d1.numero })]);
    expect(r).toMatchObject({ estado: "duplicada", id: r1.id });
  });

  test("CE-63 · anular exige motivo, la quita de todo y la conserva en la bitácora", async () => {
    const { inscripciones: [i] } = await e.grupoCon(1);
    const est = (await e.db.query<{ estudiante_id: string }>("select estudiante_id from inscripcion where id = $1", [i])).rows[0].estudiante_id;
    const r = await registrar(datos([est], { inscripcion_id: i }));
    await expect(e.llamar(e.asis, "anular_factura($1, $2)", [r.id, ""])).rejects.toThrow(/motivo/);
    await e.llamar(e.asis, "anular_factura($1, $2)", [r.id, "Registrada por error"]);
    expect(await factura(r.id as string)).toBeUndefined();
    expect(await amparados(r.id as string)).toEqual([]);
    const a = await e.db.query<{ valor_anterior: { numero: number }; detalle: string }>(
      "select valor_anterior, detalle from auditoria where entidad = 'factura' and tipo_accion = 'Eliminación' and registro_afectado = $1", [r.id]);
    expect(a.rows[0].detalle).toMatch(/Registrada por error/);
    expect(a.rows[0].valor_anterior.numero).toBeGreaterThan(0);
    // La inscripción queda libre para otra factura.
    expect((await registrar(datos([est], { inscripcion_id: i }))).estado).toBe("registrada");
  });

  test("CE-66 · Dirección no corrige ni anula; una factura ajena «no existe»", async () => {
    const r = await registrar(datos([await e.estudiante()]));
    await expect(e.llamar(e.dir, "anular_factura($1, $2)", [r.id, "Intento de Dirección"])).rejects.toThrow(/Solo la Asistente/);
    await expect(otra.llamar(otra.asis, "anular_factura($1, $2)", [r.id, "Intento de otra academia"])).rejects.toMatchObject({ code: "PT404" });
  });
});

describe("lectura (CE-65, CE-95, D34)", () => {
  test("Asistente y Dirección leen las facturas; el profesor no ve ninguna", async () => {
    const r = await registrar(datos([await e.estudiante()]));
    const leer = (p: typeof e.asis) => comoUsuario(e.db, p, async (tx) =>
      (await tx.query("select id from factura where id = $1", [r.id])).rows.length);
    expect(await leer(e.asis)).toBe(1);
    expect(await leer(e.dir)).toBe(1);
    expect(await leer(e.prof)).toBe(0);
    expect(await leer(otra.asis)).toBe(0);
  });

  test("D34 · nadie escribe la tabla directamente por la API", async () => {
    await expect(comoUsuario(e.db, e.asis, (tx) => tx.query(
      "insert into factura (serie, numero, fecha_emision, monto, moneda, forma_pago) values ('B', 1, current_date, 10, 'USD', 'Efectivo')")))
      .rejects.toThrow(/permission denied/);
  });

  test("CE-64 · no hay ninguna operación para generar o imprimir facturas", async () => {
    const r = await e.db.query("select proname from pg_proc where proname ~ '(generar|imprimir|emitir)_factura'");
    expect(r.rows).toHaveLength(0);
  });
});
