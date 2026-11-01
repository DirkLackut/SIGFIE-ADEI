/**
 * T13 — 008_operaciones.sql, parte 2: abrir grupos, cambiar el profesor,
 * inscribir y anular inscripciones. Todo "como" la Asistente.
 */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco, comoUsuario } from "../apoyo/banco";
import { crearOrganizacion, crearCatalogoMinimo, crearPersona, crearProfesor, haceAnios, diasDesdeHoy, type Persona } from "../apoyo/escenario";

type Resp = { estado: string; [k: string]: unknown };
let db: PGlite, A: string;
let cat: Awaited<ReturnType<typeof crearCatalogoMinimo>>;
let asis: Persona, dir: Persona, prof: Persona;
let otroHorario = "", otraModalidad = "", horarioMismaModalidadSinChoque = "";
const anio = new Date().getFullYear();
const dias = diasDesdeHoy;

beforeAll(async () => {
  ({ db } = await crearBanco());
  A = await crearOrganizacion(db, "ADEI");
  cat = await crearCatalogoMinimo(db, A);
  asis = await crearPersona(db, A, ["asistente"]);
  dir = await crearPersona(db, A, ["direccion"]);
  prof = await crearPersona(db, A, ["profesor"], { profesorId: cat.profesor });
  otraModalidad = (await db.query<{ id: string }>(
    "insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'Sabatino','Sábado') returning id", [A])).rows[0].id;
  otroHorario = (await db.query<{ id: string }>(
    "insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1,$2,'08:00','12:00') returning id", [A, otraModalidad])).rows[0].id;
  horarioMismaModalidadSinChoque = (await db.query<{ id: string }>(
    "insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1,$2,'09:30','11:00') returning id", [A, cat.modalidad])).rows[0].id;
});

const llamar = (p: Persona, sql: string, args: unknown[]) =>
  comoUsuario(db, p, async (tx) => (await tx.query<{ r: Resp }>(`select ${sql} r`, args)).rows[0].r);
const datosGrupo = (extra: Record<string, unknown> = {}) => ({
  nivel_id: cat.nivel, modalidad_id: cat.modalidad, horario_id: cat.horario, profesor_id: cat.profesor,
  sucursal_id: cat.sucursal, fecha_inicio: dias(-3), fecha_termino: dias(25), ...extra });
const abrir = (extra: Record<string, unknown> = {}, p = asis) => llamar(p, "abrir_grupo($1)", [JSON.stringify(datosGrupo(extra))]);
const inscribir = (e: string, g: string, confirmar = false) => llamar(asis, "inscribir($1, $2, $3)", [e, g, confirmar]);
const anular = (i: string, motivo: string | null) =>
  comoUsuario(db, asis, (tx) => tx.query("select anular_inscripcion($1, $2)", [i, motivo]));
const cambiar = (g: string, p: string, motivo: string | null, quien = asis) =>
  comoUsuario(db, quien, (tx) => tx.query("select cambiar_profesor($1, $2, $3)", [g, p, motivo]));

let n = 0;
async function estudiante() {
  const r = await llamar(asis, "registrar_estudiante($1)", [JSON.stringify({
    cedula: `001-${String(200000 + ++n)}-0000A`, nombres: "Luis", apellidos: "Mora",
    fecha_nacimiento: await haceAnios(db, 30, n), telefono: "88887777", sucursal_id: cat.sucursal })]);
  return r.id as string;
}
const entregarActa = (g: string) =>
  db.query("update grupo set estado_acta = 'Entregada', fecha_entrega_acta = now() where id = $1", [g]);

