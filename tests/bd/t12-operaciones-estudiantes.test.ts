/**
 * T12 — 008_operaciones.sql, parte 1: registrar y modificar estudiantes, vincular
 * y desvincular tutores. Todo se llama "como" la Asistente, igual que lo hará la
 * aplicación. Datos inventados (constitución, principio 3).
 */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { crearBanco, comoUsuario } from "../apoyo/banco";
import { crearOrganizacion, crearCatalogoMinimo, crearPersona, haceAnios, type Persona } from "../apoyo/escenario";

type Resp = { estado: string; [k: string]: unknown };
let db: PGlite, A: string, B: string;
let cat: Awaited<ReturnType<typeof crearCatalogoMinimo>>, catB: typeof cat;
let asis: Persona, dir: Persona, prof: Persona, asisB: Persona;
const anio = new Date().getFullYear();

beforeAll(async () => {
  ({ db } = await crearBanco());
  A = await crearOrganizacion(db, "ADEI"); B = await crearOrganizacion(db, "OTRA");
  cat = await crearCatalogoMinimo(db, A); catB = await crearCatalogoMinimo(db, B);
  asis = await crearPersona(db, A, ["asistente"]);
  dir = await crearPersona(db, A, ["direccion"]);
  prof = await crearPersona(db, A, ["profesor"]);
  asisB = await crearPersona(db, B, ["asistente"]);
});

let n = 0;
/** Datos de un adulto distinto en cada llamada (cédula y nombre únicos). */
async function adulto(extra: Record<string, unknown> = {}) {
  const k = ++n;
  return {
    cedula: `001-${String(100000 + k).slice(-6)}-0000A`, nombres: `Luis ${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[k % 26]}${"abcdefghij"[k % 10]}`,
    apellidos: "Mora", fecha_nacimiento: await haceAnios(db, 30, k), telefono: "88887777",
    sucursal_id: cat.sucursal, ...extra,
  };
}
const llamar = <T = Resp>(p: Persona, sql: string, args: unknown[]) =>
  comoUsuario(db, p, async (tx) => (await tx.query<{ r: T }>(`select ${sql} r`, args)).rows[0].r);
const registrar = (p: Persona, datos: object, confirmar = false) =>
  llamar(p, "registrar_estudiante($1, $2)", [JSON.stringify(datos), confirmar]);
const actualizar = (p: Persona, id: string, version: number, datos: object) =>
  llamar(p, "actualizar_estudiante($1, $2, $3)", [id, version, JSON.stringify(datos)]);
const leer = async (id: string) => (await db.query<{
  codigo_adei: string; cedula: string | null; version: number; estado_matricula: string; origen_registro: string;
  telefono: string | null; nombres: string; fecha_nacimiento: string }>(
  "select *, fecha_nacimiento::text from estudiante where id = $1", [id])).rows[0];
const auditoria = async (id: string) => (await db.query<{ tipo_accion: string; detalle: string | null; usuario_id: string }>(
  "select tipo_accion, detalle, usuario_id from auditoria where entidad = 'estudiante' and registro_afectado like '%' || $1 || '%' order by id", [id])).rows;

