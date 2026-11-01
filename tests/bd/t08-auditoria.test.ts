/** T8 — 004_auditoria.sql */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco, comoUsuario, comoServicio, comoAnonimo } from "../apoyo/banco";
import { crearOrganizacion, crearPersona } from "../apoyo/escenario";

let db: PGlite, A: string;
beforeAll(async () => {
  ({ db } = await crearBanco());
  A = await crearOrganizacion(db, "ACAA");
});

type Fila = {
  tipo_accion: string; entidad: string; registro_afectado: string;
  valor_anterior: Record<string, unknown> | null; valor_nuevo: Record<string, unknown> | null;
  detalle: string | null; usuario_id: string | null; organizacion_id: string | null;
};
const ultima = async (entidad: string) =>
  (await db.query<Fila>("select * from auditoria where entidad = $1 order by id desc limit 1", [entidad])).rows[0];

describe("cada cambio deja rastro (CE-17)", () => {
  test("CE-17 · crear deja la fila nueva completa", async () => {
    const r = await db.query<{ id: string }>("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'Sabatino','Sábado') returning id", [A]);
    const a = await ultima("modalidad");
    expect(a.tipo_accion).toBe("Creación");
    expect(a.registro_afectado).toBe(r.rows[0].id);
    expect(a.valor_anterior).toBeNull();
    expect(a.valor_nuevo).toMatchObject({ nombre: "Sabatino", dias_de_clase: "Sábado" });
    expect(a.organizacion_id).toBe(A);
  });

  test("CE-17 · modificar deja el valor anterior y el nuevo", async () => {
    await db.query("update modalidad set dias_de_clase = 'Sábados' where nombre = 'Sabatino' and organizacion_id = $1", [A]);
    const a = await ultima("modalidad");
    expect(a.tipo_accion).toBe("Modificación");
    expect(a.valor_anterior).toMatchObject({ dias_de_clase: "Sábado" });
    expect(a.valor_nuevo).toMatchObject({ dias_de_clase: "Sábados" });
  });

  test("CE-17 · un UPDATE que no cambia nada no ensucia la bitácora", async () => {
    const antes = (await db.query<{ n: number }>("select count(*)::int n from auditoria")).rows[0].n;
    await db.query("update modalidad set dias_de_clase = dias_de_clase where organizacion_id = $1", [A]);
    const despues = (await db.query<{ n: number }>("select count(*)::int n from auditoria")).rows[0].n;
    expect(despues).toBe(antes);
  });

  test("CE-17 · registra quién lo hizo", async () => {
    const asis = await crearPersona(db, A, ["asistente"]);
    // Sin políticas todavía (llegan en 007), se le da permiso temporal solo para esta prueba.
    await db.exec("create policy temporal on modalidad for all to authenticated using (true) with check (true)");
    await comoUsuario(db, asis, (tx) => tx.query("insert into modalidad (nombre, dias_de_clase) values ('Dominical','Domingo')"));
    await db.exec("drop policy temporal on modalidad");
    expect((await ultima("modalidad")).usuario_id).toBe(asis.id);
  });

  test("CE-17 · las tablas sin columna id se identifican por su llave (usuario_rol)", async () => {
    const p = await crearPersona(db, A, ["direccion"]);
    const a = await ultima("usuario_rol");
    expect(a.registro_afectado).toBe(`${p.id}:direccion`);
  });

  test("CE-59 · el motivo de la acción queda en el registro", async () => {
    await db.transaction(async (tx) => {
      await tx.query("select set_config('sigfie.motivo', 'Se inscribió en el grupo equivocado', true)");
      await tx.query("delete from modalidad where nombre = 'Dominical' and organizacion_id = $1", [A]);
    });
    const a = await ultima("modalidad");
    expect(a.tipo_accion).toBe("Eliminación");
    expect(a.detalle).toBe("Se inscribió en el grupo equivocado");
    expect(a.valor_anterior).toMatchObject({ nombre: "Dominical" });
  });

  test("CE-59 · el motivo no se filtra a la transacción siguiente", async () => {
    await db.query("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'Viernino','Viernes')", [A]);
    expect((await ultima("modalidad")).detalle).toBeNull();
  });
});

