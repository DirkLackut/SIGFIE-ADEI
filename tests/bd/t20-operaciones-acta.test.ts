/**
 * T20 — 012_captura_academica.sql, parte 3: las operaciones del acta, cada una
 * con cada rol. CE-1 a CE-6, CE-11 a CE-13, CE-29 a CE-58, CE-60 a CE-62.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { crearBanco, comoUsuario } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa, type Resp, type Resultado } from "../apoyo/acta";

let e: EscenarioActa;
let n6 = "", n7 = "", n8 = "", n5 = "";

beforeAll(async () => {
  const { db } = await crearBanco();
  e = await crearEscenarioActa(db);
  n5 = await e.nivel(5); n6 = await e.nivel(6); n7 = await e.nivel(7); n8 = await e.nivel(8);
  await e.regla("Curso principal", 1, 5, 75, [72, 75]);
  await e.regla("Curso principal", 6, 13, 80, [77, 80]);
});

type P = (number | string | null)[];
const lista = (valores: P) => JSON.stringify(valores.map((v, i) => typeof v === "number"
  ? { numero: i + 1, condicion: "Registrado", valor: v }
  : { numero: i + 1, condicion: v ?? "" }));
const guardar = (quien: typeof e.prof, i: string, valores: P | string, version: number, motivo: string | null = null) =>
  e.llamar(quien, "guardar_parciales($1, $2, $3, $4)", [i, typeof valores === "string" ? valores : lista(valores), version, motivo]);
const res = (r: Resp) => r.resultado as Resultado;
const version = async (i: string) => (await e.resultado(i)).version;

describe("mis_grupos (CE-1 a CE-3)", () => {
  test("CE-1, CE-2 · el profesor ve solo sus grupos, con el avance del acta", async () => {
    const { grupo, inscripciones: [a] } = await e.grupoCon(2);
    await e.grupo({ profesor: e.otroProf.profesorId! });
    await e.parciales(a, [80, 80, 80]);
    const r = (await e.llamar(e.prof, "mis_grupos()")) as unknown as { id: string; completas: number; total: number; estado_acta: string }[];
    const g = r.find((x) => x.id === grupo)!;
    expect([g.completas, g.total, g.estado_acta]).toEqual([1, 2, "Abierta"]);
    const otro = (await e.llamar(e.otroProf, "mis_grupos()")) as unknown as { id: string }[];
    expect(otro.some((x) => x.id === grupo)).toBe(false);
  });

  test("quien no es profesor no tiene «Mis grupos»", async () => {
    for (const p of [e.asis, e.dir]) await expect(e.llamar(p, "mis_grupos()")).rejects.toThrow(/Solo un profesor/);
  });
});

describe("acta_del_grupo (CE-4 a CE-6, CE-58)", () => {
  let grupo = "";
  beforeAll(async () => { ({ grupo } = await e.grupoCon(2)); });

  test("CE-5, Q6 · el profesor del grupo la ve, y de cada estudiante solo nombre, apellidos y código", async () => {
    const r = await e.llamar(e.prof, "acta_del_grupo($1)", [grupo]);
    expect(r.estado).toBe("ok");
    const filas = r.filas as Record<string, unknown>[];
    expect(filas).toHaveLength(2);
    for (const f of filas) {
      expect(f).toHaveProperty("codigo_adei");
      expect(f).not.toHaveProperty("cedula");
      expect(f).not.toHaveProperty("telefono");
      expect(f).not.toHaveProperty("fecha_nacimiento");
    }
    expect((r.permisos as Record<string, boolean>).capturar).toBe(true);
  });

  test("CE-4 · otro profesor recibe «denegado» y la denegación queda registrada", async () => {
    const r = await e.llamar(e.otroProf, "acta_del_grupo($1)", [grupo]);
    expect(r).toEqual({ estado: "denegado" });
    const a = await e.db.query("select 1 from auditoria where tipo_accion = 'Denegación' and entidad = 'acta' and registro_afectado = $1 and usuario_id = $2",
      [grupo, e.otroProf.id]);
    expect(a.rows).toHaveLength(1);
  });

  test("CE-58 · Dirección la consulta sin poder capturar", async () => {
    const r = await e.llamar(e.dir, "acta_del_grupo($1)", [grupo]);
    expect(r.estado).toBe("ok");
    expect(Object.values(r.permisos as Record<string, boolean>).some(Boolean)).toBe(false);
  });

  test("CE-59 · un grupo de otra organización «no existe» (404)", async () => {
    const otra = await crearEscenarioActa(e.db, "OTRB");
    await expect(otra.llamar(otra.asis, "acta_del_grupo($1)", [grupo])).rejects.toMatchObject({ code: "PT404" });
  });
});

describe("guardar_parciales (CE-7 a CE-13, CE-47 a CE-49)", () => {
  test("CE-7, CE-14 · el profesor guarda y recibe la nota calculada", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    const r = await guardar(e.prof, i, [85, "No presentado", 95], 0);
    expect(r.estado).toBe("guardado");
    expect([res(r).nota_final, res(r).estado, res(r).version]).toEqual([60, "Reprobado", 1]);
  });

  test("CE-8 · rechaza decimales, texto y valores fuera de 0–100", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    for (const valor of [85.5, 101, -3, "85", "abc"])
      await expect(guardar(e.prof, i, JSON.stringify([{ numero: 1, condicion: "Registrado", valor }]), 0))
        .rejects.toMatchObject({ constraint: "parcial_valor_rango" });
  });

  test("CE-10 · No presentado y Justificado no llevan nota", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await expect(guardar(e.prof, i, JSON.stringify([{ numero: 1, condicion: "Justificado", valor: 90 }]), 0))
      .rejects.toMatchObject({ constraint: "parcial_valor_segun_condicion" });
  });

  test("CE-35 · el profesor no pone Reprogramado sin autorización", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await expect(guardar(e.prof, i, JSON.stringify([{ numero: 1, condicion: "Reprogramado", valor: 90 }]), 0))
      .rejects.toMatchObject({ constraint: "parcial_reprogramado_autorizado" });
  });

  test("dejar la condición vacía quita el parcial", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardar(e.prof, i, [80, 80, 80], 0);
    const r = await guardar(e.prof, i, [80, 80, null], 1);
    expect([res(r).provisional, res(r).faltan]).toEqual([true, [3]]);
  });

  test("CE-12 · si otra sesión guardó antes, responde conflicto y no escribe", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardar(e.prof, i, [70, null, null], 0);
    const r = await guardar(e.prof, i, [99, 99, 99], 0);
    expect(r.estado).toBe("conflicto");
    expect(res(r).parciales.map((p) => p.valor)).toEqual([70]);
  });

  test("CE-11, A3 · otro profesor, la Asistente con el acta Abierta y Dirección no capturan", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    for (const p of [e.otroProf, e.asis, e.dir])
      await expect(guardar(p, i, [80, 80, 80], 0)).rejects.toThrow(/Solo el profesor del grupo/);
  });

  test("CE-13 · una inscripción Retirada no lleva parciales", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await e.llamar(e.asis, "decidir_salida($1, 'retiro', 'Viaje fuera del país', false)", [i]);
    await expect(guardar(e.prof, i, [80, 80, 80], await version(i))).rejects.toThrow(/Retirada/);
  });

  test("CE-47 a CE-49 · con el acta Entregada solo la Asistente modifica, con motivo, y se recalcula", async () => {
    const { grupo, inscripciones: [i] } = await e.grupoCon(1);
    await guardar(e.prof, i, [70, 70, 70], 0);
    await e.llamar(e.prof, "entregar_acta($1, true)", [grupo]);
    await expect(guardar(e.prof, i, [90, 90, 90], 1)).rejects.toThrow(/ya fue entregada/);
    await expect(guardar(e.asis, i, [90, 90, 90], 1)).rejects.toThrow(/motivo/);
    const r = await guardar(e.asis, i, [90, 70, 70], 1, "Error de transcripción del parcial 1");
    expect([res(r).nota_final, res(r).estado]).toEqual([77, "Reprobado"]);
    const a = await e.db.query<{ detalle: string; usuario_id: string }>(
      "select detalle, usuario_id from auditoria where entidad = 'parcial' and tipo_accion = 'Modificación' and valor_nuevo ->> 'inscripcion_id' = $1", [i]);
    expect(a.rows).toEqual([{ detalle: "Error de transcripción del parcial 1", usuario_id: e.asis.id }]);
  });

  test("CE-61 · cada parcial guardado queda en la auditoría con el profesor", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardar(e.prof, i, [80, 81, null], 0);
    const a = await e.db.query<{ n: number }>(
      "select count(*)::int n from auditoria where entidad = 'parcial' and tipo_accion = 'Creación' and usuario_id = $1 and valor_nuevo ->> 'inscripcion_id' = $2",
      [e.prof.id, i]);
    expect(a.rows[0].n).toBe(2);
  });
});

describe("reprogramación (CE-32 a CE-36)", () => {
  test("CE-32, CE-34 · la Asistente autoriza y la nota del profesor sustituye al 0", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardar(e.prof, i, [90, 90, "No presentado"], 0);
    expect((await e.resultado(i)).nota_final).toBe(60);
    const a = await e.llamar(e.asis, "autorizar_reprogramacion($1, 3, 'R-0451')", [i]);
    expect(a.estado).toBe("autorizada");
    const r = await guardar(e.prof, i, JSON.stringify([{ numero: 3, condicion: "Reprogramado", valor: 84 }]), await version(i));
    expect([res(r).nota_final, res(r).estado]).toEqual([88, "Aprobado"]);
    const p = await e.db.query("select recibo_reprogramacion from parcial where inscripcion_id = $1 and numero = 3", [i]);
    expect(p.rows[0]).toEqual({ recibo_reprogramacion: "R-0451" });
  });

  test("solo se reprograma un No presentado", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardar(e.prof, i, [90, null, null], 0);
    await expect(e.llamar(e.asis, "autorizar_reprogramacion($1, 1, null)", [i])).rejects.toThrow(/No presentado/);
  });

  test("CE-33 · después de la fecha de término no se autoriza", async () => {
    const [i] = (await e.grupoCon(1, { inicio: -60, termino: -1 })).inscripciones;
    await e.parciales(i, ["No presentado"]);
    await expect(e.llamar(e.asis, "autorizar_reprogramacion($1, 1, null)", [i])).rejects.toThrow(/ya terminó/);
  });

  test("Q1 · el profesor no autoriza reprogramaciones", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await e.parciales(i, ["No presentado"]);
    await expect(e.llamar(e.prof, "autorizar_reprogramacion($1, 1, null)", [i])).rejects.toThrow(/Solo la Asistente/);
  });
});

describe("inasistencia, retiro, baja y traslado (CE-37 a CE-41)", () => {
  test("CE-37 · el profesor avisa sin cambiar la inscripción", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    const r = await e.llamar(e.prof, "avisar_inasistencia($1, 'No viene desde hace tres semanas')", [i]);
    expect([res(r).aviso_inasistencia, res(r).estado_inscripcion]).toEqual(["No viene desde hace tres semanas", "En curso"]);
    await expect(e.llamar(e.otroProf, "avisar_inasistencia($1, 'Aviso de otro profesor')", [i])).rejects.toThrow(/Solo el profesor/);
  });

  test("CE-39 · baja por inasistencia: lo que falta queda No presentado y el estado es Reprobado", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardar(e.prof, i, [95, null, null], 0);
    await e.llamar(e.prof, "avisar_inasistencia($1, 'Dejó de asistir')", [i]);
    const r = await e.llamar(e.asis, "decidir_salida($1, 'baja', 'Tres semanas sin justificar', false)", [i]);
    expect(res(r).parciales.map((p) => p.condicion)).toEqual(["Registrado", "No presentado", "No presentado"]);
    expect([res(r).estado, res(r).nota_final, res(r).provisional]).toEqual(["Reprobado", 32, false]);
    await expect(guardar(e.prof, i, [95, 95, 95], await version(i))).rejects.toThrow(/baja por inasistencia/);
  });

  test("CE-41, CE-38 · retiro con parciales con nota: primero advierte; confirmado, queda Retirada", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardar(e.prof, i, [88, null, null], 0);
    const a = await e.llamar(e.asis, "decidir_salida($1, 'retiro', 'Enfermedad con constancia', false)", [i]);
    expect(a).toEqual({ estado: "advertir", parciales_con_nota: 1 });
    const r = await e.llamar(e.asis, "decidir_salida($1, 'retiro', 'Enfermedad con constancia', true)", [i]);
    expect([res(r).estado_inscripcion, res(r).estado, res(r).nota_final]).toEqual(["Retirada", null, null]);
  });

  test("CE-40 · traslado con su observación", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    const r = await e.llamar(e.asis, "decidir_salida($1, 'traslado', 'Pasa al grupo sabatino', false)", [i]);
    expect(res(r).estado_inscripcion).toBe("Trasladada");
  });

  test("CE-37 · «continua» descarta el aviso", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await e.llamar(e.prof, "avisar_inasistencia($1, 'Faltó dos semanas')", [i]);
    const r = await e.llamar(e.asis, "decidir_salida($1, 'continua', 'Volvió a clases', false)", [i]);
    expect([res(r).aviso_inasistencia, res(r).estado_inscripcion]).toEqual([null, "En curso"]);
  });

  test("CE-57 · Dirección y el profesor no deciden", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    for (const p of [e.dir, e.prof])
      await expect(e.llamar(p, "decidir_salida($1, 'retiro', 'Motivo cualquiera', true)", [i])).rejects.toThrow(/Solo la Asistente/);
  });
});

describe("Condicionado (CE-29 a CE-31)", () => {
  test("CE-29, CE-30 · se condiciona un 78 y no un 70", async () => {
    const [a, b] = (await e.grupoCon(2)).inscripciones;
    await guardar(e.prof, a, [78, 78, 78], 0);
    await guardar(e.prof, b, [70, 70, 70], 0);
    const r = await e.llamar(e.asis, "condicionar($1, 'Buen desempeño oral')", [a]);
    expect(res(r).estado).toBe("Condicionado");
    await expect(e.llamar(e.asis, "condicionar($1, 'Buen desempeño oral')", [b]))
      .rejects.toMatchObject({ constraint: "condicionado_en_franja" });
  });

  test("CE-31 · al quitarlo vuelve el estado calculado", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardar(e.prof, i, [77, 77, 77], 0);
    await e.llamar(e.asis, "condicionar($1, 'Buen desempeño oral')", [i]);
    const r = await e.llamar(e.asis, "quitar_condicionado($1, 'Asignado por error')", [i]);
    expect(res(r).estado).toBe("Reprobado");
  });

  test("Q3 · una nota provisional no se condiciona; CE-57 · Dirección no condiciona", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardar(e.prof, i, [78, 78, null], 0);
    await expect(e.llamar(e.asis, "condicionar($1, 'Buen desempeño oral')", [i])).rejects.toThrow(/Solo se condiciona/);
    await expect(e.llamar(e.dir, "condicionar($1, 'Buen desempeño oral')", [i])).rejects.toThrow(/Solo la Asistente/);
  });
});

describe("entregar_acta (CE-42 a CE-47)", () => {
  test("CE-43 · con parciales sin condición o un aviso sin decidir, rechaza y lista lo que falta", async () => {
    const { grupo, inscripciones: [a, b] } = await e.grupoCon(2);
    await guardar(e.prof, a, [80, 80, null], 0);
    await guardar(e.prof, b, [80, 80, 80], 0);
    await e.llamar(e.prof, "avisar_inasistencia($1, 'Dejó de venir')", [b]);
    const r = await e.llamar(e.prof, "entregar_acta($1, true)", [grupo]);
    expect(r.estado).toBe("incompleta");
    const faltan = r.faltan as { faltan: number[]; aviso_sin_decidir: boolean }[];
    expect(faltan.map((f) => [f.faltan, f.aviso_sin_decidir]).sort()).toEqual([[[], true], [[3], false]].sort());
  });

  test("CE-44 · sin ninguna calificación no se entrega", async () => {
    const { grupo } = await e.grupoCon(0);
    expect((await e.llamar(e.prof, "entregar_acta($1, false)", [grupo])).estado).toBe("sin_calificaciones");
  });

  test("CE-42, CE-45 · sin confirmar muestra el resumen; confirmada, Entregada y Completada", async () => {
    const { grupo, inscripciones: [a, b, c] } = await e.grupoCon(3);
    await guardar(e.prof, a, [90, 90, 90], 0);
    await guardar(e.prof, b, [60, 60, 60], 0);
    await e.llamar(e.asis, "decidir_salida($1, 'traslado', 'Pasa a otro horario', false)", [c]);
    const v = await e.llamar(e.prof, "entregar_acta($1, false)", [grupo]);
    expect(v.estado).toBe("resumen");
    expect(v.resumen).toMatchObject({ inscritos: 3, aprobados: 1, reprobados: 1, trasladados: 1, pendientes: 0, promedio: 75 });
    const r = await e.llamar(e.prof, "entregar_acta($1, true)", [grupo]);
    expect(r.estado).toBe("entregada");
    const g = await e.db.query<{ estado_acta: string; fecha_entrega_acta: Date | null }>(
      "select estado_acta, fecha_entrega_acta from grupo where id = $1", [grupo]);
    expect(g.rows[0].estado_acta).toBe("Entregada");
    expect(g.rows[0].fecha_entrega_acta).not.toBeNull();
    const i = await e.db.query<{ estado_inscripcion: string }>("select estado_inscripcion from inscripcion where grupo_id = $1 order by 1", [grupo]);
    expect(i.rows.map((x) => x.estado_inscripcion)).toEqual(["Completada", "Completada", "Trasladada"]);
    await expect(e.llamar(e.prof, "entregar_acta($1, true)", [grupo])).rejects.toThrow(/ya fue entregada/);
  });

  test("solo el profesor del grupo entrega", async () => {
    const { grupo, inscripciones: [a] } = await e.grupoCon(1);
    await guardar(e.prof, a, [90, 90, 90], 0);
    for (const p of [e.otroProf, e.asis, e.dir])
      await expect(e.llamar(p, "entregar_acta($1, true)", [grupo])).rejects.toThrow(/Solo el profesor del grupo/);
  });
});

describe("anular_inscripcion con la 002 (001·CE-60)", () => {
  test("con parciales no se anula; con solo un aviso, sí", async () => {
    const [a, b] = (await e.grupoCon(2)).inscripciones;
    await guardar(e.prof, a, [80, null, null], 0);
    await expect(comoUsuario(e.db, e.asis, (tx) => tx.query("select anular_inscripcion($1, 'Inscrita por error')", [a])))
      .rejects.toThrow(/ya tiene parciales/);
    await e.llamar(e.prof, "avisar_inasistencia($1, 'Nunca asistió')", [b]);
    await comoUsuario(e.db, e.asis, (tx) => tx.query("select anular_inscripcion($1, 'Inscrita por error')", [b]));
    expect((await e.db.query("select 1 from inscripcion where id = $1", [b])).rows).toHaveLength(0);
  });
});

describe("inscribir con antecedentes (CE-54 a CE-56)", () => {
  /** Un resultado ya entregado del estudiante en un nivel, `meses` atrás. */
  async function historia(est: string, nivel: string, valores: number[], meses: number, condicionar = false) {
    const g = await e.grupo({ nivel, inicio: -2, termino: 30 });
    const i = await e.inscribir(est, g);
    await e.db.query("update grupo set fecha_inicio = current_date - $2::int * 30, fecha_termino = current_date - $2::int * 30 + 60 where id = $1",
      [g, meses]);
    await e.parciales(i, valores);
    if (condicionar)
      await e.db.query("insert into calificacion (organizacion_id, inscripcion_id, condicionado, justificacion_condicionado) values ($1,$2,true,'Decisión de prueba')", [e.org, i]);
    await e.db.query("update inscripcion set estado_inscripcion = 'Completada' where id = $1", [i]);
    await e.db.query("update grupo set estado_acta = 'Entregada', fecha_entrega_acta = now() where id = $1", [g]);
  }
  const inscribirSinMotivo = (est: string, g: string) => e.llamar(e.asis, "inscribir($1, $2, true)", [est, g]);

  test("CE-54 · un reprobado en el nivel 6 que se inscribe en el 7: advierte y pide motivo", async () => {
    const est = await e.estudiante();
    await historia(est, n6, [70, 70, 70], 6);
    const g7 = await e.grupo({ nivel: n7 });
    const r = await inscribirSinMotivo(est, g7);
    expect(r.estado).toBe("antecedente");
    expect((r.antecedentes as { tipo: string }[]).map((a) => a.tipo)).toEqual(["reprobado"]);
    const ok = await e.llamar(e.asis, "inscribir($1, $2, true, 'Decisión de Doña Aura')", [est, g7]);
    expect(ok.estado).toBe("inscrito");
    const a = await e.db.query<{ detalle: string }>("select detalle from auditoria where entidad = 'inscripcion' and registro_afectado = $1", [ok.id]);
    expect(a.rows[0].detalle).toMatch(/Inscrito pese a antecedente: Decisión de Doña Aura/);
  });

  test("CE-54 · repetir el nivel reprobado no advierte", async () => {
    const est = await e.estudiante();
    await historia(est, n6, [70, 70, 70], 6);
    expect((await inscribirSinMotivo(est, await e.grupo({ nivel: n6 }))).estado).toBe("inscrito");
  });

  test("CE-55 · Condicionado en el 6 que no sacó 80 en el 7: advierte del 6 en adelante, no en el 5", async () => {
    const est = await e.estudiante();
    await historia(est, n6, [78, 78, 78], 9, true);
    await historia(est, n7, [82, 76, 76], 6);   // 78: no alcanza el 80 exigido
    const tipos = async (nivel: string) => {
      const r = await inscribirSinMotivo(est, await e.grupo({ nivel }));
      return r.estado === "antecedente" ? (r.antecedentes as { tipo: string }[]).map((a) => a.tipo).sort() : [];
    };
    expect(await tipos(n8)).toEqual(["condicion_no_cumplida", "reprobado"]);
    expect(await tipos(n6)).toEqual(["condicion_no_cumplida"]);
    expect(await tipos(n5)).toEqual([]);
  });

  test("CE-56 · sin antecedentes no cambia nada; el sistema nunca mueve de nivel", async () => {
    const est = await e.estudiante();
    await historia(est, n6, [90, 90, 90], 6);
    expect((await inscribirSinMotivo(est, await e.grupo({ nivel: n7 }))).estado).toBe("inscrito");
  });
});

describe("respuestas que no dicen de más (T14)", () => {
  test("una condición inventada se rechaza con un mensaje propio, sin devolver la fila", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    const err = await guardar(e.prof, i, JSON.stringify([{ numero: 1, condicion: "Aprobado por mí" }]), 0).catch((x) => x as { message: string; detail?: string });
    expect(err).toMatchObject({ message: "La condición del parcial 1 no es válida." });
    expect(String((err as { detail?: string }).detail ?? "")).not.toMatch(/Failing row/);
  });
});
