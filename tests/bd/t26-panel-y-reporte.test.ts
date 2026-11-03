/**
 * T26 — 014_consulta_y_reportes.sql, parte 5a: panel de entrega de actas y
 * reporte por sucursal. CE-75 a CE-88. Datos inventados (principio 3).
 *
 * Cada prueba usa su propia organización, porque el panel y el reporte cuentan
 * todo lo de la organización.
 */
import { describe, test, expect } from "vitest";
import { crearBanco } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa } from "../apoyo/acta";
import { diasDesdeHoy } from "../apoyo/escenario";

let n = 0;
async function nueva(): Promise<EscenarioActa> {
  const { db } = await crearBanco();
  return crearEscenarioActa(db, `ORG${String.fromCharCode(65 + n++)}`);
}
const hoy = () => diasDesdeHoy(0);
type Prof = { profesor_id: string; profesor: string; grupos: number; entregadas: number; pendientes: number; vencidas: number; detalle: Record<string, unknown>[] };

/** Entrega el acta: tres parciales a cada inscripción y entregar como profesor. */
async function entregar(e: EscenarioActa, grupo: string, inscripciones: string[], profesor = e.prof) {
  for (const i of inscripciones) await e.parciales(i, [90, 90, 90]);
  const r = await e.llamar(profesor, "entregar_acta($1, true)", [grupo]);
  if (r.estado !== "entregada") throw new Error(JSON.stringify(r));
}

describe("panel_actas (CE-75 a CE-80)", () => {
  test("CE-75, CE-77, CE-79 · por profesor: grupos, entregadas, pendientes y vencidas, con totales que cuadran", async () => {
    const e = await nueva();
    await e.nivel(6);
    const vencido = await e.grupoCon(1, { inicio: -40, termino: -2 });       // terminó y sigue Abierta
    const entregado = await e.grupoCon(2, { inicio: -40, termino: 3 });
    await entregar(e, entregado.grupo, entregado.inscripciones);
    const pendiente = await e.grupoCon(1, { inicio: -10, termino: 5 });
    const otro = await e.grupoCon(1, { inicio: -10, termino: 6, profesor: e.otroProf.profesorId! });
    const r = await e.llamar(e.asis, "panel_actas($1, $2)", [diasDesdeHoy(-5), diasDesdeHoy(10)]);
    expect(r.estado).toBe("ok");
    expect(r.totales).toEqual({ grupos: 4, entregadas: 1, pendientes: 3, vencidas: 1 });
    const profs = r.profesores as Prof[];
    const mio = profs.find((p) => p.profesor_id === e.prof.profesorId)!;
    expect([mio.grupos, mio.entregadas, mio.pendientes, mio.vencidas]).toEqual([3, 1, 2, 1]);
    const ids = mio.detalle.map((d) => d.grupo_id);
    expect(ids).toEqual(expect.arrayContaining([vencido.grupo, entregado.grupo, pendiente.grupo]));
    const det = mio.detalle.find((d) => d.grupo_id === entregado.grupo)!;
    expect(det).toMatchObject({ estado_acta: "Entregada", completas: 2, total: 2 });
    expect(det.fecha_entrega_acta).toBeTruthy();
    for (const k of ["codigo_grupo", "nivel", "hora_inicio", "hora_fin", "fecha_termino"]) expect(det).toHaveProperty(k);
    expect(profs.find((p) => p.profesor_id === e.otroProf.profesorId)!.grupos).toBe(1);
    expect(otro.grupo).toBeTruthy();
  });

  test("CE-75 · cuenta los grupos con término dentro del período", async () => {
    const e = await nueva();
    await e.grupoCon(1, { inicio: -10, termino: 40 });     // termina después del período
    const r = await e.llamar(e.dir, "panel_actas($1, $2)", [diasDesdeHoy(-5), diasDesdeHoy(10)]);
    expect(r.totales).toEqual({ grupos: 0, entregadas: 0, pendientes: 0, vencidas: 0 });
    expect(r.profesores).toEqual([]);
  });

  test("CE-76 · sin período, el mes en curso", async () => {
    const e = await nueva();
    const r = await e.llamar(e.asis, "panel_actas(null, null)");
    const [anio, mes] = hoy().split("-");
    expect(r.desde).toBe(`${anio}-${mes}-01`);
    expect((r.hasta as string).slice(0, 7)).toBe(`${anio}-${mes}`);
  });

  test("CE-78 · un período invertido se rechaza", async () => {
    const e = await nueva();
    await expect(e.llamar(e.asis, "panel_actas($1, $2)", [diasDesdeHoy(5), diasDesdeHoy(-5)])).rejects.toThrow(/anterior a la inicial/);
  });

  test("CE-80 · el grupo cuenta para su profesor actual", async () => {
    const e = await nueva();
    const { grupo } = await e.grupoCon(1, { inicio: -10, termino: 5 });
    await e.llamar(e.asis, "cambiar_profesor($1, $2, $3)", [grupo, e.otroProf.profesorId, "Cambio de horario del profesor"]);
    const r = await e.llamar(e.asis, "panel_actas($1, $2)", [diasDesdeHoy(-5), diasDesdeHoy(10)]);
    const profs = r.profesores as Prof[];
    expect(profs.map((p) => p.profesor_id)).toEqual([e.otroProf.profesorId]);
  });

  test("CE-18 · el profesor no ve el panel", async () => {
    const e = await nueva();
    expect(await e.llamar(e.prof, "panel_actas(null, null)")).toEqual({ estado: "denegado" });
  });
});

