/**
 * T27 — 014_consulta_y_reportes.sql, parte 5b: bitácora (CE-89 a CE-94) y
 * respaldo completo (CE-31 a CE-35). Datos inventados (principio 3).
 */
import { describe, test, expect, beforeAll } from "vitest";
import { crearBanco } from "../apoyo/banco";
import { crearEscenarioActa, type EscenarioActa, type Resp } from "../apoyo/acta";
import { diasDesdeHoy } from "../apoyo/escenario";
import { VECTORES_ENMASCARAR } from "../apoyo/vectores-enmascarar";

let e: EscenarioActa;
let otra: EscenarioActa;

beforeAll(async () => {
  const { db } = await crearBanco();
  e = await crearEscenarioActa(db);
  otra = await crearEscenarioActa(db, "OTRA");
  await e.nivel(6);
});

type Registro = { id: number; fecha_hora: string; usuario: string | null; tipo_accion: string; entidad: string;
  registro_afectado: string | null; detalle: string | null; cambios: { campo: string; anterior: unknown; nuevo: unknown }[] };
const bitacora = (filtros: Record<string, unknown> = {}, pagina = 1, quien = e.dir) =>
  e.llamar(quien, "bitacora($1, $2)", [JSON.stringify(filtros), pagina]);
const filas = (r: Resp) => r.filas as Registro[];

