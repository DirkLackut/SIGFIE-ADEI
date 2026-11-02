/**
 * Escenario de la spec 002: una organización con su catálogo, las tres personas
 * (Asistente, Dirección, profesor del grupo) y otro profesor, más atajos para
 * abrir grupos, inscribir estudiantes y llamar a las operaciones del acta.
 * Todos los datos son inventados (constitución, principio 3).
 */
import type { PGlite } from "@electric-sql/pglite";
import { comoUsuario } from "./banco";
import { crearOrganizacion, crearCatalogoMinimo, crearPersona, crearProfesor, haceAnios, diasDesdeHoy, type Persona } from "./escenario";

export type Resp = { estado: string; [k: string]: unknown };
export type Resultado = {
  inscripcion_id: string; version: number; parciales: { numero: number; condicion: string; valor: number | null }[];
  faltan: number[]; nota_exacta: number | null; nota_final: number | null; provisional: boolean;
  requiere_retiro: boolean; estado: string | null; sin_regla: boolean; en_franja: boolean;
  condicionado: boolean; baja_inasistencia: boolean; estado_inscripcion: string; aviso_inasistencia: string | null;
};

export interface EscenarioActa {
  db: PGlite;
  org: string;
  cat: Awaited<ReturnType<typeof crearCatalogoMinimo>>;
  asis: Persona; dir: Persona; prof: Persona; otroProf: Persona;
  /** Nivel del Curso principal por orden (1–16), creado al pedirlo. */
  nivel(orden: number, programa?: string): Promise<string>;
  /** Regla como superusuario (sin pasar por las operaciones). */
  regla(programa: string, desde: number, hasta: number, minima: number, franja?: [number, number] | null,
        vigente?: string, provisional?: boolean): Promise<string>;
  grupo(opciones?: { nivel?: string; inicio?: number; termino?: number; profesor?: string }): Promise<string>;
  estudiante(): Promise<string>;
  inscribir(estudiante: string, grupo: string): Promise<string>;
  /** Grupo con `n` estudiantes inscritos; devuelve el grupo y las inscripciones. */
  grupoCon(n: number, opciones?: Parameters<EscenarioActa["grupo"]>[0]): Promise<{ grupo: string; inscripciones: string[] }>;
  llamar(p: Persona, sql: string, args?: unknown[]): Promise<Resp>;
  resultado(inscripcion: string): Promise<Resultado>;
  /** Escribe parciales directo, como superusuario: [valor o condición] por número. */
  parciales(inscripcion: string, valores: (number | string | null)[]): Promise<void>;
}

let consecutivo = 0;
const NOMBRES = ["Ana", "Luis", "Marta", "Pedro", "Sara", "Iván", "Rosa", "Hugo", "Elsa", "Raúl", "Nora", "Saúl"];
const APELLIDOS = ["Mora", "Ríos", "Vega", "Solís", "Cano", "Lara", "Pons", "Roca", "Baca", "Meza", "Tapia"];
/** Nombres sin dígitos (la tabla los rechaza), distintos para cada n. */
const letras = (n: number, lista: string[]) =>
  `${lista[n % lista.length]} ${lista[Math.floor(n / lista.length) % lista.length]}`;