type Fila = { sucursal_id: string; sucursal: string; activos: number; desertores: number; egresados: number; total: number;
  registrados: number; a_desertor: number; a_egresado: number };

describe("reporte_sucursales (CE-81 a CE-86)", () => {
  test("CE-81, CE-82, CE-86 · estado actual y movimientos por sucursal, con el total que cuadra", async () => {
    const e = await nueva();
    const colinas = (await e.db.query<{ id: string }>(
      "insert into sucursal (organizacion_id, nombre, direccion) values ($1, 'Las Colinas', 'Managua') returning id", [e.org])).rows[0].id;
    const [a, b, c, d] = [await e.estudiante(), await e.estudiante(), await e.estudiante(), await e.estudiante()];
    await e.db.query("update estudiante set sucursal_id = $2 where id = $1", [d, colinas]);
    await e.llamar(e.asis, "cambiar_estado_matricula($1, 'Desertor', null, null, true)", [b]);
    await e.llamar(e.asis, "cambiar_estado_matricula($1, 'Egresado', $2, null, true)", [c, diasDesdeHoy(-90)]);
    const r = await e.llamar(e.dir, "reporte_sucursales($1, $2, null)", [diasDesdeHoy(-30), hoy()]);
    expect(r.estado).toBe("ok");
    const filas = r.sucursales as Fila[];
    const central = filas.find((f) => f.sucursal_id === e.cat.sucursal)!;
    const lc = filas.find((f) => f.sucursal_id === colinas)!;
    expect([central.activos, central.desertores, central.egresados, central.total]).toEqual([1, 1, 1, 3]);
    expect([central.registrados, central.a_desertor, central.a_egresado]).toEqual([3, 1, 0]);   // el egreso fue hace 90 días
    expect([lc.activos, lc.total, lc.registrados]).toEqual([1, 1, 1]);
    expect(r.totales).toMatchObject({ activos: 2, desertores: 1, egresados: 1, total: 4, registrados: 4, a_desertor: 1, a_egresado: 0 });
    expect(a).toBeTruthy();
  });

  test("CE-84 · limitado a una sucursal", async () => {
    const e = await nueva();
    await e.estudiante();
    const r = await e.llamar(e.asis, "reporte_sucursales(null, null, $1)", [e.cat.sucursal]);
    expect((r.sucursales as Fila[]).map((f) => f.sucursal_id)).toEqual([e.cat.sucursal]);
    await expect(e.llamar(e.asis, "reporte_sucursales(null, null, $1)", ["00000000-0000-0000-0000-000000000000"]))
      .rejects.toMatchObject({ code: "PT404" });
  });

  test("CE-83, CE-85 · sin datos: conteos en 0 y la marca, nunca una tabla vacía; mes en curso por omisión", async () => {
    const e = await nueva();
    const r = await e.llamar(e.asis, "reporte_sucursales(null, null, null)");
    expect(r.sin_datos).toBe(true);
    expect((r.sucursales as Fila[]).length).toBe(1);
    expect((r.sucursales as Fila[])[0]).toMatchObject({ activos: 0, total: 0, registrados: 0 });
    expect((r.desde as string).endsWith("-01")).toBe(true);
  });

  test("CE-88 · cada cifra del estado actual coincide con el filtrado que la produce", async () => {
    const e = await nueva();
    const [, b] = [await e.estudiante(), await e.estudiante()];
    await e.llamar(e.asis, "cambiar_estado_matricula($1, 'Desertor', null, null, true)", [b]);
    const r = await e.llamar(e.asis, "reporte_sucursales(null, null, null)");
    const f = (r.sucursales as Fila[])[0];
    for (const [estado, cifra] of [["Activo", f.activos], ["Desertor", f.desertores], ["Egresado", f.egresados]] as const) {
      const q = await e.llamar(e.asis, "filtrar($1, 'estudiantes', 1, 'pantalla')", [JSON.stringify({ sucursal_id: f.sucursal_id, estado_matricula: estado })]);
      expect(q.total).toBe(cifra);
    }
  });

  test("CE-18 · el profesor no ve el reporte", async () => {
    const e = await nueva();
    expect(await e.llamar(e.prof, "reporte_sucursales(null, null, null)")).toEqual({ estado: "denegado" });
  });
});

