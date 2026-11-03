import { describe, test, expect } from "vitest";
import {
  hojaListado, hojaHistorial, hojasRespaldo, nombreArchivo, ErrorCompletitud, SinRegistros, fechaHoraArchivo,
  type FilaInscripcion, type FilaEstudiante,
} from "@/dominio/exportacion";

const generado = { fechaHora: "2026-11-03T00:40:00Z", usuario: "aura.gomez" };   // 02/11/2026 18:40 en Managua
const insc = (n: number, extra: Partial<FilaInscripcion> = {}): FilaInscripcion => ({
  id: `i${n}`, estudiante_id: `e${n}`, codigo_adei: `ADEI-2026-0000${n}`, apellidos: "Castillo Rivas", nombres: "PRUEBA Ana",
  estado_matricula: "Activo", sucursal: "Altamira", grupo_id: "g1", codigo_grupo: "G-2026-0004", programa: "Curso principal",
  nivel: "Intermediate I-I", modalidad: "Sabatino", hora_inicio: "07:30:00", hora_fin: "11:00:00", profesor: "Luis Pérez",
  fecha_inicio: "2026-09-26", fecha_termino: "2026-10-24", estado_acta: "Entregada", estado_inscripcion: "Completada",
  nota_final: 88, estado_academico: "Aprobado", provisional: false, ...extra,
});
const valor = (c: unknown) => (typeof c === "object" && c !== null ? (c as { v: unknown }).v : c);

describe("listado de inscripciones (CE-14, CE-24 a CE-27)", () => {
  const filas = [insc(1), insc(2, { nota_final: 76, estado_academico: "Reprobado" })];
  const h = hojaListado({ vista: "inscripciones", filas, total: 2, criterios: ["Modalidad: Sabatino"], generado });

  test("CE-26 · arriba: ADEI, título, fecha y autor, criterios y total completo", () => {
    expect(h.encabezado!.map((e) => e.texto)).toEqual([
      "ACADEMIA DE ENSEÑANZA EN INGLÉS · ADEI",
      "Listado de inscripciones — SIGFIE",
      "Generado: 02/11/2026 18:40 por aura.gomez",
      "Criterios: Modalidad: Sabatino",
      "Total: 2 registros. El listado está completo.",
    ]);
    expect(h.pie).toBe("Fin del listado: 2 de 2 registros.");
    expect(h.impresion?.horizontal).toBe(true);
  });

  test("CE-14 · las columnas de la vista Inscripciones, con los renglones numerados", () => {
    expect(h.columnas.map((c) => c.titulo)).toEqual(["N.º", "Código ADEI", "Apellidos y nombres", "Sucursal", "Grupo", "Programa",
      "Nivel", "Modalidad", "Horario", "Profesor", "Inicio", "Término", "Estado inscripción", "Final", "Estado académico"]);
    expect(h.filas[0].map(valor)).toEqual([1, "ADEI-2026-00001", "Castillo Rivas, PRUEBA Ana", "Altamira", "G-2026-0004",
      "Curso principal", "Intermediate I-I", "Sabatino", "7:30 a. m. – 11:00 a. m.", "Luis Pérez", "2026-09-26", "2026-10-24",
      "Completada", 88, "Aprobado"]);
    expect(h.columnas.find((c) => c.titulo === "Código ADEI")!.tipo).toBe("codigo");
    expect(h.columnas.find((c) => c.titulo === "Inicio")!.tipo).toBe("fecha");
  });

  test("principio 9 · solo la nota y el estado reprobados en rojo", () => {
    const rojas = (f: unknown[]) => f.filter((c) => typeof c === "object" && c !== null && (c as { rojo?: boolean }).rojo).length;
    expect(rojas(h.filas[0])).toBe(0);
    expect(rojas(h.filas[1])).toBe(2);
  });

  test("una nota provisional se marca como tal", () => {
    const p = hojaListado({ vista: "inscripciones", filas: [insc(1, { nota_final: 90, provisional: true, estado_academico: "Pendiente" })], total: 1, criterios: [], generado });
    expect(valor(p.filas[0][14])).toBe("Pendiente (provisional)");
  });

  test("CE-25 · si las filas no son el total, no hay archivo", () => {
    expect(() => hojaListado({ vista: "inscripciones", filas, total: 3, criterios: [], generado })).toThrow(ErrorCompletitud);
  });

  test("CE-27 · con 0 registros no se genera", () => {
    expect(() => hojaListado({ vista: "inscripciones", filas: [], total: 0, criterios: [], generado })).toThrow(SinRegistros);
  });

  test("1 registro: en singular", () => {
    const u = hojaListado({ vista: "inscripciones", filas: [insc(1)], total: 1, criterios: [], generado });
    expect(u.encabezado![4].texto).toBe("Total: 1 registro. El listado está completo.");
    expect(u.pie).toBe("Fin del listado: 1 de 1 registro.");
  });
});