describe("abrir_grupo (CE-47 a CE-50, CE-91, CE-92)", () => {
  test("CE-48 · abre con código G-AAAA-NNNN correlativo y acta Abierta", async () => {
    const a = await abrir(), b = await abrir();
    expect(a.estado).toBe("abierto");
    expect(a.codigo_grupo).toMatch(new RegExp(`^G-${anio}-\\d{4}$`));
    expect(Number(String(b.codigo_grupo).slice(-4))).toBe(Number(String(a.codigo_grupo).slice(-4)) + 1);
    const g = await db.query<{ estado_acta: string }>("select estado_acta from grupo where id = $1", [a.id]);
    expect(g.rows[0].estado_acta).toBe("Abierta");
  });

  test("CE-49 · el horario debe ser de la modalidad elegida", async () => {
    await expect(abrir({ horario_id: otroHorario })).rejects.toThrow(/no pertenece a la modalidad/);
  });

  test("CE-47 · no se abre con un profesor, nivel u horario inactivo", async () => {
    const inactivo = await crearProfesor(db, A, "Pedro", "Inactivo");
    await db.query("update profesor set activo = false where id = $1", [inactivo]);
    await expect(abrir({ profesor_id: inactivo })).rejects.toThrow(/activos/);
  });

  test("CE-91 · se puede abrir un grupo que ya inició; CE-92 · no uno que ya terminó", async () => {
    expect((await abrir({ fecha_inicio: dias(-20), fecha_termino: dias(0) })).estado).toBe("abierto");
    await expect(abrir({ fecha_inicio: dias(-40), fecha_termino: dias(-1) })).rejects.toThrow(/ya pasó/);
  });

  test("CE-50 · la fecha de término debe ser posterior a la de inicio", async () => {
    await expect(abrir({ fecha_inicio: dias(5), fecha_termino: dias(5) })).rejects.toThrow(/grupo_termino_despues_de_inicio/);
  });

  test("solo la Asistente abre grupos", async () => {
    await expect(abrir({}, dir)).rejects.toThrow(/Solo la Asistente/);
  });
});

describe("cambiar_profesor (CE-51 a CE-53)", () => {
  test("CE-51 · cambia por otro profesor activo y deja el motivo en la auditoría", async () => {
    const g = (await abrir()).id as string;
    const nuevo = await crearProfesor(db, A, "Sara", "Núñez");
    await cambiar(g, nuevo, "Licencia del profesor titular");
    const r = await db.query<{ profesor_id: string }>("select profesor_id from grupo where id = $1", [g]);
    expect(r.rows[0].profesor_id).toBe(nuevo);
    const a = await db.query<{ detalle: string }>(
      "select detalle from auditoria where entidad = 'grupo' and tipo_accion = 'Modificación' order by id desc limit 1");
    expect(a.rows[0].detalle).toBe("Licencia del profesor titular");
  });

  test("CE-51 · exige motivo", async () => {
    const g = (await abrir()).id as string;
    const nuevo = await crearProfesor(db, A, "Sara", "Núñez");
    await expect(cambiar(g, nuevo, null)).rejects.toThrow(/motivo/);
    await expect(cambiar(g, nuevo, "  ab ")).rejects.toThrow(/motivo/);
  });

  test("CE-51 · el profesor nuevo debe estar activo", async () => {
    const g = (await abrir()).id as string;
    const inactivo = await crearProfesor(db, A, "Tomás", "Inactivo");
    await db.query("update profesor set activo = false where id = $1", [inactivo]);
    await expect(cambiar(g, inactivo, "Cambio de turno")).rejects.toThrow(/activo/);
  });

  test("CE-53 · con el acta Entregada no se puede cambiar", async () => {
    const g = (await abrir()).id as string;
    await entregarActa(g);
    await expect(cambiar(g, await crearProfesor(db, A), "Cambio de turno")).rejects.toThrow(/ya fue entregada/);
  });

  test("CE-52 · el profesor anterior deja de ver el grupo al instante", async () => {
    const g = (await abrir()).id as string;
    const ve = () => comoUsuario(db, prof, async (tx) => (await tx.query("select id from grupo where id = $1", [g])).rows.length);
    expect(await ve()).toBe(1);
    await cambiar(g, await crearProfesor(db, A, "Otra", "Profesora"), "Reasignación de grupos");
    expect(await ve()).toBe(0);
  });
});

