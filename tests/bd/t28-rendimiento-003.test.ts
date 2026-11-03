/**
 * T28 — rendimiento del filtrado con 20,000 estudiantes y 20,000 inscripciones
 * (CE-20, RNF-01, RNF-07) y conteos por modalidad conocidos de antemano (CE-21,
 * CA-05, CA-06). Datos inventados (principio 3), sobre el catálogo real de la
 * semilla (009 y 013).
 */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco, comoUsuario } from "../apoyo/banco";
import { cargarEstudiantesSinteticos } from "../apoyo/sinteticos";
import { crearPersona, type Persona } from "../apoyo/escenario";
import { hojasRespaldo, hojaListado, type RespaldoArchivo, type FilaInscripcion } from "@/dominio/exportacion";
import { generarXlsx } from "@/dominio/xlsx";

const ESTUDIANTES = 20_000;
const POR_GRUPO = 10;
const GRUPOS = ESTUDIANTES / POR_GRUPO;

let db: PGlite;
let asis: Persona;
const modalidades: { id: string; nombre: string }[] = [];
const esperado = new Map<string, number>();

type R = { estado: string; total: number; filas?: unknown[] };
const filtrar = (criterios: Record<string, unknown>, vista = "inscripciones", destino = "pantalla") =>
  comoUsuario(db, asis, async (tx) =>
    (await tx.query<{ r: R }>("select filtrar($1, $2, 1, $3) r", [JSON.stringify(criterios), vista, destino])).rows[0].r);
async function medir<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const r = await fn();
  return [r, performance.now() - t0];
}

beforeAll(async () => {
  ({ db } = await crearBanco(undefined, { semilla: true }));
  const org = (await db.query<{ id: string }>("select id from organizacion")).rows[0].id;
  const suc = (await db.query<{ id: string }>("select id from sucursal order by nombre")).rows.map((r) => r.id);
  await cargarEstudiantesSinteticos(db, org, suc, ESTUDIANTES);
  asis = await crearPersona(db, org, ["asistente"]);
  modalidades.push(...(await db.query<{ id: string; nombre: string }>("select id, nombre from modalidad order by nombre")).rows);

  await db.exec("alter table profesor disable trigger auditar; alter table grupo disable trigger auditar;");
  await db.exec("alter table inscripcion disable trigger auditar; alter table parcial disable trigger auditar;");
  try {
    await db.query(
      `insert into profesor (organizacion_id, nombres, apellidos, telefono)
       select $1, 'Profesor', 'Sintético ' || chr(64 + i), '88887777' from generate_series(1, 17) i`, [org]);
    // Grupo g: modalidad g % 4, uno de sus horarios, nivel 1–16 del Curso principal, profesor g % 17,
    // inicios repartidos en dos años.
    await db.query(
      `with m as (select id, row_number() over (order by nombre) - 1 as k from modalidad),
            h as (select id, modalidad_id, row_number() over (partition by modalidad_id order by hora_inicio) - 1 as k,
                         count(*) over (partition by modalidad_id) as n from horario),
            n as (select id, orden from nivel where programa = 'Curso principal'),
            p as (select id, row_number() over (order by apellidos) - 1 as k from profesor),
            s as (select id, row_number() over (order by nombre) - 1 as k, count(*) over () as n from sucursal)
       insert into grupo (organizacion_id, codigo_grupo, nivel_id, horario_id, profesor_id, sucursal_id, fecha_inicio, fecha_termino,
                          estado_acta, fecha_entrega_acta)
       select $1, 'G-' || (2025 + g % 2) || '-' || lpad(g::text, 4, '0'),
              (select n.id from n where n.orden = 1 + g % 16),
              (select h.id from h join m on m.id = h.modalidad_id where m.k = g % 4 and h.k = (g / 4) % h.n),
              (select p.id from p where p.k = g % 17),
              (select s.id from s where s.k = g % s.n),
              date '2025-01-04' + (g * 7 % 650), date '2025-01-04' + (g * 7 % 650) + 28,
              case when g % 3 = 0 then 'Abierta' else 'Entregada' end,
              case when g % 3 = 0 then null else now() end
       from generate_series(1, $2::int) g`, [org, GRUPOS]);
    await db.query(
      `with e as (select id, row_number() over (order by codigo_adei) - 1 as k from estudiante),
            g as (select id, row_number() over (order by codigo_grupo) - 1 as k from grupo)
       insert into inscripcion (organizacion_id, estudiante_id, grupo_id, fecha_inscripcion, estado_inscripcion, observaciones)
       select $1, e.id, g.id, date '2025-01-01', case when e.k % 50 = 0 then 'Retirada' else 'Completada' end,
              case when e.k % 50 = 0 then 'Retiro sintético' end
       from e join g on g.k = e.k / $2::int`, [org, POR_GRUPO]);
    // Tres parciales a cuatro de cada cinco inscripciones, con notas de 40 a 100.
    await db.query(
      `insert into parcial (organizacion_id, inscripcion_id, numero, condicion, valor)
       select $1, i.id, n, 'Registrado', 40 + (abs(hashtext(i.id::text || n)) % 61)
       from (select id, row_number() over (order by id) as k from inscripcion) i, generate_series(1, 3) n
       where i.k % 5 <> 0`, [org]);
  } finally {
    await db.exec("alter table profesor enable trigger auditar; alter table grupo enable trigger auditar;");
    await db.exec("alter table inscripcion enable trigger auditar; alter table parcial enable trigger auditar;");
  }
  await db.exec("analyze");
  // Los conteos de control salen de la regla con que se repartieron los grupos (g % 4).
  for (const [k, m] of modalidades.entries()) {
    let n = 0;
    for (let g = 1; g <= GRUPOS; g++) if (g % 4 === k) n++;
    esperado.set(m.id, n * POR_GRUPO);
  }
}, 300_000);

