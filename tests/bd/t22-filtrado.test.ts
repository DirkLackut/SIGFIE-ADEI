/**
 * T22 — 014_consulta_y_reportes.sql, parte 3: filtrado con verificación de
 * completitud. CE-1 a CE-19, CE-21, CE-24, CE-25, CE-28.
 * Datos inventados (constitución, principio 3).
 *
 * Cada prueba trabaja con su propio profesor (o su propia sucursal) y filtra por
 * él, para no depender de lo que crearon las demás.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { crearBanco } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa, type Resp } from "../apoyo/acta";
import { crearProfesor, diasDesdeHoy } from "../apoyo/escenario";

let e: EscenarioActa;
let otra: EscenarioActa;
let sabatino = "", sabatinoManana = "", sabatinoTarde = "", diarioOtro = "", sucursal2 = "";
let n6 = "", n7 = "", ninos1 = "";
let consecutivoProf = 0;

beforeAll(async () => {
  const { db } = await crearBanco();
  e = await crearEscenarioActa(db);
  otra = await crearEscenarioActa(db, "OTRA");
  const id = async (sql: string, args: unknown[]) => (await db.query<{ id: string }>(`${sql} returning id`, args)).rows[0].id;
  sabatino = await id("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1, 'Sabatino', 'Sábado')", [e.org]);
  sabatinoManana = await id("insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1, $2, '07:30', '11:00')", [e.org, sabatino]);
  sabatinoTarde = await id("insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1, $2, '14:00', '17:00')", [e.org, sabatino]);
  diarioOtro = await id("insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1, $2, '18:00', '19:30')", [e.org, e.cat.modalidad]);
  sucursal2 = await id("insert into sucursal (organizacion_id, nombre, direccion, es_central) values ($1, 'Las Colinas', 'Managua', false)", [e.org]);
  n6 = await e.nivel(6); n7 = await e.nivel(7); ninos1 = await e.nivel(1, "Curso de niños");
  await e.regla("Curso principal", 6, 13, 80, [77, 80]);
});

/** Un profesor nuevo: lo que se crea con él solo lo encuentra un filtro por él. */
const letra = (n: number) => String.fromCharCode(97 + (n % 26));
const profesorNuevo = () => { const n = consecutivoProf++; return crearProfesor(e.db, e.org, "Prueba", `Filtro ${letra(n)}${letra(Math.floor(n / 26))}`); };

async function grupo(o: { profesor: string; nivel?: string; modalidad?: string; horario?: string; sucursal?: string; inicio?: number; termino?: number }) {
  const r = await e.llamar(e.asis, "abrir_grupo($1)", [JSON.stringify({
    nivel_id: o.nivel ?? n6, modalidad_id: o.modalidad ?? e.cat.modalidad, horario_id: o.horario ?? e.cat.horario,
    profesor_id: o.profesor, sucursal_id: o.sucursal ?? e.cat.sucursal,
    fecha_inicio: diasDesdeHoy(o.inicio ?? -10), fecha_termino: diasDesdeHoy(o.termino ?? 30) })]);
  if (r.estado !== "abierto") throw new Error(JSON.stringify(r));
  return r.id as string;
}
async function inscritos(g: string, n: number) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push(await e.inscribir(await e.estudiante(), g));
  return ids;
}
const filtrar = (criterios: Record<string, unknown>, vista = "inscripciones", pagina = 1, destino = "pantalla", quien = e.asis) =>
  e.llamar(quien, "filtrar($1, $2, $3, $4)", [JSON.stringify(criterios), vista, pagina, destino]);
type Fila = Record<string, unknown>;
const filas = (r: Resp) => r.filas as Fila[];
const estudianteDe = async (i: string) =>
  (await e.db.query<{ estudiante_id: string }>("select estudiante_id from inscripcion where id = $1", [i])).rows[0].estudiante_id;