describe("registrar_estudiante (CE-29 a CE-38, CE-79)", () => {
  test("CE-29 · sin coincidencias registra con código ADEI-AAAA-NNNNN, Activo y origen Captura", async () => {
    const r = await registrar(asis, await adulto());
    expect(r.estado).toBe("registrado");
    expect(r.codigo_adei).toMatch(new RegExp(`^ADEI-${anio}-\\d{5}$`));
    const e = await leer(r.id as string);
    expect([e.estado_matricula, e.origen_registro, e.version]).toEqual(["Activo", "Captura", 1]);
  });

  test("CE-29 · los códigos son correlativos dentro del año", async () => {
    const a = await registrar(asis, await adulto()), b = await registrar(asis, await adulto());
    const num = (c: unknown) => Number(String(c).slice(-5));
    expect(num(b.codigo_adei)).toBe(num(a.codigo_adei) + 1);
  });

  test("CE-99 · cada organización lleva su prefijo y su propio correlativo", async () => {
    const r = await registrar(asisB, { ...(await adulto()), sucursal_id: catB.sucursal });
    expect(r.codigo_adei).toBe(`OTRA-${anio}-00001`);
  });

  test("CE-29 · la Asistente no puede elegir el código", async () => {
    await expect(comoUsuario(db, asis, (tx) => tx.query(
      `insert into estudiante (codigo_adei, nombres, apellidos, fecha_nacimiento, telefono, sucursal_id)
       values ('ADEI-2020-00001','Ana','Ruiz','1990-01-01','88887777',$1)`, [cat.sucursal])))
      .rejects.toThrow(/lo asigna el sistema/);
  });

  test("CE-76 · espacios y minúsculas se normalizan antes de guardar", async () => {
    const d = await adulto();
    const r = await registrar(asis, { ...d, cedula: ` ${d.cedula.toLowerCase()} `, nombres: "  Rosa   María ", apellidos: "Pérez  Gómez" });
    const e = await leer(r.id as string);
    expect([e.cedula, e.nombres]).toEqual([d.cedula, "Rosa María"]);
  });

  test("CE-30 · una cédula ya registrada se rechaza y devuelve el expediente existente", async () => {
    const d = await adulto();
    const primero = await registrar(asis, d);
    const r = await registrar(asis, { ...(await adulto()), cedula: d.cedula });
    expect(r.estado).toBe("cedula_existente");
    expect((r.expediente as { codigo_adei: string }).codigo_adei).toBe(primero.codigo_adei);
  });

  test("CE-30 · la misma cédula en otra organización no choca", async () => {
    const d = await adulto();
    await registrar(asis, d);
    expect((await registrar(asisB, { ...d, sucursal_id: catB.sucursal })).estado).toBe("registrado");
  });

  test("CE-31 · sin cédula, mismo nombre y fecha (sin tildes ni mayúsculas) pide confirmar y no inserta", async () => {
    const nac = await haceAnios(db, 40, 3);
    const base = { nombres: "José Ángel", apellidos: "Núñez", fecha_nacimiento: nac, telefono: "88887777", sucursal_id: cat.sucursal };
    const primero = await registrar(asis, base);
    const antes = (await db.query<{ n: number }>("select count(*)::int n from estudiante")).rows[0].n;
    const r = await registrar(asis, { ...base, nombres: "JOSE ANGEL", apellidos: "nunez" });
    expect(r.estado).toBe("coincidencias");
    expect((r.candidatos as { codigo_adei: string }[]).map((c) => c.codigo_adei)).toEqual([primero.codigo_adei]);
    expect((await db.query<{ n: number }>("select count(*)::int n from estudiante")).rows[0].n).toBe(antes);
  });

  test("CE-32 · al confirmar que es otra persona se registra y la decisión queda en la auditoría", async () => {
    const base = { nombres: "Carmen", apellidos: "Torres", fecha_nacimiento: await haceAnios(db, 50, 7), telefono: "88887777", sucursal_id: cat.sucursal };
    const primero = await registrar(asis, base);
    const r = await registrar(asis, base, true);
    expect(r.estado).toBe("registrado");
    const filas = await auditoria(r.id as string);
    expect(filas[0].tipo_accion).toBe("Creación");
    expect(filas[0].detalle).toContain(String(primero.codigo_adei));
    expect(filas[0].usuario_id).toBe(asis.id);
  });

  test("CE-79 · con cédula, un expediente igual sin cédula se ofrece para completar", async () => {
    const base = { nombres: "Marta", apellidos: "Ríos", fecha_nacimiento: await haceAnios(db, 35, 9), telefono: "88887777", sucursal_id: cat.sucursal };
    const sinCedula = await registrar(asis, base);
    const r = await registrar(asis, { ...base, cedula: "001-777777-0000A" });
    expect(r.estado).toBe("completar");
    expect((r.candidatos as { id: string }[])[0].id).toBe(sinCedula.id);
    // Completarlo es una modificación normal.
    const c = await actualizar(asis, sinCedula.id as string, 1, { cedula: "001-777777-0000A" });
    expect(c.estado).toBe("actualizado");
    expect((await leer(sinCedula.id as string)).cedula).toBe("001-777777-0000A");
  });

  test("CE-79 · un homónimo que ya tiene otra cédula no se ofrece para completar", async () => {
    const base = { nombres: "Pablo", apellidos: "Vega", fecha_nacimiento: await haceAnios(db, 33, 2), telefono: "88887777", sucursal_id: cat.sucursal };
    await registrar(asis, { ...base, cedula: "001-121212-0000A" });
    expect((await registrar(asis, { ...base, cedula: "001-343434-0000A" })).estado).toBe("registrado");
  });

  test("CE-33 · un menor sin tutor se rechaza; con tutor se registra", async () => {
    const menor = { nombres: "Sofía", apellidos: "Lara", fecha_nacimiento: await haceAnios(db, 12), contacto_emergencia: "Madre 88880000", sucursal_id: cat.sucursal };
    await expect(registrar(asis, menor)).rejects.toThrow(/tutor/i);
    const r = await registrar(asis, { ...menor, tutores: [{ nombre_completo: "Elena Lara", cedula: "001-010101-0001B", telefono: "88881111" }] });
    expect(r.estado).toBe("registrado");
  });

  test("CE-34 · CE-35 · CE-36 · las validaciones de 005 siguen aplicando", async () => {
    await expect(registrar(asis, { ...(await adulto()), telefono: null })).rejects.toThrow(/teléfono/i);
    await expect(registrar(asis, { nombres: "Iván", apellidos: "Paz", fecha_nacimiento: await haceAnios(db, 10), sucursal_id: cat.sucursal,
      tutores: [{ nombre_completo: "Rosa Paz", cedula: "001-020202-0002C", telefono: "88882222" }] })).rejects.toThrow(/emergencia/i);
    await expect(registrar(asis, await adulto({ fecha_nacimiento: "2099-01-01" }))).rejects.toThrow(/fecha de nacimiento|futura|edad/i);
  });

  test("CE-38 · hermanos con el mismo tutor: el tutor se registra una sola vez", async () => {
    const tutor = { nombre_completo: "Jorge Castillo", cedula: "001-030303-0003D", telefono: "88883333" };
    const hermano = async (nombre: string, anios: number) => registrar(asis, {
      nombres: nombre, apellidos: "Castillo", fecha_nacimiento: await haceAnios(db, anios),
      contacto_emergencia: "Padre 88883333", sucursal_id: cat.sucursal, tutores: [tutor] });
    await hermano("Diego", 9); await hermano("Lucía", 11);
    const t = await db.query<{ n: number; v: number }>(
      `select count(distinct t.id)::int n, count(et.*)::int v from tutor t join estudiante_tutor et on et.tutor_id = t.id where t.cedula = $1`, [tutor.cedula]);
    expect([t.rows[0].n, t.rows[0].v]).toEqual([1, 2]);
  });

  test("CE-46 · solo la Asistente registra: Dirección y Profesor reciben un rechazo claro", async () => {
    for (const p of [dir, prof])
      await expect(registrar(p, await adulto())).rejects.toThrow(/Solo la Asistente/);
  });

  test("principio 6 · un rechazo no consume código: el siguiente sigue la secuencia", async () => {
    const a = await registrar(asis, await adulto());
    await expect(registrar(asis, await adulto({ telefono: null }))).rejects.toThrow();
    const b = await registrar(asis, await adulto());
    expect(Number(String(b.codigo_adei).slice(-5))).toBe(Number(String(a.codigo_adei).slice(-5)) + 1);
  });
});