export async function crearEscenarioActa(db: PGlite, codigo = "ADEI"): Promise<EscenarioActa> {
  const org = await crearOrganizacion(db, codigo);
  const cat = await crearCatalogoMinimo(db, org);
  const asis = await crearPersona(db, org, ["asistente"]);
  const dir = await crearPersona(db, org, ["direccion"]);
  const prof = await crearPersona(db, org, ["profesor"], { profesorId: cat.profesor });
  const otroProf = await crearPersona(db, org, ["profesor"], { profesorId: await crearProfesor(db, org, "Rosa", "Téllez") });
  const niveles = new Map<string, string>();

  const llamar = (p: Persona, sql: string, args: unknown[] = []) =>
    comoUsuario(db, p, async (tx) => (await tx.query<{ r: Resp }>(`select ${sql} r`, args)).rows[0].r);

  const esc: EscenarioActa = {
    db, org, cat, asis, dir, prof, otroProf, llamar,

    async nivel(orden, programa = "Curso principal") {
      const clave = `${programa}|${orden}`;
      if (!niveles.has(clave)) {
        const r = await db.query<{ id: string }>(
          `insert into nivel (organizacion_id, codigo, nombre, programa, orden, publico)
           values ($1, $2, $3, $4, $5, 'Adultos') returning id`,
          [org, `${programa.slice(0, 4).toUpperCase()}-${orden}-${++consecutivo}`, `${programa} ${orden}`, programa, orden]);
        niveles.set(clave, r.rows[0].id);
      }
      return niveles.get(clave)!;
    },

    async regla(programa, desde, hasta, minima, franja = [minima - 3, minima], vigente = "2023-01-01", provisional = false) {
      const r = await db.query<{ id: string }>(
        `insert into regla_aprobacion (organizacion_id, programa, nivel_desde, nivel_hasta, vigente_desde,
           nota_minima, condicionado_desde, nota_condicion, provisional)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [org, programa, desde, hasta, vigente, minima, franja?.[0] ?? null, franja?.[1] ?? null, provisional]);
      return r.rows[0].id;
    },

    async grupo({ nivel, inicio = -10, termino = 30, profesor } = {}) {
      const r = await llamar(asis, "abrir_grupo($1)", [JSON.stringify({
        nivel_id: nivel ?? (await esc.nivel(6)), modalidad_id: cat.modalidad, horario_id: cat.horario,
        profesor_id: profesor ?? cat.profesor, sucursal_id: cat.sucursal,
        fecha_inicio: diasDesdeHoy(inicio), fecha_termino: diasDesdeHoy(Math.max(termino, 0)) })]);
      if (r.estado !== "abierto") throw new Error(`abrir_grupo: ${JSON.stringify(r)}`);
      // Un grupo que ya terminó no se puede abrir: se abre vigente y se ajusta.
      if (termino < 0) await db.query("update grupo set fecha_termino = $2 where id = $1", [r.id, diasDesdeHoy(termino)]);
      return r.id as string;
    },

    async estudiante() {
      const n = ++consecutivo;
      const r = await llamar(asis, "registrar_estudiante($1)", [JSON.stringify({
        cedula: `002-${String(300000 + n)}-0000B`, nombres: letras(n, NOMBRES), apellidos: letras(n * 7, APELLIDOS),
        fecha_nacimiento: await haceAnios(db, 25, n), telefono: "88880000", sucursal_id: cat.sucursal })]);
      if (!r.id) throw new Error(`registrar_estudiante: ${JSON.stringify(r)}`);
      return r.id as string;
    },

    async inscribir(estudiante, grupo) {
      const r = await llamar(asis, "inscribir($1, $2, true, 'Inscripción de prueba')", [estudiante, grupo]);
      if (r.estado !== "inscrito") throw new Error(`inscribir: ${JSON.stringify(r)}`);
      return r.id as string;
    },

    async grupoCon(n, opciones = {}) {
      // Se inscribe con el grupo vigente; si debía haber terminado, se ajusta después.
      const termino = opciones.termino ?? 30;
      const grupo = await esc.grupo({ ...opciones, termino: Math.max(termino, 0) });
      const inscripciones: string[] = [];
      for (let i = 0; i < n; i++) inscripciones.push(await esc.inscribir(await esc.estudiante(), grupo));
      if (termino < 0) await db.query("update grupo set fecha_termino = $2 where id = $1", [grupo, diasDesdeHoy(termino)]);
      return { grupo, inscripciones };
    },

    async resultado(inscripcion) {
      const r = await db.query<{ r: Resultado }>("select interno.resultado($1) r", [inscripcion]);
      return r.rows[0].r;
    },

    async parciales(inscripcion, valores) {
      for (const [i, v] of valores.entries()) {
        if (v === null) continue;
        const [condicion, valor] = typeof v === "number" ? ["Registrado", v] : [v, null];
        await db.query(
          `insert into parcial (organizacion_id, inscripcion_id, numero, condicion, valor, reprogramacion_autorizada)
           values ($1,$2,$3,$4,$5, case when $4 = 'Reprogramado' then now() end)`,
          [org, inscripcion, i + 1, condicion, valor]);
      }
    },
  };
  return esc;
}