describe("criterios (CE-1, CE-6 a CE-9)", () => {
  test("CE-1 · filtra por cada criterio de catálogo", async () => {
    const p = await profesorNuevo();
    const gA = await grupo({ profesor: p, modalidad: sabatino, horario: sabatinoManana, sucursal: sucursal2, nivel: n7 });
    const gB = await grupo({ profesor: p });
    await inscritos(gA, 2); await inscritos(gB, 3);
    expect((await filtrar({ profesor_id: p })).total).toBe(5);
    expect((await filtrar({ profesor_id: p, modalidad_id: sabatino })).total).toBe(2);
    expect((await filtrar({ profesor_id: p, modalidad_id: sabatino, horario_id: sabatinoManana })).total).toBe(2);
    expect((await filtrar({ profesor_id: p, sucursal_id: sucursal2 })).total).toBe(2);
    expect((await filtrar({ profesor_id: p, programa: "Curso principal", nivel_id: n7 })).total).toBe(2);
    expect((await filtrar({ profesor_id: p, estado_inscripcion: "En curso" })).total).toBe(5);
    expect((await filtrar({ profesor_id: p, estado_matricula: "Activo" })).total).toBe(5);
  });

  test("CE-1, CE-16 · filtra por estado académico con el mismo cálculo del acta", async () => {
    const p = await profesorNuevo();
    const g = await grupo({ profesor: p });
    const [a, b, c] = await inscritos(g, 3);
    await e.parciales(a, [90, 90, 90]);   // Aprobado
    await e.parciales(b, [70, 70, 70]);   // Reprobado
    await e.parciales(c, [90]);           // Pendiente (provisional)
    const de = async (estado: string) => filas(await filtrar({ profesor_id: p, estado_academico: estado })).map((f) => f.id);
    expect(await de("Aprobado")).toEqual([a]);
    expect(await de("Reprobado")).toEqual([b]);
    expect(await de("Pendiente")).toEqual([c]);
    for (const f of filas(await filtrar({ profesor_id: p }))) {
      expect(f.estado_academico).toBe((await e.resultado(f.id as string)).estado);
    }
  });

  test("CE-6 · un horario de otra modalidad se rechaza indicando el criterio", async () => {
    const r = await filtrar({ modalidad_id: sabatino, horario_id: diarioOtro });
    expect(r).toMatchObject({ estado: "criterios_invalidos", campo: "horario_id" });
    expect(r.mensaje).toMatch(/no pertenece a la modalidad/);
  });

  test("CE-8 · un nivel de otro programa se rechaza", async () => {
    expect(await filtrar({ programa: "Curso principal", nivel_id: ninos1 })).toMatchObject({ estado: "criterios_invalidos", campo: "nivel_id" });
  });

  test("CE-7 · rango invertido, fecha inexistente o año raro se rechazan", async () => {
    expect(await filtrar({ desde: "2026-10-31", hasta: "2026-10-01" })).toMatchObject({ estado: "criterios_invalidos", campo: "hasta" });
    expect(await filtrar({ desde: "2026-02-30" })).toMatchObject({ estado: "criterios_invalidos", campo: "desde" });
    expect(await filtrar({ hasta: "202026-01-01" })).toMatchObject({ estado: "criterios_invalidos", campo: "hasta" });
  });

  test("CE-1 · valores fuera de las listas cerradas, criterios desconocidos y catálogos ajenos se rechazan", async () => {
    expect(await filtrar({ estado_academico: "Excelente" })).toMatchObject({ estado: "criterios_invalidos", campo: "estado_academico" });
    expect(await filtrar({ estado_matricula: "Suspendido" })).toMatchObject({ estado: "criterios_invalidos", campo: "estado_matricula" });
    expect(await filtrar({ texto_libre: "x" })).toMatchObject({ estado: "criterios_invalidos", campo: "texto_libre" });
    expect(await filtrar({ sucursal_id: otra.cat.sucursal })).toMatchObject({ estado: "criterios_invalidos", campo: "sucursal_id" });
    expect(await filtrar({ profesor_id: "no-es-un-id" })).toMatchObject({ estado: "criterios_invalidos", campo: "profesor_id" });
    expect(await filtrar({}, "otra_vista")).toMatchObject({ estado: "criterios_invalidos", campo: "vista" });
  });

  test("CE-9 · sin criterios devuelve todos los registros con su total", async () => {
    const total = (await e.db.query<{ n: number }>("select count(*)::int n from inscripcion where organizacion_id = $1", [e.org])).rows[0].n;
    expect((await filtrar({})).total).toBe(total);
    const est = (await e.db.query<{ n: number }>("select count(*)::int n from estudiante where organizacion_id = $1", [e.org])).rows[0].n;
    expect((await filtrar({}, "estudiantes")).total).toBe(est);
  });
});

describe("rango de fechas (CE-5)", () => {
  test("CE-5 · entran los grupos en curso algún día del rango, con extremos abiertos", async () => {
    const p = await profesorNuevo();
    const antes = await grupo({ profesor: p, inicio: -60, termino: 5 });   // termina dentro del rango
    const dentro = await grupo({ profesor: p, inicio: 10, termino: 40 });  // empieza dentro
    const despues = await grupo({ profesor: p, inicio: 50, termino: 80 }); // fuera
    for (const g of [antes, dentro, despues]) await inscritos(g, 1);
    const grupos = async (c: Record<string, unknown>) =>
      filas(await filtrar({ profesor_id: p, ...c })).map((f) => f.grupo_id).sort();
    expect(await grupos({ desde: diasDesdeHoy(5), hasta: diasDesdeHoy(20) })).toEqual([antes, dentro].sort());
    expect(await grupos({ desde: diasDesdeHoy(45) })).toEqual([despues]);
    expect(await grupos({ hasta: diasDesdeHoy(0) })).toEqual([antes]);
  });
});