describe("actualizar_estudiante (CE-40, CE-41, CE-80, CE-81, CE-86)", () => {
  test("CE-40 · cambia solo lo indicado, sube la versión y lo audita", async () => {
    const r = await registrar(asis, await adulto());
    const u = await actualizar(asis, r.id as string, 1, { direccion: "Bello Horizonte" });
    expect(u).toMatchObject({ estado: "actualizado", version: 2 });
    const e = await leer(r.id as string);
    expect(e.telefono).toBe("88887777");
    expect((await auditoria(r.id as string)).map((f) => f.tipo_accion)).toEqual(["Creación", "Modificación"]);
  });

  test("CE-40 · aplica las mismas validaciones del registro", async () => {
    const r = await registrar(asis, await adulto());
    await expect(actualizar(asis, r.id as string, 1, { cedula: "1234" })).rejects.toThrow(/estudiante_cedula_formato/);
    await expect(actualizar(asis, r.id as string, 1, { fecha_nacimiento: "2099-01-01" })).rejects.toThrow();
  });

  test("CE-30 · no se puede poner la cédula de otro estudiante", async () => {
    const a = await registrar(asis, await adulto()), d = await adulto();
    const b = await registrar(asis, d);
    const r = await actualizar(asis, a.id as string, 1, { cedula: d.cedula });
    expect(r.estado).toBe("cedula_existente");
    expect((r.expediente as { id: string }).id).toBe(b.id);
  });

  test("CE-41 · el código ADEI no se puede modificar por la operación ni por SQL directo", async () => {
    const r = await registrar(asis, await adulto());
    await expect(actualizar(asis, r.id as string, 1, { codigo_adei: "ADEI-2000-00001" })).rejects.toThrow(/no se pueden modificar: codigo_adei/);
    await expect(comoUsuario(db, asis, (tx) => tx.query("update estudiante set codigo_adei = 'ADEI-2000-00001' where id = $1", [r.id])))
      .rejects.toThrow(/código/i);
  });

  test("CE-80 · a un adulto sin teléfono se le advierte, pero se guarda el resto", async () => {
    const r = await registrar(asis, await adulto());
    await db.query("update estudiante set telefono = null where id = $1", [r.id]);  // dato heredado
    const u = await actualizar(asis, r.id as string, 2, { direccion: "Altamira" });
    expect(u).toMatchObject({ estado: "actualizado", advertencias: ["telefono_faltante"] });
  });

  test("CE-81 · si la nueva fecha lo vuelve menor, exige tutor (y contacto) antes de guardar", async () => {
    const r = await registrar(asis, await adulto({ contacto_emergencia: "Hermana 88884444" }));
    await expect(actualizar(asis, r.id as string, 1, { fecha_nacimiento: await haceAnios(db, 15) })).rejects.toThrow(/tutor/i);
    expect((await leer(r.id as string)).version).toBe(1);
  });

  test("CE-86 · si otra sesión lo cambió antes, no se sobrescribe y se avisa", async () => {
    const r = await registrar(asis, await adulto());
    await actualizar(asis, r.id as string, 1, { direccion: "Primera" });
    const u = await actualizar(asis, r.id as string, 1, { direccion: "Segunda" });
    expect(u.estado).toBe("conflicto");
    expect((await db.query<{ d: string }>("select direccion d from estudiante where id = $1", [r.id])).rows[0].d).toBe("Primera");
  });

  test("CE-97 · un estudiante de otra organización no existe para la Asistente", async () => {
    const r = await registrar(asisB, { ...(await adulto()), sucursal_id: catB.sucursal });
    await expect(actualizar(asis, r.id as string, 1, { direccion: "X" })).rejects.toThrow(/no existe/);
  });
});

