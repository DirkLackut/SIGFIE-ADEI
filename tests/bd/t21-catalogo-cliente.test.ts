/**
 * T21 — 013_catalogo_cliente.sql: el catálogo con las respuestas de la cliente,
 * sobre la semilla real (009) y sobre un catálogo con niveles ya usados.
 */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { crearBanco, MIGRACIONES } from "../apoyo/banco";
import { crearCatalogoMinimo, crearOrganizacion } from "../apoyo/escenario";

const MIGRACION_013 = readFileSync(join(MIGRACIONES, "013_catalogo_cliente.sql"), "utf8");

describe("013 sobre la semilla", () => {
  let db: PGlite;
  beforeAll(async () => { ({ db } = await crearBanco(undefined, { semilla: true })); });

  test("el Curso principal tiene los niveles 1 a 16, para todas las edades", async () => {
    const r = await db.query<{ orden: number; codigo: string; publico: string }>(
      "select orden, codigo, publico from nivel where programa = 'Curso principal' order by orden");
    expect(r.rows.map((x) => x.orden)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(r.rows.map((x) => x.codigo)).toEqual([
      "BEG-1", "BEG-2", "CP-03", "CP-04", "CP-05", "INT-11", "INT-12", "INT-21", "INT-22", "INT-31", "INT-32",
      "ADV-1", "ADV-2", "CP-14", "CP-15", "CP-16"]);
    expect(new Set(r.rows.map((x) => x.publico))).toEqual(new Set(["Todos"]));
  });

  test("no quedan niveles Principiante, Beginners, Intermediate ni Advanced", async () => {
    const r = await db.query<{ n: number }>(
      "select count(*)::int n from nivel where programa in ('Principiante', 'Beginners', 'Intermediate', 'Advanced')");
    expect(r.rows[0].n).toBe(0);
  });

  test("las tres sucursales tienen su dirección completa", async () => {
    const r = await db.query<{ nombre: string; direccion: string }>("select nombre, direccion from sucursal order by nombre");
    expect(r.rows[0].direccion).toMatch(/Ferretería Roberto Morales Cuadra.*segundo piso/);
    expect(r.rows[1].direccion).toMatch(/casa F-454/);
    expect(r.rows[2].direccion).toMatch(/Módulo B-27/);
  });

  test("reglas desde 2023 según la tabla de la spec, y la de antes", async () => {
    const r = await db.query<{ programa: string; nivel_desde: number; nivel_hasta: number; nota_minima: number;
      condicionado_desde: number; provisional: boolean }>(
      `select programa, nivel_desde, nivel_hasta, nota_minima, condicionado_desde, provisional
         from regla_aprobacion where vigente_desde = '2023-01-01' order by programa, nivel_desde`);
    expect(r.rows.map((x) => [x.programa, x.nivel_desde, x.nivel_hasta, x.nota_minima, x.condicionado_desde, x.provisional])).toEqual([
      ["Conversation", 1, 99, 80, 77, false],
      ["Conversation Avanzada", 1, 99, 80, 77, false],
      ["Curso principal", 1, 2, 75, 72, false],
      ["Curso principal", 3, 5, 75, 72, true],
      ["Curso principal", 6, 11, 80, 77, false],
      ["Curso principal", 12, 13, 80, 77, false],
      ["Curso principal", 14, 16, 90, 87, true],
      ["Especial", 1, 99, 80, 77, true],
    ]);
    const antes = await db.query<{ n: number }>(
      "select count(*)::int n from regla_aprobacion where vigente_desde < '2023-01-01' and nota_minima = 75 and provisional");
    expect(antes.rows[0].n).toBe(4);
  });

  test("correrla otra vez no duplica nada", async () => {
    const contar = async () => (await db.query<{ n: number; r: number }>(
      "select (select count(*) from nivel)::int n, (select count(*) from regla_aprobacion)::int r")).rows[0];
    const antes = await contar();
    await db.exec(MIGRACION_013);
    expect(await contar()).toEqual(antes);
  });
});

describe("013 sobre un catálogo en uso", () => {
  test("un nivel Principiante con grupos se desactiva; uno sin grupos se borra", async () => {
    const { db } = await crearBanco();
    const org = await crearOrganizacion(db, "ADEI");
    const cat = await crearCatalogoMinimo(db, org);
    const ids = (await db.query<{ id: string }>(
      `insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico)
       values ($1,'PRI-01','Principiante 1','Principiante',1,'Niños'), ($1,'PRI-02','Principiante 2','Principiante',2,'Niños')
       returning id`, [org])).rows.map((r) => r.id);
    await db.query(
      `insert into grupo (organizacion_id, codigo_grupo, nivel_id, horario_id, profesor_id, sucursal_id, fecha_inicio, fecha_termino)
       values ($1, 'G-2026-0001', $2, $3, $4, $5, '2026-01-10', '2026-03-10')`,
      [org, ids[0], cat.horario, cat.profesor, cat.sucursal]);
    await db.exec(MIGRACION_013);
    const r = await db.query<{ codigo: string; activo: boolean }>("select codigo, activo from nivel where programa = 'Principiante'");
    expect(r.rows).toEqual([{ codigo: "PRI-01", activo: false }]);
    // El nivel Intermediate orden 1 del catálogo mínimo pasa a ser el 6 del Curso principal.
    const n = await db.query<{ programa: string; orden: number }>("select programa, orden from nivel where id = $1", [cat.nivel]);
    expect(n.rows[0]).toEqual({ programa: "Curso principal", orden: 6 });
  });

  test("en una organización que no es ADEI no hace nada", async () => {
    const { db } = await crearBanco();
    const org = await crearOrganizacion(db, "OTRA");
    const cat = await crearCatalogoMinimo(db, org);
    await db.exec(MIGRACION_013);
    const n = await db.query<{ programa: string }>("select programa from nivel where id = $1", [cat.nivel]);
    expect(n.rows[0].programa).toBe("Intermediate");
    expect((await db.query("select 1 from regla_aprobacion")).rows).toHaveLength(0);
  });
});
