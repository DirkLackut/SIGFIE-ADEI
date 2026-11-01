/**
 * T14 — 008_operaciones.sql, parte 3: búsqueda de estudiantes y aceptación del
 * aviso de privacidad.
 */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco, comoUsuario } from "../apoyo/banco";
import { crearOrganizacion, crearCatalogoMinimo, crearPersona, type Persona } from "../apoyo/escenario";

type Fila = { codigo_adei: string; apellidos: string; cedula: string | null };
type Resp = { estado: string; total?: number; pagina?: number; por_pagina?: number; resultados?: Fila[]; minimo?: number };
let db: PGlite, A: string, B: string;
let asis: Persona, dir: Persona, prof: Persona, director: Persona, asisB: Persona;

beforeAll(async () => {
  ({ db } = await crearBanco());
  A = await crearOrganizacion(db, "ADEI"); B = await crearOrganizacion(db, "OTRA");
  const cat = await crearCatalogoMinimo(db, A), catB = await crearCatalogoMinimo(db, B);
  asis = await crearPersona(db, A, ["asistente"]);
  dir = await crearPersona(db, A, ["direccion"]);
  prof = await crearPersona(db, A, ["profesor"]);
  director = await crearPersona(db, A, ["direccion", "profesor"]);
  asisB = await crearPersona(db, B, ["asistente"]);

  // 120 "Gutiérrez" (tres páginas de 50) y algunos casos puntuales. Inventados.
  await db.query(
    `insert into estudiante (organizacion_id, codigo_adei, cedula, nombres, apellidos, fecha_nacimiento, telefono, sucursal_id)
     select $1, 'ADEI-2026-' || lpad(i::text, 5, '0'), '001-' || lpad(i::text, 6, '0') || '-0000A',
            'Persona', 'Gutiérrez', date '1990-01-01' + i, '88887777', $2
     from generate_series(1, 120) i`, [A, cat.sucursal]);
  await db.query(
    `insert into estudiante (organizacion_id, codigo_adei, cedula, nombres, apellidos, fecha_nacimiento, telefono, sucursal_id) values
     ($1, 'ADEI-2025-00007', '281-150390-0012K', 'María José', 'Núñez Álvarez', '1990-03-15', '88887777', $2)`, [A, cat.sucursal]);
  await db.query(
    `insert into estudiante (organizacion_id, codigo_adei, cedula, nombres, apellidos, fecha_nacimiento, telefono, sucursal_id)
     values ($1, 'OTRA-2026-00001', '001-999999-0000Z', 'Externo', 'Gutiérrez', '1990-01-01', '88887777', $2)`, [B, catB.sucursal]);
});

const buscar = (p: Persona, texto: string, pagina = 1) =>
  comoUsuario(db, p, async (tx) => (await tx.query<{ r: Resp }>("select buscar_estudiantes($1, $2) r", [texto, pagina])).rows[0].r);
const ultimaAuditoria = async (u: Persona) => (await db.query<{ tipo_accion: string; entidad: string; detalle: string }>(
  "select tipo_accion, entidad, detalle from auditoria where usuario_id = $1 order by id desc limit 1", [u.id])).rows[0];