describe("CE-21 · conteos de control (CA-05, CA-06)", () => {
  test("están cargados: 20,000 estudiantes y 20,000 inscripciones", async () => {
    expect((await db.query<{ n: number }>("select count(*)::int n from inscripcion")).rows[0].n).toBe(ESTUDIANTES);
  });

  test("cada modalidad devuelve exactamente sus inscripciones; sin criterios, todas", async () => {
    for (const m of modalidades) expect((await filtrar({ modalidad_id: m.id })).total, m.nombre).toBe(esperado.get(m.id));
    expect((await filtrar({})).total).toBe(ESTUDIANTES);
  });
});

describe("CE-20 · menos de 2 s con 20,000", () => {
  const casos: [string, () => Record<string, unknown>, string][] = [
    ["sin criterios", () => ({}), "inscripciones"],
    ["sin criterios, vista Estudiantes", () => ({}), "estudiantes"],
    ["una modalidad", () => ({ modalidad_id: modalidades[0].id }), "inscripciones"],
    ["estado académico Reprobado", () => ({ estado_academico: "Reprobado" }), "inscripciones"],
    ["tres criterios (RNF-03)", () => ({ modalidad_id: modalidades[1].id, programa: "Curso principal", estado_academico: "Aprobado" }), "inscripciones"],
    ["rango de fechas + estado de matrícula, vista Estudiantes", () => ({ desde: "2025-06-01", hasta: "2025-06-30", estado_matricula: "Activo" }), "estudiantes"],
  ];
  test.each(casos)("%s", async (_n, criterios, vista) => {
    const [r, ms] = await medir(() => filtrar(criterios(), vista));
    expect(r.estado).toBe("ok");
    expect(ms, `${_n}: ${ms.toFixed(0)} ms, ${r.total} resultados`).toBeLessThan(2000);
  });

  test("exportar las 20,000 filas", async () => {
    const [r, ms] = await medir(() => filtrar({}, "inscripciones", "exportar"));
    expect([r.estado, r.filas?.length]).toEqual(["ok", ESTUDIANTES]);
    console.info(`exportar 20,000 inscripciones: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(15_000);
    // El listado se arma en el servidor: debe caber en una respuesta de Vercel Hobby (4.5 MB, plan §6).
    const archivo = generarXlsx([hojaListado({ vista: "inscripciones", filas: r.filas as FilaInscripcion[], total: r.total,
      criterios: [], generado: { fechaHora: new Date().toISOString(), usuario: "prueba" } })]);
    console.info(`listado de 20,000 en Excel: ${(archivo.length / 1e6).toFixed(2)} MB`);
    expect(archivo.length).toBeLessThan(4.5e6);
  });

  test("el respaldo completo", async () => {
    const [r, ms] = await medir(() => comoUsuario(db, asis, async (tx) =>
      (await tx.query<{ r: { estado: string; generado: unknown; hojas: { nombre: string; total: number; filas: unknown[] }[] } }>("select respaldo() r")).rows[0].r));
    expect(r.estado).toBe("ok");
    const tam = JSON.stringify(r).length;
    console.info(`respaldo: ${ms.toFixed(0)} ms, ${(tam / 1e6).toFixed(1)} MB de JSON`);
    expect(r.hojas.find((h) => h.nombre === "inscripciones")!.total).toBe(ESTUDIANTES);
    expect(ms).toBeLessThan(30_000);
    // Plan §6: con 20,000 el respaldo en Excel pasa de 4.5 MB (medido el 2-nov: 8.1 MB), así que
    // se arma en el navegador y no pasa por Vercel. Se vigila que siga siendo una descarga razonable.
    const [archivo, msXlsx] = await medir(async () => generarXlsx(hojasRespaldo(r as unknown as RespaldoArchivo)));
    console.info(`respaldo en Excel: ${(archivo.length / 1e6).toFixed(2)} MB, ${msXlsx.toFixed(0)} ms`);
    expect(archivo.length).toBeLessThan(20e6);
    expect(msXlsx).toBeLessThan(15_000);
  });
});