describe("listado de estudiantes (CE-15)", () => {
  test("columnas y renglones", () => {
    const f: FilaEstudiante = { id: "e1", codigo_adei: "ADEI-2026-00001", apellidos: "Duarte Mena", nombres: "PRUEBA Carlos",
      cedula: "001-010190-0001A", sucursal: "Las Colinas", estado_matricula: "Desertor", inscripciones: 3, ultimo_nivel: "Beginners 2" };
    const h = hojaListado({ vista: "estudiantes", filas: [f], total: 1, criterios: [], generado });
    expect(h.encabezado![1].texto).toBe("Listado de estudiantes — SIGFIE");
    expect(h.columnas.map((c) => c.titulo)).toEqual(["N.º", "Código ADEI", "Apellidos y nombres", "Cédula", "Sucursal",
      "Estado de matrícula", "Último nivel cursado", "Inscripciones que cumplen"]);
    expect(h.filas[0].map(valor)).toEqual([1, "ADEI-2026-00001", "Duarte Mena, PRUEBA Carlos", "001-010190-0001A", "Las Colinas",
      "Desertor", "Beginners 2", 3]);
    expect(h.columnas[3].tipo).toBe("codigo");
  });
});

describe("historial (CE-43)", () => {
  test("datos del estudiante arriba y una fila por nivel, con parciales y su condición", () => {
    const h = hojaHistorial({
      estudiante: { codigo_adei: "ADEI-2026-00001", nombres: "PRUEBA Ana", apellidos: "Castillo Rivas", cedula: null,
        sucursal: "Altamira", estado_matricula: "Activo", fecha_cambio_estado: null },
      inscripciones: [{
        codigo_grupo: "G-2026-0004", programa: "Curso principal", nivel: "Intermediate I-I", modalidad: "Sabatino",
        hora_inicio: "07:30:00", hora_fin: "11:00:00", profesor: "Luis Pérez", sucursal: "Altamira",
        fecha_inicio: "2026-09-26", fecha_termino: "2026-10-24", estado_inscripcion: "Completada", estado_acta: "Entregada",
        parciales: [{ numero: 1, condicion: "Registrado", valor: 70 }, { numero: 2, condicion: "No presentado", valor: null },
          { numero: 3, condicion: "Reprogramado", valor: 85 }],
        nota_final: 52, provisional: false, estado_academico: "Reprobado", condicionado: false, justificacion_condicionado: null,
        factura: { serie: "B", numero: 42501, monto: 34, moneda: "USD" },
      }],
    }, generado);
    expect(h.encabezado!.map((e) => e.texto)).toEqual([
      "ACADEMIA DE ENSEÑANZA EN INGLÉS · ADEI",
      "Historial académico — Castillo Rivas, PRUEBA Ana",
      "Código ADEI-2026-00001 · Cédula: sin registro · Altamira · Activo",
      "Generado: 02/11/2026 18:40 por aura.gomez",
      "Total: 1 nivel cursado.",
    ]);
    expect(h.columnas.map((c) => c.titulo)).toEqual(["N.º", "Grupo", "Programa", "Nivel", "Modalidad", "Horario", "Profesor",
      "Sucursal", "Inicio", "Término", "I", "II", "III", "Final", "Estado académico", "Estado inscripción", "Factura"]);
    expect(h.filas[0].slice(10).map(valor)).toEqual([70, "NP", "85 R", 52, "Reprobado", "Completada", "B-42501 · US$34.00"]);
  });

  test("sin niveles cursados", () => {
    const h = hojaHistorial({ estudiante: { codigo_adei: "ADEI-2026-00002", nombres: "A", apellidos: "B", cedula: "001-010190-0001A",
      sucursal: "Altamira", estado_matricula: "Egresado", fecha_cambio_estado: "2026-10-01" }, inscripciones: [] }, generado);
    expect(h.encabezado![2].texto).toBe("Código ADEI-2026-00002 · Cédula: 001-010190-0001A · Altamira · Egresado desde 01/10/2026");
    expect(h.encabezado![4].texto).toBe("Sin niveles cursados.");
    expect(h.filas).toEqual([]);
  });
});