describe("vistas (CE-2 a CE-4, CE-14, CE-15)", () => {
  test("CE-2, CE-15 · Estudiantes: un renglón por persona con cuántas inscripciones cumplen", async () => {
    const p = await profesorNuevo();
    const g1 = await grupo({ profesor: p, nivel: n6, inicio: -60, termino: 1 });
    const g2 = await grupo({ profesor: p, nivel: n7, inicio: 2, termino: 40 });
    const est = await e.estudiante();
    await e.inscribir(est, g1); await e.inscribir(est, g2);
    expect((await filtrar({ profesor_id: p })).total).toBe(2);
    const r = await filtrar({ profesor_id: p }, "estudiantes");
    expect(r.total).toBe(1);
    expect(filas(r)[0]).toMatchObject({ id: est, inscripciones: 2, ultimo_nivel: "Curso principal 7" });
    for (const k of ["codigo_adei", "apellidos", "nombres", "cedula", "sucursal", "estado_matricula"]) expect(filas(r)[0]).toHaveProperty(k);
  });

  test("CE-3 · sin criterios de inscripción, entran también los estudiantes sin inscripciones", async () => {
    const solo = await e.estudiante();
    const ids = filas(await filtrar({ estado_matricula: "Activo" }, "estudiantes", 1, "exportar")).map((f) => f.id);
    expect(ids).toContain(solo);
    const p = await profesorNuevo();
    await inscritos(await grupo({ profesor: p }), 1);
    const conCriterio = filas(await filtrar({ profesor_id: p }, "estudiantes")).map((f) => f.id);
    expect(conCriterio).not.toContain(solo);
  });

  test("CE-4 · la sucursal es la del grupo en Inscripciones y la del estudiante en Estudiantes", async () => {
    const p = await profesorNuevo();
    const g = await grupo({ profesor: p, sucursal: sucursal2 });   // los estudiantes son de la sucursal central
    await inscritos(g, 2);
    expect((await filtrar({ profesor_id: p, sucursal_id: sucursal2 })).total).toBe(2);
    expect((await filtrar({ profesor_id: p, sucursal_id: sucursal2 }, "estudiantes")).total).toBe(0);
    expect((await filtrar({ profesor_id: p, sucursal_id: e.cat.sucursal }, "estudiantes")).total).toBe(2);
  });

  test("CE-14 · columnas de la vista Inscripciones", async () => {
    const p = await profesorNuevo();
    const [i] = await inscritos(await grupo({ profesor: p }), 1);
    await e.parciales(i, [70, 70, 70]);
    const f = filas(await filtrar({ profesor_id: p }))[0];
    for (const k of ["codigo_adei", "apellidos", "nombres", "sucursal", "codigo_grupo", "programa", "nivel", "modalidad",
      "hora_inicio", "hora_fin", "profesor", "fecha_inicio", "fecha_termino", "estado_inscripcion", "nota_final",
      "estado_academico", "provisional"]) expect(f).toHaveProperty(k);
    expect([f.nota_final, f.estado_academico, f.provisional]).toEqual([70, "Reprobado", false]);
  });
});