describe("buscar_estudiantes (CE-42 a CE-46, CE-85, CE-18)", () => {
  test("CE-42 · por nombre, sin distinguir mayúsculas ni tildes", async () => {
    for (const t of ["nunez", "NÚÑEZ ÁLV", "maria jose"]) {
      const r = await buscar(asis, t);
      expect(r.total, t).toBe(1);
      expect(r.resultados![0].codigo_adei).toBe("ADEI-2025-00007");
    }
  });

  test("CE-42 · por cédula, con o sin guiones, y por código ADEI", async () => {
    for (const t of ["281-150390", "2811503900012k", "150390-0012K", "adei-2025-00007"])
      expect((await buscar(asis, t)).resultados!.map((f) => f.codigo_adei), t).toEqual(["ADEI-2025-00007"]);
  });

  test("CE-43 · con menos de 3 caracteres no busca ni registra nada", async () => {
    const antes = await db.query<{ n: number }>("select count(*)::int n from auditoria");
    expect(await buscar(asis, " gu ")).toEqual({ estado: "texto_corto", minimo: 3 });
    const despues = await db.query<{ n: number }>("select count(*)::int n from auditoria");
    expect(despues.rows[0].n).toBe(antes.rows[0].n);
  });

  test("CE-44 · sin coincidencias devuelve total 0 de forma explícita", async () => {
    expect(await buscar(asis, "zzzqqq")).toMatchObject({ estado: "ok", total: 0, resultados: [] });
  });

  test("los comodines % y _ que escribe el usuario no se interpretan como comodines", async () => {
    expect((await buscar(asis, "%%%")).total).toBe(0);
    expect((await buscar(asis, "___")).total).toBe(0);
  });

  test("CE-85 · muestra el total real y permite recorrer todas las páginas", async () => {
    const vistos = new Set<string>();
    for (const [pagina, cuantos] of [[1, 50], [2, 50], [3, 20], [4, 0]]) {
      const r = await buscar(asis, "gutierrez", pagina);
      expect(r.total).toBe(120);
      expect(r.resultados).toHaveLength(cuantos);
      r.resultados!.forEach((f) => vistos.add(f.codigo_adei));
    }
    expect(vistos.size).toBe(120);
  });

  test("CE-97 · nunca aparecen estudiantes de otra organización", async () => {
    expect((await buscar(asis, "externo")).total).toBe(0);
    expect((await buscar(asisB, "gutierrez")).total).toBe(1);
  });

  test("CE-18 · cada búsqueda queda registrada con el texto buscado", async () => {
    await buscar(dir, "Núñez");
    expect(await ultimaAuditoria(dir)).toEqual({ tipo_accion: "Consulta", entidad: "busqueda_estudiantes", detalle: "Núñez" });
  });

  test("CE-46 · un usuario solo Profesor recibe 'denegado' y la denegación queda registrada", async () => {
    expect(await buscar(prof, "gutierrez")).toEqual({ estado: "denegado" });
    expect(await ultimaAuditoria(prof)).toMatchObject({ tipo_accion: "Denegación", entidad: "busqueda_estudiantes" });
  });

  test("CE-2 · el Director que también es profesor sí puede buscar", async () => {
    expect((await buscar(director, "gutierrez")).total).toBe(120);
  });

  test("sin acceso habilitado no se busca", async () => {
    const sinAviso = await crearPersona(db, A, ["asistente"], { aceptaAviso: false });
    await expect(buscar(sinAviso, "gutierrez")).rejects.toThrow(/Sin acceso/);
  });
});

describe("aceptar_aviso (CE-15, CE-16)", () => {
  const habilitado = (p: Persona) =>
    comoUsuario(db, p, async (tx) => (await tx.query<{ ok: boolean }>("select acceso_habilitado() ok")).rows[0].ok);
  const aceptar = (p: Persona, version: string) => comoUsuario(db, p, (tx) => tx.query("select aceptar_aviso($1)", [version]));

  test("CE-16 · registra usuario, sesión, versión y fecha-hora, y habilita el acceso", async () => {
    const p = await crearPersona(db, A, ["asistente"], { aceptaAviso: false });
    expect(await habilitado(p)).toBe(false);
    await aceptar(p, "v0.1");
    const r = await db.query<{ sesion: string; version: string; reciente: boolean }>(
      "select sesion, version, fecha_hora > now() - interval '1 minute' reciente from aceptacion_privacidad where usuario_id = $1", [p.id]);
    expect(r.rows).toEqual([{ sesion: p.sesion, version: "v0.1", reciente: true }]);
    expect(await habilitado(p)).toBe(true);
  });

  test("CE-16 · solo se acepta la versión vigente", async () => {
    const p = await crearPersona(db, A, ["asistente"], { aceptaAviso: false });
    await expect(aceptar(p, "v0.0")).rejects.toThrow(/versión vigente/);
  });

  test("seguridad · nadie inserta aceptaciones directamente (ni a nombre de otro)", async () => {
    const p = await crearPersona(db, A, ["asistente"], { aceptaAviso: false });
    await expect(comoUsuario(db, p, (tx) => tx.query(
      "insert into aceptacion_privacidad (organizacion_id, usuario_id, sesion, version) values ($1, $2, $3, 'v0.1')",
      [A, asis.id, p.sesion]))).rejects.toThrow(/permission denied/);
  });
});
