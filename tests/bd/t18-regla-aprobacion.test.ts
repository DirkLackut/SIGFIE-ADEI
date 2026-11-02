/**
 * T18 — 012_captura_academica.sql, parte 1: la regla de aprobación como datos.
 * CE-20, CE-23 a CE-28, CE-57, CE-59, CE-61.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { crearBanco, comoUsuario } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa } from "../apoyo/acta";

let e: EscenarioActa;
const datos = (extra: Record<string, unknown> = {}) => JSON.stringify({
  programa: "Conversation", nivel_desde: 1, nivel_hasta: 99, vigente_desde: "2023-01-01",
  nota_minima: 80, condicionado_desde: 77, nota_condicion: 80, provisional: true, ...extra });

beforeAll(async () => {
  const { db } = await crearBanco();
  e = await crearEscenarioActa(db);
  await e.nivel(1, "Conversation");
  for (const o of [1, 3, 6, 12, 14]) await e.nivel(o);
});

describe("restricciones de la tabla (CE-24)", () => {
  test("la franja va bajo la mínima, y sus dos datos juntos", async () => {
    await expect(e.llamar(e.asis, "guardar_regla($1)", [datos({ condicionado_desde: 80 })]))
      .rejects.toThrow(/regla_franja_coherente/);
    await expect(e.llamar(e.asis, "guardar_regla($1)", [datos({ nota_condicion: "" })]))
      .rejects.toThrow(/regla_franja_coherente/);
  });

  test("el rango de niveles va de menor a mayor y las notas entre 0 y 100", async () => {
    await expect(e.llamar(e.asis, "guardar_regla($1)", [datos({ nivel_desde: 5, nivel_hasta: 2 })]))
      .rejects.toThrow(/regla_rango_niveles/);
    await expect(e.llamar(e.asis, "guardar_regla($1)", [datos({ nota_minima: 101 })])).rejects.toThrow(/check/);
  });

  test("el programa debe existir en el catálogo de niveles", async () => {
    await expect(e.llamar(e.asis, "guardar_regla($1)", [datos({ programa: "Conversacion" })]))
      .rejects.toMatchObject({ constraint: "regla_programa_existe" });
  });

  test("una regla sin franja es válida", async () => {
    const r = await e.llamar(e.asis, "guardar_regla($1)", [datos({ vigente_desde: "2030-01-01",
      condicionado_desde: null, nota_condicion: null })]);
    expect(r.estado).toBe("creada");
    await e.llamar(e.asis, "eliminar_regla($1)", [r.id]);
  });
});

describe("superposición y vigencia (CE-20, CE-26)", () => {
  test("CE-26 · dos reglas del mismo programa y vigencia no cubren el mismo nivel", async () => {
    const a = await e.llamar(e.asis, "guardar_regla($1)", [datos({ programa: "Curso principal", nivel_desde: 1, nivel_hasta: 5,
      nota_minima: 75, condicionado_desde: 72, nota_condicion: 75, vigente_desde: "2031-01-01" })]);
    expect(a.estado).toBe("creada");
    await expect(e.llamar(e.asis, "guardar_regla($1)", [datos({ programa: "Curso principal", nivel_desde: 5, nivel_hasta: 11,
      vigente_desde: "2031-01-01" })])).rejects.toMatchObject({ constraint: "regla_superpuesta" });
    // Otra fecha de vigencia sí: es la regla que la sustituye.
    const b = await e.llamar(e.asis, "guardar_regla($1)", [datos({ programa: "Curso principal", nivel_desde: 5, nivel_hasta: 11,
      vigente_desde: "2032-01-01" })]);
    expect(b.estado).toBe("creada");
    // Rangos contiguos con la misma fecha, también.
    const c = await e.llamar(e.asis, "guardar_regla($1)", [datos({ programa: "Curso principal", nivel_desde: 6, nivel_hasta: 11,
      vigente_desde: "2031-01-01" })]);
    expect(c.estado).toBe("creada");
    for (const r of [a, b, c]) await e.llamar(e.asis, "eliminar_regla($1)", [r.id]);
  });

  test("CE-20 · un grupo se evalúa con la regla vigente en su fecha de inicio", async () => {
    const nivel = await e.nivel(3);
    await e.regla("Curso principal", 3, 3, 75, [72, 75], "2020-01-01");
    await e.regla("Curso principal", 3, 3, 90, [87, 90], "2099-01-01");   // aún no vigente
    const { inscripciones: [i] } = await e.grupoCon(1, { nivel });
    await e.parciales(i, [80, 80, 80]);
    const r = await e.resultado(i);
    expect(r.estado).toBe("Aprobado");
  });

  test("CE-23 · sin regla aplicable el estado queda Pendiente y se señala", async () => {
    const nivel = await e.nivel(14);
    const { inscripciones: [i] } = await e.grupoCon(1, { nivel });
    await e.parciales(i, [95, 95, 95]);
    const r = await e.resultado(i);
    expect(r.nota_final).toBe(95);
    expect(r.estado).toBe("Pendiente");
    expect(r.sin_regla).toBe(true);
  });
});

describe("provisional (CE-27, CE-28)", () => {
  test("CE-27 · corregir una regla provisional cambia el estado de los grupos evaluados con ella", async () => {
    const nivel = await e.nivel(12);
    const id = await e.regla("Curso principal", 12, 13, 90, [87, 90], "2023-01-01", true);
    const { inscripciones: [i] } = await e.grupoCon(1, { nivel });
    await e.parciales(i, [85, 85, 85]);
    expect((await e.resultado(i)).estado).toBe("Reprobado");
    const r = await e.llamar(e.asis, "guardar_regla($1)", [datos({ id, programa: "Curso principal", nivel_desde: 12,
      nivel_hasta: 13, nota_minima: 80, condicionado_desde: 77, nota_condicion: 80, provisional: false })]);
    expect(r.estado).toBe("corregida");
    expect((await e.resultado(i)).estado).toBe("Aprobado");
  });

  test("CE-28 · una regla confirmada no se modifica ni se borra", async () => {
    const id = await e.regla("Conversation", 1, 99, 80, [77, 80], "2024-06-01", false);
    await expect(e.llamar(e.asis, "guardar_regla($1)", [datos({ id, vigente_desde: "2024-06-01" })]))
      .rejects.toThrow(/ya está confirmada/);
    await expect(e.llamar(e.asis, "eliminar_regla($1)", [id])).rejects.toThrow(/ya está confirmada/);
  });

  test("la regla que no existe responde 404", async () => {
    await expect(e.llamar(e.asis, "eliminar_regla($1)", ["00000000-0000-0000-0000-000000000000"]))
      .rejects.toMatchObject({ code: "PT404" });
  });
});

describe("permisos, aislamiento y auditoría (CE-57 a CE-59, CE-61)", () => {
  test("CE-57 · Dirección y el profesor no registran reglas", async () => {
    for (const p of [e.dir, e.prof])
      await expect(e.llamar(p, "guardar_regla($1)", [datos({ vigente_desde: "2033-01-01" })])).rejects.toThrow(/Solo la Asistente/);
  });

  test("nadie escribe directo en la tabla (D26)", async () => {
    await expect(comoUsuario(e.db, e.asis, (tx) => tx.query(
      "insert into regla_aprobacion (programa, nivel_desde, nivel_hasta, vigente_desde, nota_minima) values ('Conversation',1,1,'2040-01-01',80)")))
      .rejects.toThrow(/permission denied/);
  });

  test("CE-58 · los tres roles leen la regla", async () => {
    for (const p of [e.asis, e.dir, e.prof]) {
      const n = await comoUsuario(e.db, p, async (tx) => (await tx.query<{ n: number }>("select count(*)::int n from regla_aprobacion")).rows[0].n);
      expect(n).toBeGreaterThan(0);
    }
  });

  test("CE-59 · otra organización no ve ni corrige las reglas", async () => {
    const otra = await crearEscenarioActa(e.db, "OTRA");
    const n = await comoUsuario(e.db, otra.asis, async (tx) => (await tx.query<{ n: number }>("select count(*)::int n from regla_aprobacion")).rows[0].n);
    expect(n).toBe(0);
    const id = await e.regla("Conversation", 1, 99, 80, [77, 80], "2035-01-01", true);
    await expect(otra.llamar(otra.asis, "eliminar_regla($1)", [id])).rejects.toMatchObject({ code: "PT404" });
  });

  test("CE-61 · crear y corregir una regla queda en la auditoría", async () => {
    const r = await e.llamar(e.asis, "guardar_regla($1)", [datos({ vigente_desde: "2036-01-01" })]);
    await e.llamar(e.asis, "guardar_regla($1)", [datos({ id: r.id, vigente_desde: "2036-01-01", nota_minima: 85,
      condicionado_desde: 82, nota_condicion: 85 })]);
    const a = await e.db.query<{ tipo_accion: string; usuario_id: string }>(
      "select tipo_accion, usuario_id from auditoria where entidad = 'regla_aprobacion' and registro_afectado = $1 order by fecha_hora", [r.id]);
    expect(a.rows.map((x) => x.tipo_accion)).toEqual(["Creación", "Modificación"]);
    expect(a.rows[0].usuario_id).toBe(e.asis.id);
  });
});