describe("respaldo (CE-31 a CE-33)", () => {
  const respaldo = {
    generado: { fecha_hora: "2026-11-03T00:45:00Z", usuario: "aura.gomez" },
    hojas: [
      { nombre: "estudiantes", total: 1, filas: [{ id: "e1", codigo_adei: "ADEI-2026-00001", cedula: "001-010190-0001A",
        fecha_nacimiento: "2000-01-01", creado_en: "2026-10-30T15:00:00Z", version: 1, estado_matricula: "Activo" }] },
      { nombre: "facturas", total: 1, filas: [{ id: "f1", serie: "B", numero: 42501, monto: 34, moneda: "USD", inscripcion_id: null }] },
      { nombre: "grupos", total: 0, filas: [] },
    ],
  };

  test("CE-32 · primero el índice, con fecha, autor, la nota de lo que no incluye y el total por hoja", () => {
    const [indice, ...resto] = hojasRespaldo(respaldo);
    expect(indice.nombre).toBe("Índice");
    expect(indice.encabezado!.map((e) => e.texto)).toEqual([
      "ACADEMIA DE ENSEÑANZA EN INGLÉS · ADEI", "Respaldo completo — SIGFIE",
      "Generado: 02/11/2026 18:45 por aura.gomez", "No incluye cuentas de usuario ni bitácora.",
    ]);
    expect(indice.columnas.map((c) => c.titulo)).toEqual(["Hoja", "Filas", "Qué contiene"]);
    expect(indice.filas.map((f) => [valor(f[0]), valor(f[1])])).toEqual([["Estudiantes", 1], ["Facturas", 1], ["Grupos", 0]]);
    expect(resto.map((h) => h.nombre)).toEqual(["Estudiantes", "Facturas", "Grupos"]);
  });

  test("CE-31 · columnas con nombres legibles y tipos según el dato; sin encabezado, para poder recargarlas", () => {
    const est = hojasRespaldo(respaldo)[1];
    expect(est.encabezado).toBeUndefined();
    const t = Object.fromEntries(est.columnas.map((c) => [c.titulo, c.tipo]));
    expect(t).toMatchObject({ "Id": "codigo", "Código ADEI": "codigo", "Cédula": "codigo", "Fecha de nacimiento": "fecha",
      "Creado en": "fechaHora", "Versión": "entero", "Estado de matrícula": "texto" });
    const fac = hojasRespaldo(respaldo)[2];
    expect(Object.fromEntries(fac.columnas.map((c) => [c.titulo, c.tipo]))).toMatchObject({ "Número": "entero", "Monto": "numero", "Inscripción": "codigo" });
  });

  test("CE-31 · una hoja sin filas lleva una columna que lo dice, para que Excel la abra", () => {
    const vacia = hojasRespaldo(respaldo).find((h) => h.nombre === "Grupos")!;
    expect(vacia.columnas).toEqual([{ titulo: "Sin registros", tipo: "texto" }]);
    expect(vacia.filas).toEqual([]);
  });

  test("CE-32 · si una hoja no trae todas sus filas, no hay archivo", () => {
    expect(() => hojasRespaldo({ ...respaldo, hojas: [{ nombre: "estudiantes", total: 2, filas: [{ id: "e1" }] }] })).toThrow(ErrorCompletitud);
  });
});

describe("nombre del archivo", () => {
  test("lleva qué es y cuándo se generó, en hora de Managua", () => {
    expect(nombreArchivo("inscripciones", "2026-11-03T00:40:00Z")).toBe("SIGFIE_inscripciones_2026-11-02_1840.xlsx");
    expect(fechaHoraArchivo("2026-11-03T00:40:00Z")).toBe("02/11/2026 18:40");
  });
});