describe("es inalterable (CE-19)", () => {
  test("CE-19 · ni el dueño de la tabla puede modificarla", async () => {
    await expect(db.query("update auditoria set detalle = 'borrado'")).rejects.toThrow(/inalterable/);
  });
  test("CE-19 · ni eliminar filas", async () => {
    await expect(db.query("delete from auditoria")).rejects.toThrow(/inalterable/);
  });
  test("CE-19 · ni vaciarla", async () => {
    await expect(db.query("truncate auditoria")).rejects.toThrow(/inalterable/);
  });
  test("CE-19 · un usuario de la API no tiene permiso de escribirla", async () => {
    const p = await crearPersona(db, A, ["asistente"]);
    for (const sql of ["update auditoria set detalle = 'x'", "delete from auditoria",
                       "insert into auditoria (tipo_accion, entidad) values ('Acceso','falso')"]) {
      await expect(comoUsuario(db, p, (tx) => tx.query(sql))).rejects.toThrow(/permission denied/);
    }
  });
  test("CE-19 · ni la clave de servicio", async () => {
    await expect(comoServicio(db, (tx) => tx.query("delete from auditoria"))).rejects.toThrow(/permission denied/);
  });
});

describe("si no se puede registrar, el cambio no se aplica (CE-20)", () => {
  test("CE-20 · una falla en la auditoría deshace el cambio", async () => {
    await db.exec("alter table auditoria add constraint simular_falla check (entidad <> 'nivel') not valid");
    await expect(db.query(
      "insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico) values ($1,'Q1','Quedó huérfano','Advanced',1,'Adultos')", [A],
    )).rejects.toThrow(/simular_falla/);
    await db.exec("alter table auditoria drop constraint simular_falla");
    const r = await db.query<{ n: number }>("select count(*)::int n from nivel where nombre = 'Quedó huérfano'");
    expect(r.rows[0].n).toBe(0);
  });
});

describe("eventos (CE-18)", () => {
  test("CE-18 · un usuario registra su acceso; queda a su nombre y en su organización", async () => {
    const p = await crearPersona(db, A, ["direccion"]);
    await comoUsuario(db, p, (tx) => tx.query("select registrar_evento('Acceso', 'ingreso')"));
    const a = await ultima("ingreso");
    expect(a).toMatchObject({ tipo_accion: "Acceso", usuario_id: p.id, organizacion_id: A });
  });

  test("CE-18 · un usuario no puede registrar creaciones o modificaciones falsas", async () => {
    const p = await crearPersona(db, A, ["direccion"]);
    await expect(comoUsuario(db, p, (tx) => tx.query("select registrar_evento('Creación', 'estudiante')")))
      .rejects.toThrow(/no permitido/);
  });

  test("CE-18 · sin sesión no se registran eventos", async () => {
    await expect(comoAnonimo(db, (tx) => tx.query("select registrar_evento('Acceso', 'ingreso')")))
      .rejects.toThrow(/permission denied/);
  });

  test("CE-3, CE-18 · el servidor registra un ingreso fallido de un usuario existente", async () => {
    const p = await crearPersona(db, A, ["asistente"]);
    await comoServicio(db, (tx) => tx.query("select registrar_ingreso_denegado($1, 'contraseña incorrecta')", [p.nombreUsuario.toUpperCase()]));
    const a = await ultima("ingreso");
    expect(a).toMatchObject({ tipo_accion: "Denegación", usuario_id: p.id, organizacion_id: A, registro_afectado: p.nombreUsuario });
  });

  test("CE-3, CE-18 · y uno de un usuario que no existe, sin organización", async () => {
    await comoServicio(db, (tx) => tx.query("select registrar_ingreso_denegado('noexiste', 'usuario inexistente')"));
    const a = await ultima("ingreso");
    expect(a).toMatchObject({ tipo_accion: "Denegación", usuario_id: null, organizacion_id: null, registro_afectado: "noexiste" });
  });

  test("seguridad · un usuario no puede registrar ingresos fallidos ajenos", async () => {
    const p = await crearPersona(db, A, ["asistente"]);
    await expect(comoUsuario(db, p, (tx) => tx.query("select registrar_ingreso_denegado('otro')")))
      .rejects.toThrow(/permission denied/);
  });
});