describe("completitud y páginas (CE-10 a CE-13, CE-19)", () => {
  let p = "";
  beforeAll(async () => {
    p = await profesorNuevo();
    await inscritos(await grupo({ profesor: p }), 53);
  });

  test("CE-10, CE-12 · el total real y todas las páginas, de 50 en 50", async () => {
    const p1 = await filtrar({ profesor_id: p }, "inscripciones", 1);
    const p2 = await filtrar({ profesor_id: p }, "inscripciones", 2);
    expect([p1.estado, p1.total, filas(p1).length, p1.por_pagina]).toEqual(["ok", 53, 50, 50]);
    expect([p2.total, filas(p2).length]).toEqual([53, 3]);
    const todos = [...filas(p1), ...filas(p2)].map((f) => f.id);
    expect(new Set(todos).size).toBe(53);
  });

  test("CE-12 · una página que no existe da el total real y ninguna fila", async () => {
    const r = await filtrar({ profesor_id: p }, "inscripciones", 40);
    expect([r.estado, r.total, filas(r).length]).toEqual(["ok", 53, 0]);
  });

  test("CE-24 · exportar o imprimir trae todas las filas, no solo una página", async () => {
    for (const destino of ["exportar", "imprimir"]) {
      const r = await filtrar({ profesor_id: p }, "inscripciones", 1, destino);
      expect([r.total, filas(r).length]).toEqual([53, 53]);
    }
  });

  test("CE-19 · orden por apellidos y nombres sin tildes, y por inicio del grupo", async () => {
    const r = await filtrar({ profesor_id: p }, "inscripciones", 1, "exportar");
    const claves = filas(r).map((f) => `${f.apellidos}\u0001${f.nombres}`.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase());
    expect(claves).toEqual([...claves].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
  });

  test("CE-13 · sin coincidencias: total 0 y lista vacía, con estado ok", async () => {
    const vacio = await profesorNuevo();
    const r = await filtrar({ profesor_id: vacio });
    expect([r.estado, r.total, filas(r)]).toEqual(["ok", 0, []]);
  });

  test("CE-11, CE-25 · si lo obtenido no cuadra con el total, no hay filas y queda un incidente", async () => {
    await e.db.exec("create or replace function interno.desfase_completitud() returns int language sql volatile as $$ select 1 $$");
    try {
      for (const destino of ["pantalla", "exportar"]) {
        const r = await filtrar({ profesor_id: p }, "inscripciones", 1, destino);
        expect(r.estado).toBe("incompleto");
        expect(r).not.toHaveProperty("filas");
      }
      const a = await e.db.query<{ detalle: string }>(
        "select detalle from auditoria where tipo_accion = 'Incidente' and entidad = 'filtrado' and usuario_id = $1", [e.asis.id]);
      expect(a.rows.length).toBe(2);
      expect(a.rows[0].detalle).toMatch(/esperados/);
    } finally {
      await e.db.exec("create or replace function interno.desfase_completitud() returns int language sql volatile as $$ select 0 $$");
    }
  });
});

describe("bitácora y permisos (CE-17, CE-18, CE-28, CE-95)", () => {
  test("CE-17, CE-28 · cada filtrado deja criterios, vista, destino y total", async () => {
    const p = await profesorNuevo();
    await inscritos(await grupo({ profesor: p }), 2);
    await filtrar({ profesor_id: p }, "estudiantes", 1, "imprimir");
    const a = await e.db.query<{ detalle: string; registro_afectado: string }>(
      "select detalle, registro_afectado from auditoria where tipo_accion = 'Consulta' and entidad = 'filtrado' and usuario_id = $1 order by id desc limit 1",
      [e.asis.id]);
    const d = JSON.parse(a.rows[0].detalle);
    expect(a.rows[0].registro_afectado).toBe("estudiantes");
    expect(d).toMatchObject({ criterios: { profesor_id: p }, destino: "imprimir", total: 2 });
  });

  test("CE-18 · el profesor no filtra: se le niega y queda registrado", async () => {
    expect(await filtrar({}, "inscripciones", 1, "pantalla", e.prof)).toEqual({ estado: "denegado" });
    const a = await e.db.query("select 1 from auditoria where tipo_accion = 'Denegación' and entidad = 'filtrado' and usuario_id = $1", [e.prof.id]);
    expect(a.rows.length).toBeGreaterThan(0);
  });

  test("CE-1 · Dirección filtra igual que la Asistente", async () => {
    const p = await profesorNuevo();
    await inscritos(await grupo({ profesor: p }), 2);
    expect((await filtrar({ profesor_id: p }, "inscripciones", 1, "pantalla", e.dir)).total).toBe(2);
  });

  test("CE-95 · nunca devuelve datos de otra organización", async () => {
    await otra.grupoCon(2);
    const mias = new Set((await e.db.query<{ id: string }>("select id from inscripcion where organizacion_id = $1", [e.org])).rows.map((r) => r.id));
    const todas = filas(await filtrar({}, "inscripciones", 1, "exportar"));
    expect(todas.every((f) => mias.has(f.id as string))).toBe(true);
    const deOtra = await otra.llamar(otra.asis, "filtrar($1, 'inscripciones', 1, 'exportar')", ["{}"]);
    expect((deOtra.filas as Fila[]).some((f) => mias.has(f.id as string))).toBe(false);
  });
});

describe("CE-21 · conteos por modalidad (CA-05, CA-06)", () => {
  test("filtrar por cada modalidad da exactamente sus inscripciones, y la suma es el total", async () => {
    const p = await profesorNuevo();
    await inscritos(await grupo({ profesor: p, modalidad: sabatino, horario: sabatinoTarde }), 4);
    await inscritos(await grupo({ profesor: p }), 6);
    const sab = (await filtrar({ profesor_id: p, modalidad_id: sabatino })).total as number;
    const dia = (await filtrar({ profesor_id: p, modalidad_id: e.cat.modalidad })).total as number;
    expect([sab, dia]).toEqual([4, 6]);
    expect((await filtrar({ profesor_id: p })).total).toBe(sab + dia);
    const est = await estudianteDe(filas(await filtrar({ profesor_id: p, modalidad_id: sabatino }))[0].id as string);
    expect(est).toBeTruthy();
  });
});
