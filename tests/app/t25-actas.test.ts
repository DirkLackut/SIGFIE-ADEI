/**
 * T25 — el acta por el camino de la app (src/datos/actas.ts), contra PGlite:
 * las respuestas llegan con la forma que esperan las pantallas y los errores de
 * la base se traducen a un mensaje para la persona.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { crearBanco } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa } from "../apoyo/acta";
import { rpcComo } from "../apoyo/rpc-pglite";
import type { Rpc } from "@/datos/rpc";
import {
  misGrupos, actaDelGrupo, guardarParciales, autorizarReprogramacion, avisarInasistencia, decidirSalida,
  condicionar, quitarCondicionado, entregarActa, guardarRegla, eliminarRegla,
} from "@/datos/actas";
import { inscribir } from "@/datos/grupos";

let e: EscenarioActa, prof: Rpc, asis: Rpc, dir: Rpc, otro: Rpc;

beforeAll(async () => {
  const { db } = await crearBanco();
  e = await crearEscenarioActa(db);
  await e.nivel(6); await e.nivel(7);
  await e.regla("Curso principal", 6, 13, 80, [77, 80]);
  prof = rpcComo(db, e.prof); asis = rpcComo(db, e.asis); dir = rpcComo(db, e.dir); otro = rpcComo(db, e.otroProf);
});

describe("T25 · datos/actas", () => {
  test("002·CE-1 · misGrupos da los grupos del profesor con su avance", async () => {
    const { grupo } = await e.grupoCon(2);
    const r = await misGrupos(prof);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grupos.find((g) => g.id === grupo)).toMatchObject({ completas: 0, total: 2, estado_acta: "Abierta" });
  });

  test("002·CE-4, CE-5 · actaDelGrupo: «denegado» a otro profesor; al suyo, filas sin datos personales", async () => {
    const { grupo } = await e.grupoCon(1);
    expect(await actaDelGrupo(otro, grupo)).toEqual({ estado: "denegado" });
    const a = await actaDelGrupo(prof, grupo);
    expect(a.estado).toBe("ok");
    if (a.estado === "ok") {
      expect(a.filas[0]).toMatchObject({ nota_minima: 80, condicionado_desde: 77, sin_regla: false, version: 0 });
      expect(a.permisos.capturar).toBe(true);
    }
    expect(await actaDelGrupo(prof, "00000000-0000-0000-0000-000000000000")).toEqual({ estado: "no_existe" });
  });

  test("002·CE-7, CE-12 · guardar y conflicto", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    const p = [{ numero: 1, condicion: "Registrado", valor: 85 }, { numero: 2, condicion: "No presentado", valor: null },
      { numero: 3, condicion: "", valor: null }] as const;
    const r = await guardarParciales(prof, i, [...p], 0);
    expect(r).toMatchObject({ estado: "guardado", resultado: { version: 1, provisional: true } });
    expect(await guardarParciales(prof, i, [...p], 0)).toMatchObject({ estado: "conflicto" });
  });

  test("002·CE-8 · el error de la base llega como mensaje legible", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    const r = await guardarParciales(prof, i, [{ numero: 1, condicion: "Registrado", valor: 101 }], 0);
    expect(r).toEqual({ estado: "error", mensaje: "El parcial 1 debe ser un número entero entre 0 y 100." });
  });

  test("002·CE-32 a CE-41 · las decisiones de la Asistente", async () => {
    const [a, b] = (await e.grupoCon(2)).inscripciones;
    await guardarParciales(prof, a, [{ numero: 1, condicion: "No presentado", valor: null }], 0);
    expect(await autorizarReprogramacion(asis, a, 1, "R-1")).toMatchObject({ ok: true });
    expect(await avisarInasistencia(prof, b, "No viene desde octubre")).toMatchObject({ ok: true });
    expect(await decidirSalida(asis, b, "retiro", "Viajó fuera del país")).toMatchObject({ ok: true, resultado: { estado_inscripcion: "Retirada" } });
    expect(await decidirSalida(dir, a, "retiro", "Dirección no decide")).toEqual({ ok: false, mensaje: "Solo la Asistente de Dirección puede hacer esta operación." });
  });

  test("002·CE-41 · retiro con notas pide confirmar", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardarParciales(prof, i, [{ numero: 1, condicion: "Registrado", valor: 90 }], 0);
    expect(await decidirSalida(asis, i, "traslado", "Cambio de horario")).toEqual({ ok: false, advertir: 1 });
    expect(await decidirSalida(asis, i, "traslado", "Cambio de horario", true)).toMatchObject({ ok: true });
  });

  test("002·CE-29 a CE-31 · condicionar y quitar", async () => {
    const [i] = (await e.grupoCon(1)).inscripciones;
    await guardarParciales(prof, i, [78, 78, 78].map((v, n) => ({ numero: n + 1, condicion: "Registrado" as const, valor: v })), 0);
    expect(await condicionar(asis, i, "Buen desempeño oral")).toMatchObject({ ok: true, resultado: { estado: "Condicionado" } });
    expect(await quitarCondicionado(asis, i, "Asignado por error")).toMatchObject({ ok: true, resultado: { estado: "Reprobado" } });
  });

  test("002·CE-42 a CE-45 · entregar: incompleta, resumen y entregada", async () => {
    const { grupo, inscripciones: [i] } = await e.grupoCon(1);
    expect(await entregarActa(prof, grupo)).toMatchObject({ estado: "sin_calificaciones" });
    await guardarParciales(prof, i, [{ numero: 1, condicion: "Registrado", valor: 90 }], 0);
    expect(await entregarActa(prof, grupo)).toMatchObject({ estado: "incompleta", faltan: [{ faltan: [2, 3] }] });
    await guardarParciales(prof, i, [90, 90, 90].map((v, n) => ({ numero: n + 1, condicion: "Registrado" as const, valor: v })), 1);
    expect(await entregarActa(prof, grupo)).toMatchObject({ estado: "resumen", resumen: { aprobados: 1 } });
    expect(await entregarActa(prof, grupo, true)).toMatchObject({ estado: "entregada" });
  });

  test("002·CE-25 a CE-28 · guardar y eliminar reglas, con el error en palabras", async () => {
    const r = await guardarRegla(asis, { programa: "Curso principal", nivel_desde: 6, nivel_hasta: 7, vigente_desde: "2040-01-01",
      nota_minima: 80, condicionado_desde: 77, nota_condicion: 80, provisional: true });
    expect(r).toMatchObject({ ok: true });
    const dup = await guardarRegla(asis, { programa: "Curso principal", nivel_desde: 7, nivel_hasta: 8, vigente_desde: "2040-01-01",
      nota_minima: 80, condicionado_desde: null, nota_condicion: null, provisional: true });
    expect(dup).toMatchObject({ ok: false, mensaje: expect.stringMatching(/misma fecha de vigencia/) });
    if (r.ok) expect(await eliminarRegla(asis, r.id)).toEqual({ ok: true });
  });

  test("002·CE-54 · inscribir con antecedente pide motivo y lo acepta", async () => {
    const est = await e.estudiante();
    const g6 = await e.grupo({ nivel: await e.nivel(6) });
    const i = await e.inscribir(est, g6);
    await e.parciales(i, [60, 60, 60]);
    const g7 = await e.grupo({ nivel: await e.nivel(7) });
    const r = await inscribir(asis, est, g7, true);
    expect(r).toMatchObject({ estado: "antecedente", antecedentes: [{ tipo: "reprobado", nota_final: 60 }] });
    expect(await inscribir(asis, est, g7, true, "Decisión de la secretaría")).toMatchObject({ estado: "inscrito" });
  });
});