describe("bitacora (CE-89 a CE-94)", () => {
  test("CE-89 · Dirección ve su organización, del más reciente al más antiguo", async () => {
    await e.estudiante();
    await otra.estudiante();
    const r = await bitacora();
    expect(r.estado).toBe("ok");
    const ids = filas(r).map((f) => f.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    const mias = await e.db.query<{ n: number }>("select count(*)::int n from auditoria where organizacion_id = $1", [e.org]);
    // La propia consulta a la bitácora se registra después de contar.
    expect(r.total).toBe(mias.rows[0].n - 1);
    for (const k of ["fecha_hora", "usuario", "tipo_accion", "entidad", "registro_afectado", "detalle"]) expect(filas(r)[0]).toHaveProperty(k);
  });

  test("CE-90 · filtros por fechas, usuario, tipo de acción y entidad, con el total", async () => {
    const est = await e.estudiante();
    const r = await bitacora({ usuario_id: e.asis.id, tipo_accion: "Creación", entidad: "estudiante", desde: diasDesdeHoy(0), hasta: diasDesdeHoy(0) });
    expect(filas(r).every((f) => f.tipo_accion === "Creación" && f.entidad === "estudiante")).toBe(true);
    expect(filas(r).some((f) => f.registro_afectado === est)).toBe(true);
    expect(r.total).toBe(filas(r).length);
    expect((await bitacora({ desde: diasDesdeHoy(1) })).total).toBe(0);
    expect(await bitacora({ tipo_accion: "Borrado" })).toMatchObject({ estado: "criterios_invalidos", campo: "tipo_accion" });
    expect(await bitacora({ desde: diasDesdeHoy(1), hasta: diasDesdeHoy(-1) })).toMatchObject({ estado: "criterios_invalidos", campo: "hasta" });
  });

  test("CE-90 · todas las páginas, de 50 en 50, y las opciones de filtro", async () => {
    for (let i = 0; i < 30; i++) await e.estudiante();
    const p1 = await bitacora({}, 1);
    const ultima = Math.ceil((p1.total as number) / 50);
    const pu = await bitacora({}, ultima);
    expect(filas(p1).length).toBe(50);
    expect(filas(pu).length).toBe(Math.min(50, (pu.total as number) - (ultima - 1) * 50));
    expect((p1.usuarios as { id: string }[]).map((u) => u.id)).toEqual(expect.arrayContaining([e.asis.id, e.dir.id]));
    expect(p1.entidades).toEqual(expect.arrayContaining(["estudiante"]));
  });

  test("CE-91 · en una modificación, solo los campos que cambiaron", async () => {
    const est = await e.estudiante();
    await e.llamar(e.asis, "cambiar_estado_matricula($1, 'Egresado', null, 'Terminó el curso', false)", [est]);
    const r = await bitacora({ entidad: "estudiante", tipo_accion: "Modificación" });
    const f = filas(r).find((x) => x.registro_afectado === est)!;
    const campos = f.cambios.map((c) => c.campo).sort();
    expect(campos).toEqual(["estado_matricula", "fecha_cambio_estado"]);   // la versión no se muestra
    expect(f.cambios.find((c) => c.campo === "estado_matricula")).toMatchObject({ anterior: "Activo", nuevo: "Egresado" });
    expect(f.detalle).toMatch(/Terminó el curso/);
  });

  test("CE-94 · cédulas y teléfonos enmascarados, con los últimos 4 visibles", async () => {
    const est = await e.estudiante();
    const r = await bitacora({ entidad: "estudiante", tipo_accion: "Creación" });
    const f = filas(r).find((x) => x.registro_afectado === est)!;
    const cedula = f.cambios.find((c) => c.campo === "cedula")!.nuevo as string;
    const telefono = f.cambios.find((c) => c.campo === "telefono")!.nuevo as string;
    expect(cedula).toMatch(/^\*{3}-\*{6}-\*\d{3}[A-Z]$/);
    expect(telefono).toBe("****0000");
    expect(JSON.stringify(r)).not.toMatch(/\d{3}-\d{6}-\d{4}[A-Z]/);
    // Los identificadores no se tocan.
    expect(f.cambios.find((c) => c.campo === "id")!.nuevo).toBe(est);
  });

  test.each(VECTORES_ENMASCARAR)("CE-94 · la base enmascara igual que el dominio: %s", async (entrada, salida) => {
    expect((await e.db.query<{ r: string }>("select interno.enmascarar($1) r", [entrada])).rows[0].r).toBe(salida);
  });

  test("CE-92 · no hay forma de modificar ni eliminar registros", async () => {
    const r = await e.db.query("select proname from pg_proc where proname ~ '(modificar|eliminar|borrar|editar)_(bitacora|auditoria)'");
    expect(r.rows).toHaveLength(0);
  });

  test("CE-93 · solo Dirección: la Asistente y el profesor reciben «denegado» y queda registrado", async () => {
    for (const p of [e.asis, e.prof]) {
      expect(await bitacora({}, 1, p)).toEqual({ estado: "denegado" });
      const a = await e.db.query("select 1 from auditoria where tipo_accion = 'Denegación' and entidad = 'bitacora' and usuario_id = $1", [p.id]);
      expect(a.rows.length).toBeGreaterThan(0);
    }
  });

  test("RF-15 · consultar la bitácora también queda registrado", async () => {
    await bitacora();
    const a = await e.db.query("select 1 from auditoria where tipo_accion = 'Consulta' and entidad = 'bitacora' and usuario_id = $1", [e.dir.id]);
    expect(a.rows.length).toBeGreaterThan(0);
  });
});

type Hoja = { nombre: string; total: number; filas: Record<string, unknown>[] };

describe("respaldo (CE-31 a CE-35)", () => {
  test("CE-31, CE-32 · una hoja por conjunto, con su total igual a las filas y a la base", async () => {
    const { inscripciones: [i] } = await e.grupoCon(2);
    await e.parciales(i, [80, 80, 80]);
    const est = (await e.db.query<{ estudiante_id: string }>("select estudiante_id from inscripcion where id = $1", [i])).rows[0].estudiante_id;
    await e.llamar(e.asis, "registrar_factura($1, true)", [JSON.stringify({ serie: "B", numero: 44001, fecha_emision: diasDesdeHoy(0),
      monto: 34, moneda: "USD", estudiantes: [est], inscripcion_id: i })]);
    const r = await e.llamar(e.asis, "respaldo()");
    expect(r.estado).toBe("ok");
    expect(r.generado).toMatchObject({ usuario: expect.any(String) });
    const hojas = r.hojas as Hoja[];
    expect(hojas.map((h) => h.nombre)).toEqual(["estudiantes", "tutores", "estudiante_tutor", "grupos", "inscripciones", "parciales",
      "resultados", "facturas", "factura_estudiante", "sucursales", "niveles", "modalidades", "horarios", "profesores", "reglas"]);
    for (const h of hojas) expect(h.filas.length).toBe(h.total);
    const cuenta = async (t: string) => (await e.db.query<{ n: number }>(`select count(*)::int n from ${t} where organizacion_id = $1`, [e.org])).rows[0].n;
    const por = (n: string) => hojas.find((h) => h.nombre === n)!.total;
    expect(por("estudiantes")).toBe(await cuenta("estudiante"));
    expect(por("inscripciones")).toBe(await cuenta("inscripcion"));
    expect(por("parciales")).toBe(await cuenta("parcial"));
    expect(por("facturas")).toBe(await cuenta("factura"));
    expect(por("resultados")).toBe(por("inscripciones"));
  });

  test("CE-33 · sin cuentas, contraseñas ni bitácora; nada de otra organización", async () => {
    const r = await e.llamar(e.asis, "respaldo()");
    const texto = JSON.stringify(r);
    for (const prohibido of ["nombre_usuario", "encrypted_password", "valor_anterior", "tipo_accion"]) expect(texto).not.toContain(prohibido);
    const ajeno = await otra.estudiante();
    expect(texto).not.toContain(ajeno);
    const est = (r.hojas as Hoja[]).find((h) => h.nombre === "estudiantes")!.filas[0];
    expect(est).not.toHaveProperty("organizacion_id");
    expect(est).not.toHaveProperty("busqueda");
  });

  test("CE-34 · solo la Asistente: Dirección y el profesor reciben «denegado»", async () => {
    for (const p of [e.dir, e.prof]) expect(await e.llamar(p, "respaldo()")).toEqual({ estado: "denegado" });
  });

  test("CE-35 · queda en la bitácora con el total de cada hoja", async () => {
    await e.llamar(e.asis, "respaldo()");
    const a = await e.db.query<{ detalle: string }>(
      "select detalle from auditoria where tipo_accion = 'Consulta' and entidad = 'respaldo' and usuario_id = $1 order by id desc limit 1", [e.asis.id]);
    expect(JSON.parse(a.rows[0].detalle)).toHaveProperty("estudiantes");
  });
});
