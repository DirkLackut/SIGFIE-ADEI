/** T5 — 001_utilidades.sql */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco, crearUsuarioAuth, comoUsuario } from "../apoyo/banco";
import { normalizar } from "@/dominio/texto";

let db: PGlite;
beforeAll(async () => { ({ db } = await crearBanco()); });

const uno = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];

describe("normalizar() de la base = normalizar() de la app", () => {
  // Si la base y la app normalizaran distinto, la unicidad de los catálogos y la
  // búsqueda darían resultados distintos según dónde se compare.
  const casos = [
    "Gutiérrez", "  GUTIÉRREZ  ", "Muñoz", "Agüero", "Ángel", "Íñigo", "D'Arbelles",
    "Intermediate   I-I", "María\tJosé", "Øster", "Straße", "Æsir", "Łukasz", "Đorđe",
    "Nguyễn", "François", "Jürgen", "Çelik", "  ",
  ];
  test.each(casos)("CE-22, CE-42 · %j", async (c) => {
    const r = await uno<{ v: string }>("select public.normalizar($1) v", [c]);
    expect(r.v).toBe(normalizar(c));
  });
});

describe("hoy_managua() (CE-77)", () => {
  test("CE-77 · a las 21:30 de Managua sigue siendo el mismo día aunque en UTC ya sea mañana", async () => {
    // Se fija el reloj de la transacción con un timestamp concreto.
    const r = await uno<{ d: string }>(
      "select ((timestamptz '2026-10-30 03:30:00+00') at time zone 'America/Managua')::date::text d",
    );
    expect(r.d).toBe("2026-10-29");
    const f = await uno<{ ok: boolean }>(
      "select public.hoy_managua() = (now() at time zone 'America/Managua')::date ok",
    );
    expect(f.ok).toBe(true);
  });
});

describe("organización (CE-95)", () => {
  test("CE-99 · el código es de 2 a 10 letras mayúsculas", async () => {
    await expect(db.query("insert into organizacion (codigo, nombre) values ('adei', 'Academia')")).rejects.toThrow(
      /organizacion_codigo_formato/,
    );
    await expect(db.query("insert into organizacion (codigo, nombre) values ('AD-EI', 'Academia')")).rejects.toThrow(
      /organizacion_codigo_formato/,
    );
  });

  test("CE-95 · no hay dos organizaciones con el mismo código", async () => {
    await db.query("insert into organizacion (codigo, nombre) values ('UNICA', 'Una')");
    await expect(db.query("insert into organizacion (codigo, nombre) values ('UNICA', 'Otra')")).rejects.toThrow(
      /duplicate key/,
    );
  });
});

describe("correlativos (CE-29, CE-48, CE-99, P8)", () => {
  let a: string, b: string;
  beforeAll(async () => {
    a = (await uno<{ id: string }>("insert into organizacion (codigo, nombre) values ('ACAA', 'Academia A') returning id")).id;
    b = (await uno<{ id: string }>("insert into organizacion (codigo, nombre) values ('ACAB', 'Academia B') returning id")).id;
  });
  const sig = (org: string, tipo: string, anio: number) =>
    uno<{ n: number }>("select public.siguiente_correlativo($1, $2, $3) n", [org, tipo, anio]).then((r) => r.n);

  test("CE-29 · cada pedido da el siguiente número, sin repetir", async () => {
    const ns = [];
    for (let i = 0; i < 50; i++) ns.push(await sig(a, "estudiante", 2026));
    expect(ns).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  test("P8 · el año nuevo vuelve a empezar en 1", async () => {
    await sig(a, "grupo", 2026); await sig(a, "grupo", 2026);
    expect(await sig(a, "grupo", 2027)).toBe(1);
  });

  test("CE-99 · cada organización lleva su propia cuenta", async () => {
    await sig(a, "estudiante", 2030); await sig(a, "estudiante", 2030);
    expect(await sig(b, "estudiante", 2030)).toBe(1);
  });

  test("CE-48 · estudiantes y grupos llevan cuentas separadas", async () => {
    expect(await sig(b, "grupo", 2031)).toBe(1);
    expect(await sig(b, "estudiante", 2031)).toBe(1);
  });

  test("CE-29 · si la transacción se deshace, el número no se consume", async () => {
    await sig(a, "estudiante", 2040); // 1
    await db.transaction(async (tx) => {
      await tx.query("select public.siguiente_correlativo($1, 'estudiante', 2040)", [a]); // sería 2
      await tx.rollback();
    }).catch(() => {});
    expect(await sig(a, "estudiante", 2040)).toBe(2);
  });

  test("seguridad · un usuario de la API no puede pedir correlativos por su cuenta", async () => {
    const u = await crearUsuarioAuth(db);
    await expect(
      comoUsuario(db, u, (tx) => tx.query("select public.siguiente_correlativo($1, 'estudiante', 2026)", [a])),
    ).rejects.toThrow(/permission denied/);
  });
});