describe("tutores (CE-38, CE-82)", () => {
  async function menorConTutor(cedulaTutor: string) {
    const r = await registrar(asis, {
      nombres: "Mateo", apellidos: `Ruiz ${"ABCDEFGHIJ"[++n % 10]}`, fecha_nacimiento: await haceAnios(db, 8, n),
      contacto_emergencia: "Madre 88885555", sucursal_id: cat.sucursal,
      tutores: [{ nombre_completo: "Ana Ruiz", cedula: cedulaTutor, telefono: "88885555" }] });
    const t = (await db.query<{ id: string }>("select id from tutor where cedula = $1 and organizacion_id = $2", [cedulaTutor, A])).rows[0].id;
    return { id: r.id as string, tutor: t };
  }
  const vincular = (id: string, tutor: object) => llamar(asis, "vincular_tutor($1, $2)", [id, JSON.stringify(tutor)]);
  const desvincular = (id: string, tutor: string) =>
    comoUsuario(db, asis, (tx: Transaction) => tx.query("select desvincular_tutor($1, $2)", [id, tutor]));

  test("CE-82 · no se puede desvincular al único tutor de un menor", async () => {
    const m = await menorConTutor("001-040404-0004E");
    await expect(desvincular(m.id, m.tutor)).rejects.toThrow(/tutor/i);
  });

  test("CE-82 · con un segundo tutor, el primero sí se puede desvincular", async () => {
    const m = await menorConTutor("001-050505-0005F");
    await vincular(m.id, { nombre_completo: "Raúl Ruiz", cedula: "001-060606-0006G", telefono: "88886666" });
    await desvincular(m.id, m.tutor);
    const q = await db.query<{ n: number }>("select count(*)::int n from estudiante_tutor where estudiante_id = $1", [m.id]);
    expect(q.rows[0].n).toBe(1);
  });

  test("CE-38 · vincular por id o por cédula reutiliza el registro existente", async () => {
    const m = await menorConTutor("001-070707-0007H");
    const otro = await menorConTutor("001-080808-0008J");
    expect(await vincular(otro.id, { id: m.tutor })).toBe(m.tutor);
    expect(await vincular(otro.id, { cedula: "001-070707-0007h", nombre_completo: "Ignorado", telefono: "88880000" })).toBe(m.tutor);
    const t = await db.query<{ nombre_completo: string }>("select nombre_completo from tutor where id = $1", [m.tutor]);
    expect(t.rows[0].nombre_completo).toBe("Ana Ruiz");
  });

  test("CE-97 · no se puede vincular el tutor de otra organización", async () => {
    const m = await menorConTutor("001-090909-0009K");
    const tutorB = (await db.query<{ id: string }>(
      "insert into tutor (organizacion_id, nombre_completo, cedula, telefono) values ($1,'Tutor Ajeno','001-111111-0011L','88880000') returning id", [B])).rows[0].id;
    await expect(vincular(m.id, { id: tutorB })).rejects.toThrow(/foreign key|violates/);
  });
});