describe("inscribir (CE-54 a CE-57, CE-84, CE-93)", () => {
  test("CE-54 · queda En curso con la fecha del día", async () => {
    const r = await inscribir(await estudiante(), (await abrir()).id as string);
    expect(r.estado).toBe("inscrito");
    const i = await db.query<{ e: string; f: string }>(
      "select estado_inscripcion e, fecha_inscripcion::text f from inscripcion where id = $1", [r.id]);
    expect(i.rows[0]).toEqual({ e: "En curso", f: (await db.query<{ h: string }>("select hoy_managua()::text h")).rows[0].h });
  });

  test("CE-55 · un estudiante que no está Activo no se inscribe", async () => {
    const e = await estudiante();
    await db.query("update estudiante set estado_matricula = 'Desertor', fecha_cambio_estado = now() where id = $1", [e]);
    await expect(inscribir(e, (await abrir()).id as string)).rejects.toThrow(/Activo/);
  });

  test("CE-56 · la segunda inscripción en el mismo grupo se rechaza", async () => {
    const e = await estudiante(), g = (await abrir()).id as string;
    await inscribir(e, g);
    expect((await inscribir(e, g)).estado).toBe("ya_inscrito");
  });

  test("CE-57 · con el acta Entregada no se inscribe", async () => {
    const g = (await abrir()).id as string;
    await entregarActa(g);
    await expect(inscribir(await estudiante(), g)).rejects.toThrow(/ya fue entregada/);
  });

  test("CE-93 · en un grupo que ya terminó no se inscribe", async () => {
    const g = (await abrir()).id as string;
    await db.query("update grupo set fecha_inicio = $2, fecha_termino = $3 where id = $1", [g, dias(-30), dias(-1)]);
    await expect(inscribir(await estudiante(), g)).rejects.toThrow(/ya terminó/);
  });

  test("CE-84 · si se superpone con otra inscripción en curso, advierte y no inscribe", async () => {
    const e = await estudiante();
    const g1 = await abrir(), g2 = await abrir();
    await inscribir(e, g1.id as string);
    const r = await inscribir(e, g2.id as string);
    expect(r.estado).toBe("superposicion");
    expect((r.grupos as { codigo_grupo: string }[]).map((x) => x.codigo_grupo)).toEqual([g1.codigo_grupo]);
    const q = await db.query<{ n: number }>("select count(*)::int n from inscripcion where estudiante_id = $1", [e]);
    expect(q.rows[0].n).toBe(1);
  });

  test("CE-84 · al confirmar se inscribe y la confirmación queda en la auditoría", async () => {
    const e = await estudiante();
    const g1 = await abrir(), g2 = await abrir();
    await inscribir(e, g1.id as string);
    const r = await inscribir(e, g2.id as string, true);
    expect(r.estado).toBe("inscrito");
    const a = await db.query<{ detalle: string }>(
      "select detalle from auditoria where entidad = 'inscripcion' and tipo_accion = 'Creación' order by id desc limit 1");
    expect(a.rows[0].detalle).toContain(String(g1.codigo_grupo));
  });

  test("CE-84 · horario contiguo, otra modalidad o fechas distintas no son superposición", async () => {
    const e = await estudiante();
    await inscribir(e, (await abrir()).id as string);  // 08:00–09:30
    expect((await inscribir(e, (await abrir({ horario_id: horarioMismaModalidadSinChoque })).id as string)).estado).toBe("inscrito");
    expect((await inscribir(e, (await abrir({ modalidad_id: otraModalidad, horario_id: otroHorario })).id as string)).estado).toBe("inscrito");
    expect((await inscribir(e, (await abrir({ fecha_inicio: dias(26), fecha_termino: dias(50) })).id as string)).estado).toBe("inscrito");
  });
});

describe("anular_inscripcion (CE-58, CE-59)", () => {
  test("CE-58 · con motivo se anula; CE-59 · la auditoría conserva todos sus datos", async () => {
    const e = await estudiante(), g = (await abrir()).id as string;
    const i = (await inscribir(e, g)).id as string;
    await anular(i, "Inscrito en el grupo equivocado");
    expect((await db.query("select 1 from inscripcion where id = $1", [i])).rows).toHaveLength(0);
    const a = await db.query<{ valor_anterior: { estudiante_id: string; grupo_id: string; estado_inscripcion: string }; detalle: string }>(
      "select valor_anterior, detalle from auditoria where entidad = 'inscripcion' and tipo_accion = 'Eliminación' order by id desc limit 1");
    expect(a.rows[0].valor_anterior).toMatchObject({ estudiante_id: e, grupo_id: g, estado_inscripcion: "En curso" });
    expect(a.rows[0].detalle).toBe("Inscrito en el grupo equivocado");
  });

  test("CE-58 · sin motivo no se anula", async () => {
    const i = (await inscribir(await estudiante(), (await abrir()).id as string)).id as string;
    await expect(anular(i, "")).rejects.toThrow(/motivo/);
  });

  test("CE-58 · con el acta Entregada no se anula", async () => {
    const g = (await abrir()).id as string;
    const i = (await inscribir(await estudiante(), g)).id as string;
    await entregarActa(g);
    await expect(anular(i, "Error de captura")).rejects.toThrow(/ya fue entregada/);
  });
});

test("el motivo de una operación no se filtra a la siguiente transacción", async () => {
  const i = (await inscribir(await estudiante(), (await abrir()).id as string)).id as string;
  await anular(i, "Motivo que no debe repetirse");
  await abrir();
  const a = await db.query<{ detalle: string | null }>(
    "select detalle from auditoria where entidad = 'grupo' and tipo_accion = 'Creación' order by id desc limit 1");
  expect(a.rows[0].detalle).toBeNull();
});
