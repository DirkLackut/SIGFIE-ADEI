/** T24 — grupos e inscripciones por el camino de la app (datos/grupos), contra PGlite. */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco } from "../apoyo/banco";
import { crearOrganizacion, crearCatalogoMinimo, crearPersona, haceAnios, diasDesdeHoy, type Persona } from "../apoyo/escenario";
import { rpcComo } from "../apoyo/rpc-pglite";
import { abrirGrupo, inscribir, anularInscripcion, cambiarProfesor, type DatosGrupo } from "@/datos/grupos";
import { registrarEstudiante } from "@/datos/estudiantes";
import type { Rpc } from "@/datos/rpc";

let db: PGlite, asis: Persona, rpc: Rpc, cat: Awaited<ReturnType<typeof crearCatalogoMinimo>>, otroHorario = "";
const dias = diasDesdeHoy;

beforeAll(async () => {
  ({ db } = await crearBanco());
  const org = await crearOrganizacion(db, "ADEI");
  cat = await crearCatalogoMinimo(db, org);
  asis = await crearPersona(db, org, ["asistente"]);
  rpc = rpcComo(db, asis);
  const mod = (await db.query<{ id: string }>("insert into modalidad (organizacion_id, nombre, dias_de_clase) values ($1,'Sabatino','Sábado') returning id", [org])).rows[0].id;
  otroHorario = (await db.query<{ id: string }>("insert into horario (organizacion_id, modalidad_id, hora_inicio, hora_fin) values ($1,$2,'07:30','11:00') returning id", [org, mod])).rows[0].id;
});

const datos = (c: Partial<DatosGrupo> = {}): DatosGrupo => ({ nivel_id: cat.nivel, modalidad_id: cat.modalidad, horario_id: cat.horario,
  profesor_id: cat.profesor, sucursal_id: cat.sucursal, fecha_inicio: dias(-2), fecha_termino: dias(26), ...c });
let n = 0;
async function estudiante() {
  const r = await registrarEstudiante(rpc, { nombres: "Ana", apellidos: `Prueba ${"ABCDEFGHIJ"[++n % 10]}`, fecha_nacimiento: await haceAnios(db, 25, n),
    telefono: "88887777", sucursal_id: cat.sucursal });
  return (r as { id: string }).id;
}

describe("T24", () => {
  test("CE-48 · abrir devuelve el código del grupo", async () => {
    expect(await abrirGrupo(rpc, datos())).toMatchObject({ estado: "abierto", codigo_grupo: expect.stringMatching(/^G-\d{4}-\d{4}$/) });
  });
  test("CE-49 · un horario de otra modalidad se rechaza con un mensaje claro", async () => {
    expect(await abrirGrupo(rpc, datos({ horario_id: otroHorario }))).toMatchObject({ estado: "error", mensaje: expect.stringMatching(/no pertenece a la modalidad/) });
  });
  test("CE-50 · fechas al revés: el error señala la fecha de término", async () => {
    expect(await abrirGrupo(rpc, datos({ fecha_inicio: dias(10), fecha_termino: dias(5) }))).toMatchObject({ estado: "error", campo: "fecha_termino" });
  });
  test("CE-84 · la superposición pide confirmar; al confirmar, inscribe", async () => {
    const e = await estudiante();
    const g1 = (await abrirGrupo(rpc, datos())) as { id: string; codigo_grupo: string };
    const g2 = (await abrirGrupo(rpc, datos())) as { id: string };
    expect(await inscribir(rpc, e, g1.id)).toMatchObject({ estado: "inscrito" });
    expect(await inscribir(rpc, e, g2.id)).toMatchObject({ estado: "superposicion", grupos: [{ codigo_grupo: g1.codigo_grupo }] });
    expect(await inscribir(rpc, e, g2.id, true)).toMatchObject({ estado: "inscrito" });
    expect(await inscribir(rpc, e, g2.id)).toEqual({ estado: "ya_inscrito" });
  });
  test("CE-58 · anular exige motivo", async () => {
    const e = await estudiante();
    const g2 = (await abrirGrupo(rpc, datos())) as { id: string };
    const i = (await inscribir(rpc, e, g2.id, true)) as { id: string };
    expect(await anularInscripcion(rpc, i.id, "")).toMatchObject({ ok: false, mensaje: expect.stringMatching(/motivo/) });
    expect(await anularInscripcion(rpc, i.id, "Grupo equivocado")).toEqual({ ok: true });
  });
  test("CE-51 · cambiar el profesor exige motivo", async () => {
    const g = (await abrirGrupo(rpc, datos())) as { id: string };
    expect(await cambiarProfesor(rpc, g.id, cat.profesor, "")).toMatchObject({ ok: false });
    expect(await cambiarProfesor(rpc, g.id, cat.profesor, "Reasignación")).toEqual({ ok: true });
  });
});
