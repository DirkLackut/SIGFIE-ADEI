/**
 * T11 — 007_permisos.sql: la matriz de permisos del plan (§5.6), casilla por
 * casilla, más los intentos prohibidos. Todo se hace con SQL directo "como" cada
 * usuario, es decir, sin pasar por la aplicación (CE-62).
 */
import { describe, test, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { crearBanco, comoUsuario, comoAnonimo } from "../apoyo/banco";
import { crearOrganizacion, crearCatalogoMinimo, crearPersona, haceAnios, type Persona } from "../apoyo/escenario";

let db: PGlite, A: string, B: string;
let cat: Awaited<ReturnType<typeof crearCatalogoMinimo>>;
const P = {} as Record<
  "asis" | "dir" | "prof1" | "prof2" | "director" | "sinAviso" | "temporal" | "asisB", Persona>;
let g1 = "", g2 = "";

beforeAll(async () => {
  ({ db } = await crearBanco());
  A = await crearOrganizacion(db, "ACAA");
  B = await crearOrganizacion(db, "ACAB");
  cat = await crearCatalogoMinimo(db, A);
  const catB = await crearCatalogoMinimo(db, B);

  P.asis = await crearPersona(db, A, ["asistente"]);
  P.dir = await crearPersona(db, A, ["direccion"]);
  P.prof1 = await crearPersona(db, A, ["profesor"]);
  P.prof2 = await crearPersona(db, A, ["profesor"]);
  P.director = await crearPersona(db, A, ["direccion", "profesor"]);      // CE-2: el Director también da clases
  P.sinAviso = await crearPersona(db, A, ["asistente"], { aceptaAviso: false });
  P.temporal = await crearPersona(db, A, ["asistente"], { debeCambiar: true });
  P.asisB = await crearPersona(db, B, ["asistente"]);

  const grupo = async (org: string, c: typeof cat, prof: string, num: number) =>
    (await db.query<{ id: string }>(
      `insert into grupo (organizacion_id, codigo_grupo, nivel_id, horario_id, profesor_id, sucursal_id, fecha_inicio, fecha_termino)
       values ($1,$2,$3,$4,$5,$6,'2026-11-02','2026-11-27') returning id`,
      [org, `G-2026-000${num}`, c.nivel, c.horario, prof, c.sucursal])).rows[0].id;
  g1 = await grupo(A, cat, P.prof1.profesorId!, 1);
  g2 = await grupo(A, cat, P.director.profesorId!, 2);
  const gB = await grupo(B, catB, catB.profesor, 1);

  const est = async (org: string, suc: string, cod: string) =>
    (await db.query<{ id: string }>(
      `insert into estudiante (organizacion_id, codigo_adei, nombres, apellidos, fecha_nacimiento, telefono, sucursal_id)
       values ($1,$2,'Luis','Mora',$3,'88887777',$4) returning id`, [org, cod, await haceAnios(db, 30), suc])).rows[0].id;
  const eA1 = await est(A, cat.sucursal, "ACAA-2026-00001");
  const eA2 = await est(A, cat.sucursal, "ACAA-2026-00002");
  const eB = await est(B, catB.sucursal, "ACAB-2026-00001");
  const ins = (org: string, e: string, g: string) =>
    db.query("insert into inscripcion (organizacion_id, estudiante_id, grupo_id) values ($1,$2,$3)", [org, e, g]);
  await ins(A, eA1, g1); await ins(A, eA2, g2); await ins(B, eB, gB);
});

const contar = (p: Persona, tabla: string) =>
  comoUsuario(db, p, (tx) => tx.query<{ n: number }>(`select count(*)::int n from ${tabla}`)).then((r) => r.rows[0].n);

describe("reglas generales", () => {
  test("RNF-05 · todas las tablas tienen RLS encendida", async () => {
    const r = await db.query<{ t: string }>(
      "select relname t from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity");
    expect(r.rows.map((x) => x.t)).toEqual([]);
  });

  test("RNF-05 · toda tabla tiene políticas, salvo correlativo, que nadie debe ver", async () => {
    const r = await db.query<{ t: string }>(
      `select c.relname t from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
         and not exists (select 1 from pg_policy p where p.polrelid = c.oid) order by 1`);
    expect(r.rows.map((x) => x.t)).toEqual(["correlativo"]);
  });

  test("seguridad · un visitante sin sesión no puede ejecutar ninguna función del sistema", async () => {
    const r = await db.query<{ f: string }>(
      `select p.proname f from pg_proc p where p.pronamespace = 'public'::regnamespace
         and has_function_privilege('anon', p.oid, 'execute') order by 1`);
    expect(r.rows.map((x) => x.f)).toEqual([]);
  });

  test("seguridad · un usuario solo puede ejecutar las funciones previstas", async () => {
    const r = await db.query<{ f: string }>(
      `select distinct p.proname f from pg_proc p where p.pronamespace = 'public'::regnamespace
         and has_function_privilege('authenticated', p.oid, 'execute') order by 1`);
    expect(r.rows.map((x) => x.f)).toEqual([
      "abrir_grupo", "acceso_habilitado", "aceptar_aviso", "acta_del_grupo", "actualizar_estudiante",
      "anular_factura", "anular_inscripcion", "asignar_roles", "autorizar_reprogramacion", "avisar_inasistencia",
      "bitacora", "buscar_estudiantes", "cambiar_estado_matricula", "cambiar_profesor", "condicionar",
      "corregir_factura", "crear_cuenta", "decidir_salida", "desvincular_tutor", "edad", "eliminar_regla",
      "entregar_acta", "filtrar", "guardar_parciales", "guardar_regla", "historial_academico", "hoja_matricula",
      "hoy_managua", "inscribir", "mi_estado_acceso", "mi_organizacion", "mi_profesor_id", "mis_grupos",
      "normalizar", "panel_actas", "quitar_condicionado", "registrar_estudiante", "registrar_evento",
      "registrar_factura", "reporte_sucursales", "respaldo", "tiene_rol", "vincular_tutor",
    ]);
  });

  test("seguridad · las auxiliares de las operaciones no están en el esquema publicado", async () => {
    const r = await db.query<{ f: string }>(
      `select p.proname f from pg_proc p where p.pronamespace = 'interno'::regnamespace order by 1`);
    expect(r.rows.map((x) => x.f)).toEqual([
      "anotar_motivo", "antecedentes", "cambios", "candidatos_mismo_estudiante", "contexto", "desfase_completitud",
      "enmascarar", "enmascarar_valor", "es_profesor_del_grupo", "escapar_like", "estudiantes_que_coinciden",
      "exigir_acceso", "exigir_asistente", "exigir_motivo", "factura_json", "fecha_criterio",
      "hay_criterio_de_inscripcion", "hoja", "inscripciones_que_cumplen", "monto_atipico", "periodo", "posicion",
      "resultado", "resumen_acta", "revisar_criterios", "revisar_factura", "ruta", "tocar",
    ]);
    // Las de la 008 (sus operaciones corren con los permisos de quien llama) y, de
    // la 012, solo las que usan inscribir y la vista resultado_academico
    // (security_invoker). Las demás de la 012 solo las llaman funciones SECURITY DEFINER.
    const usuario = await db.query<{ f: string }>(
      `select p.proname f from pg_proc p where p.pronamespace = 'interno'::regnamespace
         and has_function_privilege('authenticated', p.oid, 'execute') order by 1`);
    expect(usuario.rows.map((x) => x.f)).toEqual([
      "anotar_motivo", "antecedentes", "candidatos_mismo_estudiante", "escapar_like", "estudiantes_que_coinciden",
      "exigir_asistente", "exigir_motivo", "posicion", "ruta",
    ]);
    const anon = await db.query<{ n: number }>(
      `select count(*)::int n from pg_proc p where p.pronamespace = 'interno'::regnamespace
         and has_function_privilege('anon', p.oid, 'execute')`);
    expect(anon.rows[0].n).toBe(0);
  });

  test("seguridad · un visitante sin sesión no puede leer ninguna tabla", async () => {
    for (const t of ["estudiante", "usuario", "grupo", "auditoria", "nivel"])
      await expect(comoAnonimo(db, (tx) => tx.query(`select * from ${t}`))).rejects.toThrow(/permission denied/);
  });
});

describe("matriz de lectura (plan §5.6)", () => {
  // Filas que existen en la organización A (más las de B, que nunca deben verse).
  const casos: [string, keyof typeof P, number][] = [
    // catálogos: todos los roles leen
    ["nivel", "asis", 1], ["nivel", "dir", 1], ["nivel", "prof1", 1], ["nivel", "director", 1],
    // estudiantes: Asistente y Dirección, no el Profesor (CE-46)
    ["estudiante", "asis", 2], ["estudiante", "dir", 2], ["estudiante", "director", 2],
    ["estudiante", "prof1", 0], ["estudiante", "prof2", 0],
    // grupos: el Profesor solo los suyos
    ["grupo", "asis", 2], ["grupo", "dir", 2], ["grupo", "prof1", 1], ["grupo", "prof2", 0],
    ["inscripcion", "asis", 2], ["inscripcion", "prof1", 1], ["inscripcion", "prof2", 0],
    // CE-2: con Dirección + Profesor ve todo lo de Dirección
    ["grupo", "director", 2], ["inscripcion", "director", 2],
    // cuentas: la Asistente ve todas las de su organización; los demás, solo la suya
    ["usuario", "dir", 1], ["usuario", "prof1", 1],
    // CE-94: la auditoría, solo Dirección
    ["auditoria", "asis", 0],
    // CE-96, CE-100: la Asistente de otra organización no ve nada de A
    ["estudiante", "asisB", 1], ["grupo", "asisB", 1], ["nivel", "asisB", 1],
  ];
  test.each(casos)("%s · %s ve %i fila(s)", async (tabla, quien, esperado) => {
    expect(await contar(P[quien], tabla)).toBe(esperado);
  });

  test("CE-5 · la Asistente ve todas las cuentas de su organización y ninguna de la otra", async () => {
    const r = await comoUsuario(db, P.asis, (tx) => tx.query<{ o: string }>("select distinct organizacion_id o from usuario"));
    expect(r.rows.map((x) => x.o)).toEqual([A]);
    expect(await contar(P.asis, "usuario")).toBe(7);
  });

  test("CE-94 · Dirección sí ve la auditoría, solo de su organización", async () => {
    const r = await comoUsuario(db, P.dir, (tx) => tx.query<{ o: string }>("select distinct organizacion_id o from auditoria"));
    expect(r.rows.map((x) => x.o)).toEqual([A]);
  });
});

describe("la puerta de acceso (CE-7, CE-9, CE-15, CE-78)", () => {
  test("CE-15 · sin aceptar el aviso en esta sesión no se ve ningún dato", async () => {
    for (const t of ["nivel", "estudiante", "grupo"]) expect(await contar(P.sinAviso, t)).toBe(0);
  });

  test("CE-15 · haberlo aceptado en una sesión anterior no sirve para una nueva", async () => {
    const nuevaSesion = randomUUID();
    await db.query("insert into auth.sessions (id, user_id) values ($1, $2)", [nuevaSesion, P.asis.id]);
    expect(await contar({ ...P.asis, sesion: nuevaSesion }, "estudiante")).toBe(0);
    expect(await contar(P.asis, "estudiante")).toBe(2); // su sesión original sigue bien
  });

  test("CE-9 · con contraseña temporal pendiente no se ve ningún dato", async () => {
    for (const t of ["nivel", "estudiante", "grupo"]) expect(await contar(P.temporal, t)).toBe(0);
  });

  test("CE-78 · pero sí su propia cuenta, sus roles y el aviso, para saber qué hacer", async () => {
    expect(await contar(P.temporal, "usuario")).toBe(1);
    expect(await contar(P.temporal, "usuario_rol")).toBe(1);
    expect(await contar(P.sinAviso, "aviso_privacidad")).toBe(1);
  });

  test("CE-7 · desactivar una cuenta corta el acceso en la consulta siguiente", async () => {
    const p = await crearPersona(db, A, ["direccion"]);
    expect(await contar(p, "estudiante")).toBe(2);
    await db.query("update usuario set estado = 'inactivo' where id = $1", [p.id]);
    expect(await contar(p, "estudiante")).toBe(0);
  });
});

describe("escritura (CE-61, CE-62, CE-100)", () => {
  const crearNivel = "insert into nivel (codigo, nombre, programa, orden, publico) values ($1, $2, 'Advanced', $3, 'Adultos')";

  test("la Asistente crea en su organización sin indicar cuál", async () => {
    await comoUsuario(db, P.asis, (tx) => tx.query(crearNivel, ["ADV-1", "Advanced 1", 1]));
    const r = await db.query<{ o: string }>("select organizacion_id o from nivel where codigo = 'ADV-1'");
    expect(r.rows[0].o).toBe(A);
  });

  test.each(["dir", "prof1", "director"] as const)("CE-61 · %s no puede crear catálogos", async (q) => {
    await expect(comoUsuario(db, P[q], (tx) => tx.query(crearNivel, [`X-${q}`, `Nivel ${q}`, 50])))
      .rejects.toThrow(/row-level security/);
  });

  test("CE-61 · Dirección no puede modificar estudiantes: la fila ni siquiera le cambia", async () => {
    const r = await comoUsuario(db, P.dir, (tx) => tx.query("update estudiante set direccion = 'cambiada'"));
    expect(r.affectedRows).toBe(0);
  });

  test("CE-61 · el Profesor no puede inscribir ni anular", async () => {
    await expect(comoUsuario(db, P.prof1, (tx) => tx.query("delete from inscripcion"))).resolves.toMatchObject({ affectedRows: 0 });
  });

  test("CE-100 · la Asistente de otra organización no puede escribir en A ni indicándolo", async () => {
    await expect(comoUsuario(db, P.asisB, (tx) =>
      tx.query("insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico) values ($1,'Z','Intrusa','Advanced',9,'Adultos')", [A])))
      .rejects.toThrow(/row-level security/);
  });

  test("CE-100 · ni modificar filas de A sabiendo su id", async () => {
    const r = await comoUsuario(db, P.asisB, (tx) => tx.query("update grupo set fecha_termino = '2027-01-01' where id = $1", [g1]));
    expect(r.affectedRows).toBe(0);
  });

  test("CE-100 · ni mover una fila propia a la otra organización", async () => {
    await expect(comoUsuario(db, P.asis, (tx) =>
      tx.query("update nivel set organizacion_id = $1 where codigo = 'ADV-1'", [B]))).rejects.toThrow(/row-level security|foreign key/);
  });

  test("seguridad · un usuario no puede darse roles a sí mismo", async () => {
    await expect(comoUsuario(db, P.dir, (tx) =>
      tx.query("insert into usuario_rol (organizacion_id, usuario_id, rol) values ($1,$2,'asistente')", [A, P.dir.id])))
      .rejects.toThrow(/row-level security/);
  });

  test("seguridad · un usuario no puede quitarse la contraseña temporal pendiente", async () => {
    const r = await comoUsuario(db, P.temporal, (tx) =>
      tx.query("update usuario set debe_cambiar_contrasena = false where id = $1", [P.temporal.id]));
    expect(r.affectedRows).toBe(0);
  });

  test("seguridad · nadie lee ni toca los correlativos desde la API", async () => {
    await expect(comoUsuario(db, P.asis, (tx) => tx.query("select * from correlativo"))).rejects.toThrow(/permission denied/);
  });
});

describe("cambio de profesor (CE-52)", () => {
  test("CE-52 · al cambiar el profesor, el anterior deja de ver el grupo en la consulta siguiente", async () => {
    expect(await contar(P.prof1, "grupo")).toBe(1);
    await db.query("update grupo set profesor_id = $2 where id = $1", [g1, P.prof2.profesorId]);
    expect(await contar(P.prof1, "grupo")).toBe(0);
    expect(await contar(P.prof1, "inscripcion")).toBe(0);
    expect(await contar(P.prof2, "grupo")).toBe(1);
  });
});
