/** T6 — 002_catalogos.sql. Se prueba como superusuario: las políticas llegan en 007. */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco } from "../apoyo/banco";

let db: PGlite;
let A: string, B: string;
const id = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql + " returning id", p)).rows[0].id;

beforeAll(async () => {
  ({ db } = await crearBanco());
  A = await id("insert into organizacion (codigo, nombre) values ('ACAA', 'Academia A')");
  B = await id("insert into organizacion (codigo, nombre) values ('ACAB', 'Academia B')");
});

describe("valores duplicados (CE-22, CE-74, CE-98)", () => {
  test("CE-22 · 'Intermediate I' y '  intermediate i ' chocan en la misma organización", async () => {
    await db.query("insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico) values ($1,'I1','Intermediate I','Intermediate',1,'Adultos')", [A]);
    await expect(db.query("insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico) values ($1,'I9','  intermediate i ','Intermediate',9,'Adultos')", [A]))
      .rejects.toThrow(/nivel_nombre_unico/);
  });

  test("CE-98 · …y no chocan entre dos organizaciones", async () => {
    await db.query("insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico) values ($1,'I1','Intermediate I','Intermediate',1,'Adultos')", [B]);
  });

  test("CE-22 · 'Sabatino' y 'SABATINO' chocan", async () => {
    await db.query("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'Sabatino','Sábado')", [A]);
    await expect(db.query("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'SABATINO','Sábado')", [A]))
      .rejects.toThrow(/modalidad_nombre_unico/);
  });

  test("CE-74 · un nivel con el mismo código se rechaza aunque el nombre sea otro", async () => {
    await expect(db.query("insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico) values ($1,'i1','Otro nombre','Intermediate',2,'Adultos')", [A]))
      .rejects.toThrow(/nivel_codigo_unico/);
  });

  test("CE-74 · un horario con la misma modalidad, inicio y fin se rechaza", async () => {
    const m = await id("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'Dominical','Domingo')", [A]);
    await db.query("insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1,$2,'08:00','12:00')", [A, m]);
    await expect(db.query("insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1,$2,'08:00','12:00')", [A, m]))
      .rejects.toThrow(/horario_unico/);
  });

  test("CE-75 · dos profesores pueden llamarse igual (la advertencia es de la app)", async () => {
    for (let i = 0; i < 2; i++)
      await db.query("insert into profesor (organizacion_id, nombres, apellidos, telefono) values ($1,'Ana','López','88887777')", [A]);
  });
});

describe("horario (CE-26, CE-27, CE-97)", () => {
  test("CE-27 · la hora de fin debe ser posterior a la de inicio", async () => {
    const m = await id("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'Diario','Lunes a jueves')", [A]);
    await expect(db.query("insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1,$2,'10:00','10:00')", [A, m]))
      .rejects.toThrow(/horario_fin_despues_de_inicio/);
  });

  test("CE-97 · un horario no puede pertenecer a la modalidad de otra organización", async () => {
    const mB = await id("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'Viernino','Viernes')", [B]);
    await expect(db.query("insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1,$2,'14:00','17:00')", [A, mB]))
      .rejects.toThrow(/foreign key/);
  });
});

describe("valores en uso (CE-23, RN-22)", () => {
  test("CE-23 · una modalidad con horarios no se puede eliminar; sí desactivar", async () => {
    const m = await id("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'Nocturno','Lunes a viernes')", [A]);
    await db.query("insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1,$2,'18:00','19:30')", [A, m]);
    await expect(db.query("delete from modalidad where id = $1", [m])).rejects.toThrow(/foreign key/);
    await db.query("update modalidad set activo = false where id = $1", [m]);
  });
});

describe("sucursal central (CE-28)", () => {
  test("CE-28 · no puede haber dos centrales", async () => {
    await db.transaction(async (tx) => {
      await tx.query("insert into sucursal (organizacion_id, nombre, direccion, es_central) values ($1,'Altamira','Managua',true)", [A]);
    });
    await expect(db.query("insert into sucursal (organizacion_id, nombre, direccion, es_central) values ($1,'Don Bosco','Managua',true)", [A]))
      .rejects.toThrow(/sucursal_una_central/);
  });

  test("CE-28 · tampoco puede quedarse sin central", async () => {
    await expect(db.query("update sucursal set es_central = false where organizacion_id = $1", [A]))
      .rejects.toThrow(/exactamente una sucursal central/);
  });

  test("CE-28 · una organización no puede empezar con sucursales sin central", async () => {
    await expect(db.query("insert into sucursal (organizacion_id, nombre, direccion) values ($1,'Las Brisas','Managua')", [B]))
      .rejects.toThrow(/exactamente una sucursal central/);
  });

  test("CE-28 · se puede cambiar la central en una sola transacción", async () => {
    const nueva = await id("insert into sucursal (organizacion_id, nombre, direccion) values ($1,'Las Brisas','Managua')", [A]);
    await db.transaction(async (tx) => {
      await tx.query("update sucursal set es_central = false where organizacion_id = $1 and es_central", [A]);
      await tx.query("update sucursal set es_central = true where id = $1", [nueva]);
    });
    const r = await db.query<{ nombre: string }>("select nombre from sucursal where organizacion_id = $1 and es_central", [A]);
    expect(r.rows.map((x) => x.nombre)).toEqual(["Las Brisas"]);
  });
});

describe("formatos (CE-37)", () => {
  test.each([
    ["teléfono de 7 dígitos", "insert into profesor (organizacion_id, nombres, apellidos, telefono) values ($1,'Ana','López','8888777')"],
    ["nombre con números",    "insert into profesor (organizacion_id, nombres, apellidos, telefono) values ($1,'Ana2','López','88887777')"],
    ["nombre con espacios al borde", "insert into profesor (organizacion_id, nombres, apellidos, telefono) values ($1,' Ana','López','88887777')"],
    ["programa fuera de catálogo", "insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico) values ($1,'X','X nivel','Inventado',1,'Adultos')"],
    ["orden 0", "insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico) values ($1,'Y','Y nivel','Advanced',0,'Adultos')"],
  ])("CE-37 · rechaza %s", async (_d, sql) => {
    await expect(db.query(sql, [A])).rejects.toThrow(/check constraint/);
  });

  test("CE-37 · acepta nombres con tildes, eñes y apóstrofos", async () => {
    await db.query("insert into profesor (organizacion_id, nombres, apellidos, telefono) values ($1,'José Ñandú','D''Arbelles','88887777')", [A]);
  });
});

describe("organización obligatoria (CE-95)", () => {
  test("CE-95 · sin usuario que la indique, no se puede crear un catálogo sin organización", async () => {
    // Como superusuario, mi_organizacion() es nula: la fila no se acepta.
    await expect(db.query("insert into modalidad (nombre, dias_de_clase) values ('Huérfana','Lunes')"))
      .rejects.toThrow(/organizacion_id/);
  });
});
