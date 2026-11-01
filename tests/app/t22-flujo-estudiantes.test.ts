/**
 * T22 — flujo completo de registro, por el mismo camino que usa la app
 * (dominio/formulario-estudiante → datos/estudiantes → base), contra PGlite.
 * "Hecho cuando: el flujo completo de un menor con tutor nuevo y de un hermano
 * con el mismo tutor funciona contra PGlite."
 */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBanco } from "../apoyo/banco";
import { crearOrganizacion, crearCatalogoMinimo, crearPersona, haceAnios, type Persona } from "../apoyo/escenario";
import { rpcComo } from "../apoyo/rpc-pglite";
import { revisarEstudiante, type EntradaEstudiante } from "@/dominio/formulario-estudiante";
import { registrarEstudiante, actualizarEstudiante, vincularTutor, desvincularTutor } from "@/datos/estudiantes";
import { hoyEnManagua } from "@/dominio/edad";
import type { Rpc } from "@/datos/rpc";

let db: PGlite, asis: Persona, rpc: Rpc, sucursal = "";
const HOY = hoyEnManagua(new Date());

beforeAll(async () => {
  ({ db } = await crearBanco());
  const org = await crearOrganizacion(db, "ADEI");
  sucursal = (await crearCatalogoMinimo(db, org)).sucursal;
  asis = await crearPersona(db, org, ["asistente"]);
  rpc = rpcComo(db, asis);
});

const entrada = (c: Partial<EntradaEstudiante>): EntradaEstudiante => ({
  cedula: "", nombres: "", apellidos: "", fecha_nacimiento: "", telefono: "", correo: "", direccion: "",
  contacto_emergencia: "", sucursal_id: sucursal, tutor_cedula: "", tutor_nombre: "", tutor_telefono: "", ...c });

async function registrar(c: Partial<EntradaEstudiante>, confirmar = false) {
  const r = revisarEstudiante(entrada(c), HOY);
  expect(r.errores).toEqual({});
  return registrarEstudiante(rpc, r.datos, confirmar);
}

describe("T22 · menor con tutor nuevo y hermano con el mismo tutor", () => {
  const tutor = { tutor_cedula: "001-200385-0003m", tutor_nombre: "  María  José Castillo ", tutor_telefono: "8812-3456" };

  test("CE-29 · CE-33 · el menor se registra con su tutor y recibe código", async () => {
    const r = await registrar({ nombres: "Diego", apellidos: "Castillo", fecha_nacimiento: await haceAnios(db, 9),
      contacto_emergencia: "Madre 88123456", ...tutor });
    expect(r).toMatchObject({ estado: "registrado", codigo_adei: expect.stringMatching(/^ADEI-\d{4}-\d{5}$/) });
    const t = await db.query<{ nombre_completo: string; cedula: string; telefono: string }>(
      "select nombre_completo, cedula, telefono from tutor where cedula = '001-200385-0003M'");
    expect(t.rows).toEqual([{ nombre_completo: "María José Castillo", cedula: "001-200385-0003M", telefono: "88123456" }]);
  });

  test("CE-38 · el hermano reutiliza al tutor por su cédula: un solo registro de tutor", async () => {
    const r = await registrar({ nombres: "Lucía", apellidos: "Castillo", fecha_nacimiento: await haceAnios(db, 12),
      contacto_emergencia: "Madre 88123456", tutor_cedula: "001-200385-0003M", tutor_nombre: "Otro Nombre", tutor_telefono: "88000000" });
    expect(r.estado).toBe("registrado");
    const t = await db.query<{ n: number; v: number; nombre: string }>(`select count(distinct t.id)::int n, count(*)::int v,
      min(t.nombre_completo) nombre from tutor t join estudiante_tutor et on et.tutor_id = t.id where t.cedula = '001-200385-0003M'`);
    expect(t.rows[0]).toEqual({ n: 1, v: 2, nombre: "María José Castillo" });
  });

  test("CE-31 · CE-32 · un homónimo sin cédula pide confirmación; al confirmar se registra", async () => {
    const datos = { nombres: "Pedro", apellidos: "Mena", fecha_nacimiento: await haceAnios(db, 40, 11), telefono: "88001122" };
    await registrar(datos);
    const r = await registrar({ ...datos, nombres: "PEDRO" });
    expect(r.estado).toBe("coincidencias");
    expect((await registrar(datos, true)).estado).toBe("registrado");
  });

  test("CE-30 · una cédula repetida devuelve el expediente existente", async () => {
    const d = { cedula: "001-010190-0001A", nombres: "Rosa", apellidos: "Paz", fecha_nacimiento: await haceAnios(db, 36), telefono: "88112233" };
    const a = await registrar(d);
    const b = await registrar({ ...d, nombres: "Rosa Elena" });
    expect(b).toMatchObject({ estado: "cedula_existente", expediente: { codigo_adei: (a as { codigo_adei: string }).codigo_adei } });
  });

  test("CE-79 · con cédula, si existe la misma persona sin cédula, se ofrece completar; se completa editando", async () => {
    const d = { nombres: "Iris", apellidos: "Lara", fecha_nacimiento: await haceAnios(db, 28, 4), telefono: "88554433" };
    const a = await registrar(d);
    const r = await registrar({ ...d, cedula: "001-020298-0002B" });
    expect(r.estado).toBe("completar");
    const e = await actualizarEstudiante(rpc, (a as { id: string }).id, 1, { cedula: "001-020298-0002B" });
    expect(e).toMatchObject({ estado: "actualizado", version: 2 });
  });

  test("CE-81 · CE-82 · al editar: no quitar el único tutor; con dos, sí", async () => {
    const r = await registrar({ nombres: "Tomás", apellidos: "Vega", fecha_nacimiento: await haceAnios(db, 10),
      contacto_emergencia: "Padre 88776655", tutor_cedula: "001-300380-0004N", tutor_nombre: "Raúl Vega", tutor_telefono: "88776655" });
    const id = (r as { id: string }).id;
    const t1 = (await db.query<{ id: string }>("select id from tutor where cedula = '001-300380-0004N'")).rows[0].id;
    const quitar = await desvincularTutor(rpc, id, t1);
    expect(quitar).toMatchObject({ ok: false, mensaje: expect.stringMatching(/tutor/) });
    expect(await vincularTutor(rpc, id, { cedula: "001-310382-0005P", nombre_completo: "Ana Vega", telefono: "88776600" })).toEqual({ ok: true });
    expect(await desvincularTutor(rpc, id, t1)).toEqual({ ok: true });
  });

  test("CE-37 · un error de la base vuelve con su campo", async () => {
    const r = await registrarEstudiante(rpc, { nombres: "Ana", apellidos: "Ruiz", fecha_nacimiento: await haceAnios(db, 30),
      telefono: "123", sucursal_id: sucursal });
    expect(r).toMatchObject({ estado: "error", campo: "telefono" });
  });

  test("CE-86 · editar con una versión vieja devuelve conflicto y no sobrescribe", async () => {
    const r = await registrar({ nombres: "Gael", apellidos: "Soto", fecha_nacimiento: await haceAnios(db, 31), telefono: "88990011" });
    const id = (r as { id: string }).id;
    await actualizarEstudiante(rpc, id, 1, { direccion: "Primera" });
    expect(await actualizarEstudiante(rpc, id, 1, { direccion: "Segunda" })).toEqual({ estado: "conflicto" });
  });
});
