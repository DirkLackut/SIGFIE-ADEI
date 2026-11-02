/**
 * T19 — 012_captura_academica.sql, parte 2: tablas parcial y calificacion y la
 * vista resultado_academico. Los parciales se escriben aquí como superusuario
 * para probar solo el cálculo; las operaciones se prueban en t20.
 * CE-7 a CE-10, CE-14 a CE-23, CE-29, CE-38 a CE-40, CE-59.
 *
 * Los vectores del cálculo son los mismos de tests/dominio/notas.test.ts (D25).
 */
import { describe, test, expect, beforeAll } from "vitest";
import { crearBanco, comoUsuario } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa } from "../apoyo/acta";
import { VECTORES_DE_NOTAS } from "../apoyo/vectores-notas";

let e: EscenarioActa;
let intermedio = "", principiante = "";

beforeAll(async () => {
  const { db } = await crearBanco();
  e = await crearEscenarioActa(db);
  intermedio = await e.nivel(6);
  principiante = await e.nivel(1);
  await e.nivel(1, "Conversation");
  await e.regla("Curso principal", 1, 5, 75, [72, 75]);
  await e.regla("Curso principal", 6, 13, 80, [77, 80]);
  await e.regla("Curso principal", 1, 16, 75, [72, 75], "2015-01-01", true);   // antes de 2023
});

const nuevo = async (nivel = intermedio, inicio = -10) => (await e.grupoCon(1, { nivel, inicio })).inscripciones[0];

describe("tabla parcial (CE-7 a CE-10)", () => {
  test("CE-8 · el valor es un entero de 0 a 100", async () => {
    const i = await nuevo();
    await expect(e.parciales(i, [101])).rejects.toThrow(/parcial_valor_rango/);
    await expect(e.parciales(i, [-1])).rejects.toThrow(/parcial_valor_rango/);
  });

  test("CE-9, CE-10 · Registrado lleva valor; No presentado y Justificado no", async () => {
    const i = await nuevo();
    const sql = "insert into parcial (organizacion_id, inscripcion_id, numero, condicion, valor) values ($1,$2,1,$3,$4)";
    await expect(e.db.query(sql, [e.org, i, "Registrado", null])).rejects.toThrow(/parcial_valor_segun_condicion/);
    await expect(e.db.query(sql, [e.org, i, "Justificado", 50])).rejects.toThrow(/parcial_valor_segun_condicion/);
  });

  test("CE-35 · Reprogramado exige la autorización", async () => {
    const i = await nuevo();
    await expect(e.db.query(
      "insert into parcial (organizacion_id, inscripcion_id, numero, condicion, valor) values ($1,$2,1,'Reprogramado',90)", [e.org, i]))
      .rejects.toThrow(/parcial_reprogramado_autorizado/);
  });

  test("un número de parcial por inscripción, y solo del 1 al 3", async () => {
    const i = await nuevo();
    await e.parciales(i, [80]);
    await expect(e.parciales(i, [70])).rejects.toThrow(/parcial_unico/);
    await expect(e.db.query(
      "insert into parcial (organizacion_id, inscripcion_id, numero, condicion, valor) values ($1,$2,4,'Registrado',90)", [e.org, i]))
      .rejects.toThrow(/check/);
  });

  test("001·CE-60 · una inscripción con parciales no se borra (sin cascada)", async () => {
    const i = await nuevo();
    await e.parciales(i, [80]);
    await expect(e.db.query("delete from inscripcion where id = $1", [i])).rejects.toThrow(/foreign key/);
  });
});

describe("cálculo de la nota (CE-14 a CE-18), con los vectores compartidos", () => {
  for (const v of VECTORES_DE_NOTAS) {
    test(`${v.caso}`, async () => {
      const i = await nuevo();
      await e.parciales(i, v.parciales);
      const r = await e.resultado(i);
      expect(r.nota_exacta === null ? null : Number(r.nota_exacta)).toBe(v.exacta);
      expect(r.nota_final).toBe(v.final);
      expect(r.provisional).toBe(v.provisional);
      expect(r.requiere_retiro).toBe(v.requiereRetiro);
      expect(r.estado).toBe(v.estadoCon80);
      expect(r.faltan).toEqual(v.faltan);
      expect(r.en_franja).toBe(v.enFranja);
    });
  }
});

describe("estado académico (CE-19 a CE-23)", () => {
  test("CE-19, CE-20 · el mismo 76 aprueba en el nivel 1 (75) y reprueba en el 6 (80)", async () => {
    const a = await nuevo(principiante), b = await nuevo(intermedio);
    await e.parciales(a, [76, 76, 76]);
    await e.parciales(b, [76, 76, 76]);
    expect((await e.resultado(a)).estado).toBe("Aprobado");
    expect((await e.resultado(b)).estado).toBe("Reprobado");
  });

  test("CE-20 · un grupo que inició antes de 2023 usa la regla de entonces (75)", async () => {
    const g = await e.grupo({ nivel: intermedio });
    await e.db.query("update grupo set fecha_inicio = '2021-03-01' where id = $1", [g]);
    const i = await e.inscribir(await e.estudiante(), g);
    await e.parciales(i, [76, 76, 76]);
    expect((await e.resultado(i)).estado).toBe("Aprobado");
  });

  test("CE-23 · un programa sin regla queda Pendiente y señalado", async () => {
    const i = await nuevo(await e.nivel(1, "Conversation"));
    await e.parciales(i, [90, 90, 90]);
    const r = await e.resultado(i);
    expect([r.estado, r.sin_regla, r.nota_final]).toEqual(["Pendiente", true, 90]);
  });
});

