/**
 * T25 — 014_consulta_y_reportes.sql, parte 2: estado de matrícula. CE-67 a CE-74.
 * Datos inventados (constitución, principio 3).
 */
import { describe, test, expect, beforeAll } from "vitest";
import { crearBanco, comoUsuario } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa } from "../apoyo/acta";
import { diasDesdeHoy } from "../apoyo/escenario";

let e: EscenarioActa;
let otra: EscenarioActa;

beforeAll(async () => {
  const { db } = await crearBanco();
  e = await crearEscenarioActa(db);
  otra = await crearEscenarioActa(db, "OTRA");
});

const cambiar = (est: string, estado: string, fecha: string | null = null, obs: string | null = null, confirmar = false, quien = e.asis) =>
  e.llamar(quien, "cambiar_estado_matricula($1, $2, $3, $4, $5)", [est, estado, fecha, obs, confirmar]);
const leer = async (est: string) =>
  (await e.db.query<{ estado_matricula: string; fecha_cambio_estado: string | null; version: number }>(
    "select estado_matricula, to_char(fecha_cambio_estado, 'YYYY-MM-DD') fecha_cambio_estado, version from estudiante where id = $1", [est])).rows[0];

describe("cambiar_estado_matricula (CE-67 a CE-74)", () => {
  test("CE-67, CE-69 · guarda el estado nuevo con la fecha de hoy si no se da otra", async () => {
    const est = await e.estudiante();
    const antes = await leer(est);
    expect(await cambiar(est, "Egresado")).toMatchObject({ estado: "cambiado" });
    const d = await leer(est);
    expect([d.estado_matricula, d.fecha_cambio_estado]).toEqual(["Egresado", diasDesdeHoy(0)]);
    expect(d.version).toBe(antes.version + 1);   // protege la edición simultánea (001·CE-86)
  });

  test("CE-69 · acepta una fecha anterior; rechaza la futura y la anterior al último cambio", async () => {
    const est = await e.estudiante();
    expect(await cambiar(est, "Desertor", diasDesdeHoy(-20))).toMatchObject({ estado: "cambiado" });
    expect((await leer(est)).fecha_cambio_estado).toBe(diasDesdeHoy(-20));
    await expect(cambiar(est, "Activo", diasDesdeHoy(1))).rejects.toThrow(/posterior a hoy/);
    await expect(cambiar(est, "Activo", diasDesdeHoy(-30))).rejects.toThrow(/anterior al último cambio/);
    expect(await cambiar(est, "Activo", diasDesdeHoy(-20))).toMatchObject({ estado: "cambiado" });
  });

  test("CE-68 · el mismo estado que el actual se rechaza", async () => {
    const est = await e.estudiante();
    await expect(cambiar(est, "Activo")).rejects.toThrow(/ya está en estado Activo/);
  });

  test("CE-67 · solo Activo, Desertor o Egresado", async () => {
    const est = await e.estudiante();
    await expect(cambiar(est, "Suspendido")).rejects.toMatchObject({ constraint: "estudiante_estado_matricula_check" });
  });

  test("CE-70, CE-73 · la observación (máx. 300) y los valores anterior y nuevo quedan en la bitácora", async () => {
    const est = await e.estudiante();
    await expect(cambiar(est, "Desertor", null, "x".repeat(301))).rejects.toThrow(/300 caracteres/);
    await cambiar(est, "Desertor", null, "Se mudó a León");
    const a = await e.db.query<{ valor_anterior: Record<string, string>; valor_nuevo: Record<string, string>; detalle: string }>(
      `select valor_anterior, valor_nuevo, detalle from auditoria
       where entidad = 'estudiante' and tipo_accion = 'Modificación' and registro_afectado = $1 order by id desc limit 1`, [est]);
    const f = a.rows[0];
    expect([f.valor_anterior.estado_matricula, f.valor_nuevo.estado_matricula]).toEqual(["Activo", "Desertor"]);
    expect(f.valor_nuevo.fecha_cambio_estado).toBe(diasDesdeHoy(0));
    expect(f.detalle).toMatch(/Se mudó a León/);
  });

  test("CE-71 · con una inscripción En curso advierte, la muestra y pide confirmar; no toca la inscripción", async () => {
    const { grupo, inscripciones: [i] } = await e.grupoCon(1);
    const est = (await e.db.query<{ estudiante_id: string }>("select estudiante_id from inscripcion where id = $1", [i])).rows[0].estudiante_id;
    const r = await cambiar(est, "Desertor");
    expect(r.estado).toBe("advertir");
    expect((r.inscripciones as { inscripcion_id: string; grupo_id: string }[])[0]).toMatchObject({ inscripcion_id: i, grupo_id: grupo });
    expect((await leer(est)).estado_matricula).toBe("Activo");
    expect(await cambiar(est, "Desertor", null, null, true)).toMatchObject({ estado: "cambiado" });
    const ins = await e.db.query<{ estado_inscripcion: string }>("select estado_inscripcion from inscripcion where id = $1", [i]);
    expect(ins.rows[0].estado_inscripcion).toBe("En curso");
  });

  test("CE-72 · Desertor no se inscribe; al volver a Activo, sí", async () => {
    const est = await e.estudiante();
    const g = await e.grupo();
    await cambiar(est, "Desertor");
    const r = await e.llamar(e.asis, "inscribir($1, $2, true, 'Prueba')", [est, g]).catch((x: Error) => ({ estado: "error", mensaje: x.message }));
    expect(JSON.stringify(r)).toMatch(/Activo/);
    await cambiar(est, "Activo");
    expect((await e.llamar(e.asis, "inscribir($1, $2, true, 'Prueba')", [est, g])).estado).toBe("inscrito");
  });

  test("CE-74 · Dirección y el profesor no cambian el estado; otra organización «no existe»", async () => {
    const est = await e.estudiante();
    for (const p of [e.dir, e.prof]) await expect(cambiar(est, "Egresado", null, null, false, p)).rejects.toThrow(/Solo la Asistente/);
    await expect(otra.llamar(otra.asis, "cambiar_estado_matricula($1, 'Egresado', null, null, false)", [est])).rejects.toMatchObject({ code: "PT404" });
  });
});

describe("la regla vive en la base (principio 1)", () => {
  test("un cambio de estado directo por la API sin fecha válida se rechaza", async () => {
    const est = await e.estudiante();
    await expect(comoUsuario(e.db, e.asis, (tx) => tx.query(
      "update estudiante set estado_matricula = 'Egresado' where id = $1", [est]))).rejects.toThrow(/fecha del cambio/);
    await expect(comoUsuario(e.db, e.asis, (tx) => tx.query(
      "update estudiante set estado_matricula = 'Egresado', fecha_cambio_estado = $2 where id = $1", [est, diasDesdeHoy(3)])))
      .rejects.toThrow(/posterior a hoy/);
  });

  test("la fecha del cambio no se mueve sin cambiar el estado", async () => {
    const est = await e.estudiante();
    await cambiar(est, "Egresado");
    await expect(comoUsuario(e.db, e.asis, (tx) => tx.query(
      "update estudiante set fecha_cambio_estado = $2 where id = $1", [est, diasDesdeHoy(-5)]))).rejects.toThrow(/solo cambia con el estado/);
  });
});
