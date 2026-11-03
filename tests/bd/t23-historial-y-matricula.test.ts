/**
 * T23 — 014_consulta_y_reportes.sql, parte 4: historial académico y Hoja de
 * matrícula. CE-36 a CE-51. Datos inventados (constitución, principio 3).
 */
import { describe, test, expect, beforeAll } from "vitest";
import { crearBanco } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa, type Resp } from "../apoyo/acta";
import { diasDesdeHoy, haceAnios } from "../apoyo/escenario";

let e: EscenarioActa;
let otra: EscenarioActa;
let n6 = "", n7 = "", n8 = "";

beforeAll(async () => {
  const { db } = await crearBanco();
  e = await crearEscenarioActa(db);
  otra = await crearEscenarioActa(db, "OTRA");
  n6 = await e.nivel(6); n7 = await e.nivel(7); n8 = await e.nivel(8);
  await e.regla("Curso principal", 6, 13, 80, [77, 80]);
});

const historial = (est: string, quien = e.asis) => e.llamar(quien, "historial_academico($1)", [est]);
const hoja = (ins: string, quien = e.asis) => e.llamar(quien, "hoja_matricula($1)", [ins]);
type Ins = Record<string, unknown> & { parciales: { numero: number; condicion: string; valor: number | null }[] };
const inscripciones = (r: Resp) => r.inscripciones as Ins[];
let factura = 43000;
const registrarFactura = (estudiantes: string[], extra: Record<string, unknown> = {}) =>
  e.llamar(e.asis, "registrar_factura($1, true)", [JSON.stringify({
    serie: "B", numero: ++factura, fecha_emision: diasDesdeHoy(0), monto: 34, moneda: "USD", forma_pago: "Efectivo", estudiantes, ...extra })]);

async function menorConTutor() {
  // Los menores se llaman igual: se confirma que son personas distintas (001·CE-31).
  const r = await e.llamar(e.asis, "registrar_estudiante($1, true)", [JSON.stringify({
    nombres: "Carla Inés", apellidos: "Prueba Solís", fecha_nacimiento: await haceAnios(e.db, 12),
    contacto_emergencia: "Abuela, 88881111", sucursal_id: e.cat.sucursal,
    tutores: [{ nombre_completo: "Mario Prueba Solís", cedula: "001-010180-0001A", telefono: "88882222" }] })]);
  if (!r.id) throw new Error(JSON.stringify(r));
  return r.id as string;
}

describe("historial_academico (CE-36 a CE-42)", () => {
  test("CE-36, CE-37 · identificación y todas las inscripciones en orden cronológico", async () => {
    const est = await e.estudiante();
    const g8 = await e.grupo({ nivel: n8, inicio: 40, termino: 70 });
    const g6 = await e.grupo({ nivel: n6, inicio: -60, termino: 1 });
    const g7 = await e.grupo({ nivel: n7, inicio: 5, termino: 35 });
    const i8 = await e.inscribir(est, g8); const i6 = await e.inscribir(est, g6); const i7 = await e.inscribir(est, g7);
    await e.parciales(i6, [85, "Justificado", 90]);
    const r = await historial(est);
    expect(r.estado).toBe("ok");
    expect(r.estudiante).toMatchObject({ codigo_adei: expect.stringMatching(/^ADEI-/), estado_matricula: "Activo", sucursal: "Central" });
    expect(r.estudiante).toHaveProperty("fecha_cambio_estado");
    expect(r.estudiante).toHaveProperty("cedula");
    const lista = inscripciones(r);
    expect(lista.map((x) => x.id)).toEqual([i6, i7, i8]);
    const primera = lista[0];
    for (const k of ["codigo_grupo", "programa", "nivel", "modalidad", "hora_inicio", "hora_fin", "profesor", "sucursal",
      "fecha_inicio", "fecha_termino", "estado_inscripcion", "estado_acta", "factura"]) expect(primera).toHaveProperty(k);
    expect(primera.parciales.map((p) => p.condicion)).toEqual(["Registrado", "Justificado", "Registrado"]);
    expect([primera.nota_final, primera.estado_academico]).toEqual([88, "Aprobado"]);
  });

  test("CE-38 · reprobado y Condicionado con su justificación", async () => {
    const est = await e.estudiante();
    const i1 = await e.inscribir(est, await e.grupo({ nivel: n6, inicio: -60, termino: 1 }));
    const i2 = await e.inscribir(est, await e.grupo({ nivel: n7, inicio: 2, termino: 40 }));
    await e.parciales(i1, [70, 70, 70]);
    await e.parciales(i2, [78, 78, 78]);
    await e.llamar(e.asis, "condicionar($1, $2)", [i2, "Buen desempeño oral en clase"]);
    const [a, b] = inscripciones(await historial(est));
    expect([a.estado_academico, a.nota_final]).toEqual(["Reprobado", 70]);
    expect([b.estado_academico, b.condicionado, b.justificacion_condicionado]).toEqual(["Condicionado", true, "Buen desempeño oral en clase"]);
  });

  test("CE-39 · la nota de un acta Abierta incompleta es provisional", async () => {
    const est = await e.estudiante();
    const i = await e.inscribir(est, await e.grupo());
    await e.parciales(i, [90]);
    const [x] = inscripciones(await historial(est));
    expect([x.provisional, x.estado_academico, x.estado_acta]).toEqual([true, "Pendiente", "Abierta"]);
  });

  test("CE-40 · sin inscripciones: lista vacía", async () => {
    const r = await historial(await e.estudiante());
    expect([r.estado, inscripciones(r)]).toEqual(["ok", []]);
  });

  test("CE-41 · abrir un historial queda en la bitácora", async () => {
    const est = await e.estudiante();
    await historial(est, e.dir);
    const a = await e.db.query("select 1 from auditoria where tipo_accion = 'Consulta' and entidad = 'historial' and registro_afectado = $1 and usuario_id = $2",
      [est, e.dir.id]);
    expect(a.rows).toHaveLength(1);
  });

  test("CE-42 · una inscripción anulada por error no aparece", async () => {
    const est = await e.estudiante();
    const i = await e.inscribir(est, await e.grupo());
    await e.llamar(e.asis, "anular_inscripcion($1, $2)", [i, "Inscrita por error en el grupo equivocado"]);
    expect(inscripciones(await historial(est))).toEqual([]);
  });

  test("CE-65 · las facturas del estudiante, con la de cada inscripción", async () => {
    const est = await e.estudiante(), hermano = await e.estudiante();
    const i = await e.inscribir(est, await e.grupo());
    const f1 = await registrarFactura([est, hermano], { inscripcion_id: i });
    const f2 = await registrarFactura([est], { monto: 1245, moneda: "NIO" });
    const r = await historial(est);
    expect(inscripciones(r)[0].factura).toMatchObject({ id: f1.id, serie: "B", moneda: "USD" });
    expect((r.facturas as { id: string }[]).map((f) => f.id).sort()).toEqual([f1.id, f2.id].sort());
    const delHermano = await historial(hermano);
    expect((delHermano.facturas as { id: string }[]).map((f) => f.id)).toEqual([f1.id]);
  });

  test("CE-18, CE-97 · el profesor no lo consulta; un estudiante ajeno «no existe»", async () => {
    const est = await e.estudiante();
    expect(await historial(est, e.prof)).toEqual({ estado: "denegado" });
    const a = await e.db.query("select 1 from auditoria where tipo_accion = 'Denegación' and entidad = 'historial' and usuario_id = $1", [e.prof.id]);
    expect(a.rows).toHaveLength(1);
    await expect(otra.llamar(otra.asis, "historial_academico($1)", [est])).rejects.toMatchObject({ code: "PT404" });
  });
});

