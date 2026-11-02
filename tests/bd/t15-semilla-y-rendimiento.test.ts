/**
 * T15 — 009_semilla.sql y rendimiento de la búsqueda con 20,000 estudiantes
 * sintéticos (CE-45).
 */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco, comoUsuario } from "../apoyo/banco";
import { crearPersona, type Persona } from "../apoyo/escenario";
import { cargarEstudiantesSinteticos } from "../apoyo/sinteticos";

describe("semilla (009, con los ajustes de la 013)", () => {
  let db: PGlite;
  beforeAll(async () => { ({ db } = await crearBanco(undefined, { semilla: true })); });
  const cuenta = async (sql: string) => (await db.query<{ n: number }>(`select count(*)::int n from ${sql}`)).rows[0].n;

  test("una sola organización: ADEI", async () => {
    const r = await db.query<{ codigo: string }>("select codigo from organizacion");
    expect(r.rows).toEqual([{ codigo: "ADEI" }]);
  });

  test("tres sucursales, con Altamira como la única central (CE-21)", async () => {
    const r = await db.query<{ nombre: string; es_central: boolean }>("select nombre, es_central from sucursal order by nombre");
    expect(r.rows).toEqual([
      { nombre: "Altamira", es_central: true }, { nombre: "Don Bosco", es_central: false },
      { nombre: "Multicentro Las Brisas", es_central: false }]);
  });

  test("cuatro modalidades con los 11 horarios reales de 2021", async () => {
    const r = await db.query<{ nombre: string; n: number }>(
      "select m.nombre, count(h.*)::int n from modalidad m join horario h on h.modalidad_id = m.id group by 1 order by 1");
    expect(r.rows).toEqual([
      { nombre: "Diario", n: 7 }, { nombre: "Dominical", n: 1 }, { nombre: "Sabatino", n: 3 }, { nombre: "Viernino", n: 1 }]);
    const distintos = await db.query<{ n: number }>("select count(distinct (hora_inicio, hora_fin))::int n from horario");
    expect(distintos.rows[0].n).toBe(11);
  });

  test("niveles: secuencia sin huecos dentro de cada programa", async () => {
    const r = await db.query<{ programa: string; n: number; max: number }>(
      "select programa, count(*)::int n, max(orden) max from nivel group by programa, publico");
    for (const f of r.rows) expect(f.max, f.programa).toBe(f.n);
    // La 013 los reordena en el Curso principal de 16 niveles (spec 002).
    expect(await cuenta("nivel where programa = 'Curso principal'")).toBe(16);
    expect(await cuenta("nivel where programa = 'Principiante'")).toBe(0);
  });

  test("sin profesores, estudiantes ni cuentas (principio 3)", async () => {
    for (const t of ["profesor", "estudiante", "tutor", "usuario", "grupo"]) expect(await cuenta(t), t).toBe(0);
  });

  test("hay un aviso vigente, así que la primera cuenta podrá entrar", async () => {
    const r = await db.query<{ v: string }>("select aviso_vigente(id) v from organizacion");
    expect(r.rows[0].v).toBe("v0.1");
  });
});

describe("CE-45 · búsqueda con 20,000 estudiantes", () => {
  let db: PGlite, asis: Persona;
  beforeAll(async () => {
    ({ db } = await crearBanco(undefined, { semilla: true }));
    const org = (await db.query<{ id: string }>("select id from organizacion")).rows[0].id;
    const suc = (await db.query<{ id: string }>("select id from sucursal")).rows.map((r) => r.id);
    await cargarEstudiantesSinteticos(db, org, suc, 20_000);
    asis = await crearPersona(db, org, ["asistente"]);
  }, 120_000);

  test("los 20,000 están cargados", async () => {
    expect((await db.query<{ n: number }>("select count(*)::int n from estudiante")).rows[0].n).toBe(20_000);
  });

  test("el índice de trigramas sirve para la consulta de la búsqueda", async () => {
    // Con 20,000 filas (590 páginas) el planificador puede preferir recorrer la
    // tabla: tarda lo mismo que el índice (~7 ms). Lo que se comprueba es que el
    // índice ES APLICABLE al filtro de texto de la búsqueda (el mismo LIKE que usa
    // interno.estudiantes_que_coinciden, que corre sin RLS), para que el
    // planificador lo use en cuanto el volumen lo justifique.
    await db.exec("set enable_seqscan = off");
    try {
      const plan = (await db.query<{ "QUERY PLAN": string }>(
        `explain select e.id from public.estudiante e
         where e.busqueda like '%zelaya ubeda%' or e.busqueda like '%zelayaubeda%'`))
        .rows.map((r) => r["QUERY PLAN"]).join("\n");
      expect(plan, plan).toMatch(/Bitmap Index Scan on estudiante_busqueda/);
    } finally {
      await db.exec("reset enable_seqscan");
    }
  });

  test("bajo RLS, un LIKE directo NO puede usar el índice (por eso existe el paso previo)", async () => {
    const plan = await comoUsuario(db, asis, async (tx) => {
      await tx.exec("set local enable_seqscan = off");
      return (await tx.query<{ "QUERY PLAN": string }>(
        "explain select id from estudiante e where e.busqueda like '%zelaya ubeda%'")).rows.map((r) => r["QUERY PLAN"]).join("\n");
    });
    expect(plan).not.toMatch(/estudiante_busqueda/);
  });

  test.each([
    ["un apellido frecuente", "gutierrez"],
    ["nombre y apellido", "maria nunez"],
    ["una cédula sin guiones", "0010007919"],
    ["un código", "adei-2023-01234"],
    ["algo que no existe", "xyzxyz"],
  ])("responde en menos de 2 s: %s", async (_caso, texto) => {
    const t0 = performance.now();
    const r = await comoUsuario(db, asis, async (tx) =>
      (await tx.query<{ r: { estado: string; total: number } }>("select buscar_estudiantes($1) r", [texto])).rows[0].r);
    const ms = performance.now() - t0;
    expect(r.estado).toBe("ok");
    expect(ms, `${texto}: ${ms.toFixed(0)} ms, ${r.total} resultados`).toBeLessThan(2000);
  });
});
