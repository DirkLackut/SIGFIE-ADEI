/** T10 — 006_grupos.sql. Como superusuario: las políticas llegan en 007. */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco } from "../apoyo/banco";
import { crearOrganizacion, crearCatalogoMinimo, haceAnios } from "../apoyo/escenario";

let db: PGlite, A: string, B: string;
let catA: Awaited<ReturnType<typeof crearCatalogoMinimo>>, catB: typeof catA;
let n = 0;

beforeAll(async () => {
  ({ db } = await crearBanco());
  A = await crearOrganizacion(db, "ACAA"); B = await crearOrganizacion(db, "ACAB");
  catA = await crearCatalogoMinimo(db, A); catB = await crearCatalogoMinimo(db, B);
});

async function grupo(over: Record<string, unknown> = {}) {
  const g = { org: A, ...catA, inicio: "2026-11-02", termino: "2026-11-27", ...over };
  return (await db.query<{ id: string }>(
    `insert into grupo (organizacion_id, codigo_grupo, nivel_id, horario_id, profesor_id, sucursal_id, fecha_inicio, fecha_termino)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [g.org, `G-2026-${String(++n).padStart(4, "0")}`, g.nivel, g.horario, g.profesor, g.sucursal, g.inicio, g.termino])).rows[0].id;
}
async function estudiante(org = A, suc = catA.sucursal) {
  return (await db.query<{ id: string }>(
    `insert into estudiante (organizacion_id, codigo_adei, nombres, apellidos, fecha_nacimiento, telefono, sucursal_id)
     values ($1,$2,'Luis','Mora',$3,'88887777',$4) returning id`,
    [org, `ACAA-2026-${String(++n).padStart(5, "0")}`, await haceAnios(db, 30), suc])).rows[0].id;
}
const inscribir = (e: string, g: string, org = A) =>
  db.query<{ id: string; fecha_inscripcion: string; estado_inscripcion: string }>(
    "insert into inscripcion (organizacion_id, estudiante_id, grupo_id) values ($1,$2,$3) returning id, fecha_inscripcion::text, estado_inscripcion",
    [org, e, g]);

describe("grupo (CE-47, CE-50, RN-06)", () => {
  test("CE-50 · la fecha de término debe ser posterior a la de inicio", async () => {
    await expect(grupo({ inicio: "2026-11-27", termino: "2026-11-27" })).rejects.toThrow(/grupo_termino_despues_de_inicio/);
  });

  test("CE-48 · el código de grupo tiene el formato G-AAAA-NNNN y es único", async () => {
    await expect(db.query(
      `insert into grupo (organizacion_id, codigo_grupo, nivel_id, horario_id, profesor_id, sucursal_id, fecha_inicio, fecha_termino)
       values ($1,'G-26-1',$2,$3,$4,$5,'2026-11-02','2026-11-27')`,
      [A, catA.nivel, catA.horario, catA.profesor, catA.sucursal])).rejects.toThrow(/grupo_codigo_formato/);
  });

  test("CE-48 · un grupo nuevo tiene el acta Abierta", async () => {
    const g = await grupo();
    const r = await db.query<{ e: string }>("select estado_acta e from grupo where id = $1", [g]);
    expect(r.rows[0].e).toBe("Abierta");
  });

  test("RN-06 · un grupo exige nivel, horario, profesor y sucursal", async () => {
    await expect(grupo({ profesor: null })).rejects.toThrow(/null value/);
  });

  test("CE-97 · un grupo no puede usar el profesor o el nivel de otra organización", async () => {
    await expect(grupo({ profesor: catB.profesor })).rejects.toThrow(/foreign key/);
    await expect(grupo({ nivel: catB.nivel })).rejects.toThrow(/foreign key/);
  });

  test("D10 · la modalidad del grupo sale del horario: no hay columna que pueda contradecirla", async () => {
    const r = await db.query<{ c: string }>("select column_name c from information_schema.columns where table_name = 'grupo'");
    expect(r.rows.map((x) => x.c)).not.toContain("modalidad_id");
  });

  test("un acta Entregada exige la fecha de entrega, y viceversa", async () => {
    const g = await grupo();
    await expect(db.query("update grupo set estado_acta = 'Entregada' where id = $1", [g])).rejects.toThrow(/grupo_entrega_coherente/);
  });
});

describe("inscripción (CE-54, CE-56, CE-97)", () => {
  test("CE-54 · se registra En curso con la fecha de hoy en Managua", async () => {
    const r = await inscribir(await estudiante(), await grupo());
    const hoy = (await db.query<{ h: string }>("select public.hoy_managua()::text h")).rows[0].h;
    expect(r.rows[0]).toMatchObject({ estado_inscripcion: "En curso", fecha_inscripcion: hoy });
  });

  test("CE-56 · el mismo estudiante no se inscribe dos veces en el mismo grupo", async () => {
    const e = await estudiante(), g = await grupo();
    await inscribir(e, g);
    await expect(inscribir(e, g)).rejects.toThrow(/inscripcion_unica/);
  });

  test("CE-97 · no se inscribe a un estudiante en un grupo de otra organización", async () => {
    const e = await estudiante();
    const gB = await grupo({ org: B, ...catB });
    await expect(inscribir(e, gB)).rejects.toThrow(/foreign key/);
    await expect(inscribir(e, gB, B)).rejects.toThrow(/foreign key/);
  });

  test("una inscripción Retirada o Trasladada exige observación", async () => {
    const r = await inscribir(await estudiante(), await grupo());
    await expect(db.query("update inscripcion set estado_inscripcion = 'Retirada' where id = $1", [r.rows[0].id]))
      .rejects.toThrow(/inscripcion_observacion_obligatoria/);
  });

  test("CE-59 · anular una inscripción deja todos sus datos en la auditoría", async () => {
    const r = await inscribir(await estudiante(), await grupo());
    const id = r.rows[0].id;
    await db.query("delete from inscripcion where id = $1", [id]);
    const a = await db.query<{ tipo_accion: string; valor_anterior: Record<string, unknown> }>(
      "select tipo_accion, valor_anterior from auditoria where entidad = 'inscripcion' and registro_afectado = $1 order by id desc limit 1", [id]);
    expect(a.rows[0].tipo_accion).toBe("Eliminación");
    expect(a.rows[0].valor_anterior).toMatchObject({ id, estado_inscripcion: "En curso" });
  });
});