describe("hoja_matricula (CE-44 a CE-51)", () => {
  test("CE-45 · los datos del alumno, del tutor y de la academia", async () => {
    const est = await menorConTutor();
    const g = await e.grupo({ nivel: n6 });
    const i = await e.inscribir(est, g);
    await registrarFactura([est], { inscripcion_id: i, monto: 1245.5, moneda: "NIO", numero: 47133 });
    const r = await hoja(i);
    expect(r.estado).toBe("ok");
    expect(r.alumno).toMatchObject({ nombres: "Carla Inés", apellidos: "Prueba Solís", edad: 12, contacto_emergencia: "Abuela, 88881111",
      cedula: null, telefono: null, fecha_ingreso: diasDesdeHoy(0) });
    expect(r.tutor).toMatchObject({ nombre_completo: "Mario Prueba Solís", cedula: "001-010180-0001A", telefono: "88882222" });
    expect(r.academia).toMatchObject({ nivel: "Curso principal 6", curso: "Curso principal", modalidad: "Diario",
      inscrito_por: expect.any(String), recibo: "B-47133", paga: { monto: 1245.5, moneda: "NIO" } });
    for (const k of ["hora_inicio", "hora_fin", "fecha_inicio", "fecha_termino", "profesor"]) expect(r.academia).toHaveProperty(k);
  });

  test("CE-45 · sin factura asociada, recibo y paga quedan vacíos", async () => {
    const i = await e.inscribir(await e.estudiante(), await e.grupo());
    expect((await hoja(i)).academia).toMatchObject({ recibo: null, paga: null });
  });

  test("CE-48 · no lleva estado civil ni salud", async () => {
    const i = await e.inscribir(await menorConTutor(), await e.grupo());
    const texto = JSON.stringify(await hoja(i)).toLowerCase();
    for (const prohibido of ["civil", "enfermedad", "salud", "padece"]) expect(texto).not.toContain(prohibido);
  });

  test("CE-49 · con más de un tutor, el primero vinculado y cuántos más hay", async () => {
    const est = await menorConTutor();
    await e.llamar(e.asis, "vincular_tutor($1, $2)", [est, JSON.stringify({ nombre_completo: "Lucía Prueba Rojas", cedula: "001-020282-0002B", telefono: "88883333" })]);
    const r = await hoja(await e.inscribir(est, await e.grupo()));
    expect([((r.tutor as Record<string, unknown>).nombre_completo), r.tutores_adicionales]).toEqual(["Mario Prueba Solís", 1]);
  });

  test("CE-50 · generarla queda en la bitácora", async () => {
    const i = await e.inscribir(await e.estudiante(), await e.grupo());
    await hoja(i);
    const a = await e.db.query("select 1 from auditoria where tipo_accion = 'Consulta' and entidad = 'hoja_matricula' and registro_afectado = $1", [i]);
    expect(a.rows).toHaveLength(1);
  });

  test("CE-51 · solo la Asistente: Dirección y el profesor reciben «denegado»", async () => {
    const i = await e.inscribir(await e.estudiante(), await e.grupo());
    for (const p of [e.dir, e.prof]) expect(await hoja(i, p)).toEqual({ estado: "denegado" });
    await expect(otra.llamar(otra.asis, "hoja_matricula($1)", [i])).rejects.toMatchObject({ code: "PT404" });
  });
});