describe("Condicionado, retiro, baja y traslado (CE-29, CE-30, CE-38 a CE-40)", () => {
  test("CE-30 · la vista dice si la nota final cae en la franja", async () => {
    const dentro = await nuevo(), fuera = await nuevo(), arriba = await nuevo();
    await e.parciales(dentro, [78, 78, 78]);
    await e.parciales(fuera, [76, 76, 76]);
    await e.parciales(arriba, [80, 80, 80]);
    expect((await e.resultado(dentro)).en_franja).toBe(true);
    expect((await e.resultado(fuera)).en_franja).toBe(false);
    expect((await e.resultado(arriba)).en_franja).toBe(false);
  });

  test("CE-29 · una inscripción condicionada muestra Condicionado", async () => {
    const i = await nuevo();
    await e.parciales(i, [78, 78, 78]);
    await e.db.query(
      "insert into calificacion (organizacion_id, inscripcion_id, condicionado, justificacion_condicionado) values ($1,$2,true,'Buen avance en clase')", [e.org, i]);
    expect((await e.resultado(i)).estado).toBe("Condicionado");
  });

  test("el Condicionado exige su justificación", async () => {
    const i = await nuevo();
    await expect(e.db.query(
      "insert into calificacion (organizacion_id, inscripcion_id, condicionado) values ($1,$2,true)", [e.org, i]))
      .rejects.toThrow(/calificacion_justificacion/);
  });

  test("CE-38, CE-40 · Retirada y Trasladada no tienen nota ni estado", async () => {
    for (const estado of ["Retirada", "Trasladada"]) {
      const i = await nuevo();
      await e.parciales(i, [90, 90]);
      await e.db.query("update inscripcion set estado_inscripcion = $2, observaciones = 'Decisión de prueba' where id = $1", [i, estado]);
      const r = await e.resultado(i);
      expect([r.nota_final, r.estado]).toEqual([null, null]);
    }
  });

  test("CE-39 · la baja por inasistencia es Reprobado aunque la nota alcance", async () => {
    const i = await nuevo();
    await e.parciales(i, [95, 95, "No presentado"]);
    await e.db.query("insert into calificacion (organizacion_id, inscripcion_id, baja_inasistencia) values ($1,$2,true)", [e.org, i]);
    expect((await e.resultado(i)).estado).toBe("Reprobado");
  });
});

describe("quién lee (CE-58, CE-59)", () => {
  let mia = "", ajena = "";
  beforeAll(async () => {
    mia = await nuevo();
    await e.parciales(mia, [85]);
    const g = await e.grupo({ nivel: intermedio, profesor: e.otroProf.profesorId! });
    ajena = await e.inscribir(await e.estudiante(), g);
    await e.parciales(ajena, [70]);
  });
  const cuantas = (p: typeof e.prof, tabla: string, ids: string[]) => comoUsuario(e.db, p, async (tx) =>
    (await tx.query<{ n: number }>(`select count(*)::int n from ${tabla} where inscripcion_id = any($1)`, [ids])).rows[0].n);

  test("el profesor ve los parciales y el resultado solo de sus grupos", async () => {
    for (const t of ["parcial", "resultado_academico"]) {
      expect(await cuantas(e.prof, t, [mia])).toBe(1);
      expect(await cuantas(e.prof, t, [ajena])).toBe(0);
    }
  });

  test("CE-58 · Asistente y Dirección ven todo", async () => {
    for (const p of [e.asis, e.dir]) expect(await cuantas(p, "parcial", [mia, ajena])).toBe(2);
  });

  test("CE-59 · otra organización no ve nada", async () => {
    const otra = await crearEscenarioActa(e.db, "OTRA");
    for (const t of ["parcial", "calificacion", "resultado_academico"])
      expect(await cuantas(otra.asis, t, [mia, ajena])).toBe(0);
  });

  test("D26 · nadie escribe directo en parcial ni en calificacion", async () => {
    await expect(comoUsuario(e.db, e.prof, (tx) => tx.query(
      "insert into parcial (inscripcion_id, numero, condicion, valor) values ($1, 2, 'Registrado', 100)", [mia])))
      .rejects.toThrow(/permission denied/);
    await expect(comoUsuario(e.db, e.asis, (tx) => tx.query("update calificacion set condicionado = true")))
      .rejects.toThrow(/permission denied/);
  });
});
