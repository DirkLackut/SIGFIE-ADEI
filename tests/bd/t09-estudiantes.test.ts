/** T9 — 005_estudiantes.sql. Como superusuario: las políticas llegan en 007. */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco } from "../apoyo/banco";
import { crearOrganizacion, crearCatalogoMinimo, haceAnios } from "../apoyo/escenario";
import { calcularEdad } from "@/dominio/edad";

let db: PGlite, A: string, B: string, sucA: string, sucB: string;
let n = 0;

beforeAll(async () => {
  ({ db } = await crearBanco());
  A = await crearOrganizacion(db, "ACAA");
  B = await crearOrganizacion(db, "ACAB");
  sucA = (await crearCatalogoMinimo(db, A)).sucursal;
  sucB = (await crearCatalogoMinimo(db, B)).sucursal;
});

interface Datos {
  org?: string; suc?: string; cedula?: string | null; nombres?: string; apellidos?: string;
  nacimiento: string; telefono?: string | null; contacto?: string | null;
}
const codigo = () => `ACAA-2026-${String(++n).padStart(5, "0")}`;

async function insertar(d: Datos, tx: Pick<PGlite, "query"> = db) {
  const r = await tx.query<{ id: string }>(
    `insert into estudiante (organizacion_id, codigo_adei, cedula, nombres, apellidos, fecha_nacimiento, telefono, contacto_emergencia, sucursal_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [d.org ?? A, codigo(), d.cedula ?? null, d.nombres ?? "Ana", d.apellidos ?? "Pérez", d.nacimiento,
     d.telefono === undefined ? "88887777" : d.telefono, d.contacto ?? null, d.suc ?? sucA]);
  return r.rows[0].id;
}
async function tutor(org = A, cedula = `001-010180-${String(++n).padStart(4, "0")}X`, tx: Pick<PGlite, "query"> = db) {
  return (await tx.query<{ id: string }>(
    "insert into tutor (organizacion_id, nombre_completo, cedula, telefono) values ($1,'María Pérez',$2,'88881111') returning id",
    [org, cedula])).rows[0].id;
}
const vincular = (est: string, tut: string, tx: Pick<PGlite, "query"> = db, org = A) =>
  tx.query("insert into estudiante_tutor (organizacion_id, estudiante_id, tutor_id) values ($1,$2,$3)", [org, est, tut]);

describe("edad() de la base = calcularEdad() de la app", () => {
  test.each([
    ["2010-10-29", "2026-10-29"], ["2010-10-30", "2026-10-29"], ["2008-02-29", "2026-02-28"],
    ["2008-02-29", "2026-03-01"], ["2008-02-29", "2028-02-29"], ["1927-10-29", "2026-10-29"],
  ])("nacido el %s, el %s", async (nac, hoy) => {
    const r = await db.query<{ e: number }>("select public.edad($1::date, $2::date) e", [nac, hoy]);
    expect(r.rows[0].e).toBe(calcularEdad(nac, hoy));
  });
});

describe("unicidad (CE-30, CE-98, RN-01)", () => {
  test("CE-30 · dos estudiantes no pueden tener la misma cédula en una organización", async () => {
    const f = await haceAnios(db, 30);
    await insertar({ cedula: "001-150390-0012K", nacimiento: f });
    await expect(insertar({ cedula: "001-150390-0012K", nacimiento: f })).rejects.toThrow(/estudiante_cedula_unica/);
  });

  test("CE-98 · la misma cédula sí puede estar en otra organización", async () => {
    await insertar({ org: B, suc: sucB, cedula: "001-150390-0012K", nacimiento: await haceAnios(db, 30) });
  });

  test("CE-30 · varios estudiantes sin cédula no chocan entre sí", async () => {
    const f = await haceAnios(db, 30);
    await insertar({ nacimiento: f }); await insertar({ nacimiento: f });
  });
});

describe("fecha de nacimiento (CE-36, CE-77)", () => {
  test("CE-36 · posterior a hoy: se rechaza", async () => {
    await expect(insertar({ nacimiento: await haceAnios(db, 0, -1) })).rejects.toThrow(/posterior a hoy/);
  });
  test("CE-36 · 3 años: se rechaza", async () => {
    await expect(insertar({ nacimiento: await haceAnios(db, 3), contacto: "Mamá 88880000" })).rejects.toThrow(/entre 4 y 99/);
  });
  test("CE-36 · 100 años: se rechaza", async () => {
    await expect(insertar({ nacimiento: await haceAnios(db, 100) })).rejects.toThrow(/entre 4 y 99/);
  });
  test("CE-36 · 4 y 99 años exactos: se aceptan", async () => {
    await db.transaction(async (tx) => {
      const nino = await insertar({ nacimiento: await haceAnios(db, 4), contacto: "Mamá 88880000", telefono: null }, tx);
      await vincular(nino, await tutor(A, undefined, tx), tx);
    });
    await insertar({ nacimiento: await haceAnios(db, 99) });
  });
});

describe("menores de edad (CE-33, CE-34, CE-35, CE-81, CE-82)", () => {
  test("CE-33 · un menor sin tutor no se puede guardar", async () => {
    await expect(db.transaction(async (tx) => {
      await insertar({ nacimiento: await haceAnios(db, 12), contacto: "Mamá 88880000", telefono: null }, tx);
    })).rejects.toThrow(/al menos un tutor/);
  });

  test("CE-33 · con su tutor, en la misma operación, sí", async () => {
    await db.transaction(async (tx) => {
      const e = await insertar({ nacimiento: await haceAnios(db, 12), contacto: "Mamá 88880000", telefono: null }, tx);
      await vincular(e, await tutor(A, undefined, tx), tx);
    });
  });

  test("CE-34 · un menor sin contacto de emergencia se rechaza", async () => {
    await expect(insertar({ nacimiento: await haceAnios(db, 12), telefono: null })).rejects.toThrow(/contacto de emergencia/);
  });

  test("CE-35 · un adulto sin teléfono se rechaza al registrarse", async () => {
    await expect(insertar({ nacimiento: await haceAnios(db, 25), telefono: null })).rejects.toThrow(/debe tener teléfono/);
  });

  test("CE-80 · quien se registró de niño y ya es adulto puede editarse sin teléfono", async () => {
    let e = "";
    await db.transaction(async (tx) => {
      e = await insertar({ nacimiento: await haceAnios(db, 17, 364), contacto: "Mamá 88880000", telefono: null }, tx);
      await vincular(e, await tutor(A, undefined, tx), tx);
    });
    // Simula que pasó el tiempo: se corrige su fecha (ya cumplió 18) y luego su dirección.
    await db.query("update estudiante set fecha_nacimiento = $2 where id = $1", [e, await haceAnios(db, 18, 1)]);
    await db.query("update estudiante set direccion = 'Altamira' where id = $1", [e]);
  });

  test("CE-81 · si la nueva fecha lo vuelve menor y no tiene tutor, no se guarda", async () => {
    const e = await insertar({ nacimiento: await haceAnios(db, 30), contacto: "Hermano 88880000" });
    await expect(db.query("update estudiante set fecha_nacimiento = $2 where id = $1", [e, await haceAnios(db, 15)]))
      .rejects.toThrow(/al menos un tutor/);
  });

  test("CE-82 · no se puede quitar el único tutor de un menor", async () => {
    let e = "", t = "";
    await db.transaction(async (tx) => {
      e = await insertar({ nacimiento: await haceAnios(db, 10), contacto: "Mamá 88880000", telefono: null }, tx);
      t = await tutor(A, undefined, tx); await vincular(e, t, tx);
    });
    await expect(db.query("delete from estudiante_tutor where estudiante_id = $1", [e])).rejects.toThrow(/al menos un tutor/);
  });

  test("CE-82 · con dos tutores, se puede quitar uno", async () => {
    let e = "", t1 = "";
    await db.transaction(async (tx) => {
      e = await insertar({ nacimiento: await haceAnios(db, 10), contacto: "Mamá 88880000", telefono: null }, tx);
      t1 = await tutor(A, undefined, tx); await vincular(e, t1, tx);
      await vincular(e, await tutor(A, undefined, tx), tx);
    });
    await db.query("delete from estudiante_tutor where estudiante_id = $1 and tutor_id = $2", [e, t1]);
  });

  test("CE-38 · un tutor con la misma cédula es un solo registro", async () => {
    await tutor(A, "001-010180-9999X");
    await expect(tutor(A, "001-010180-9999X")).rejects.toThrow(/tutor_cedula_unica/);
  });

  test("CE-97 · no se puede vincular un tutor de otra organización", async () => {
    const e = await insertar({ nacimiento: await haceAnios(db, 30) });
    const tB = await tutor(B);
    await expect(vincular(e, tB)).rejects.toThrow(/foreign key/);
  });
});

describe("formatos (CE-37, CE-76)", () => {
  test.each([
    ["cédula sin guiones", { cedula: "0011503900012K" }, /estudiante_cedula_formato/],
    ["cédula con letra minúscula (la app la convierte, CE-76)", { cedula: "001-150390-0012k" }, /estudiante_cedula_formato/],
    ["nombre con números", { nombres: "Ana2" }, /estudiante_nombres_formato/],
    ["nombre con espacios dobles", { nombres: "Ana  María" }, /estudiante_nombres_formato/],
    ["teléfono de 7 dígitos", { telefono: "8888777" }, /estudiante_telefono_formato/],
  ])("CE-37 · rechaza %s", async (_d, cambio, error) => {
    await expect(insertar({ nacimiento: await haceAnios(db, 30), ...cambio })).rejects.toThrow(error);
  });
});

describe("código ADEI (CE-41)", () => {
  test("CE-41 · no se puede modificar, ni siquiera desde la base", async () => {
    const e = await insertar({ nacimiento: await haceAnios(db, 30) });
    await expect(db.query("update estudiante set codigo_adei = 'ACAA-2026-99999' where id = $1", [e]))
      .rejects.toThrow(/no se puede modificar/);
  });
});

describe("búsqueda (CE-42)", () => {
  test("CE-42 · la columna de búsqueda tiene nombre sin tildes, cédula sin guiones y código", async () => {
    const e = await insertar({ nombres: "José", apellidos: "Gutiérrez Muñoz", cedula: "001-010101-0001A", nacimiento: await haceAnios(db, 30) });
    const r = await db.query<{ busqueda: string; codigo_adei: string }>("select busqueda, codigo_adei from estudiante where id = $1", [e]);
    expect(r.rows[0].busqueda).toBe(`jose gutierrez munoz 0010101010001a ${r.rows[0].codigo_adei.toLowerCase()}`);
  });

  test("CE-45 · la columna de búsqueda tiene un índice de trigramas", async () => {
    const r = await db.query<{ def: string }>("select indexdef def from pg_indexes where indexname = 'estudiante_busqueda'");
    expect(r.rows[0].def).toMatch(/gin.*gin_trgm_ops/);
  });

  test("CE-39 · no existe ninguna columna de estado civil ni de salud", async () => {
    const r = await db.query<{ c: string }>("select column_name c from information_schema.columns where table_name = 'estudiante'");
    const cols = r.rows.map((x) => x.c).join(" ");
    expect(cols).not.toMatch(/civil|salud|enfermedad|discapacidad|medic/);
  });
});

describe("auditoría (CE-17)", () => {
  test("CE-17 · registrar a un estudiante y vincular a su tutor queda en la bitácora", async () => {
    let e = "";
    await db.transaction(async (tx) => {
      e = await insertar({ nacimiento: await haceAnios(db, 10), contacto: "Mamá 88880000", telefono: null }, tx);
      await vincular(e, await tutor(A, undefined, tx), tx);
    });
    const r = await db.query<{ entidad: string }>(
      "select entidad from auditoria where registro_afectado like $1 || '%' order by id", [e]);
    expect(r.rows.map((x) => x.entidad)).toEqual(["estudiante", "estudiante_tutor"]);
  });
});
