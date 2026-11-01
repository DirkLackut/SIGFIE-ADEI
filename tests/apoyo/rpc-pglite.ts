/**
 * El tipo Rpc de src/datos, servido por PGlite "como" un usuario. Llama a las
 * funciones con argumentos con nombre, igual que la API de Supabase (PostgREST).
 */
import type { PGlite } from "@electric-sql/pglite";
import type { Rpc } from "@/datos/rpc";
import { comoUsuario, type UsuarioSimulado } from "./banco";

export function rpcComo(db: PGlite, u: UsuarioSimulado): Rpc {
  return async <T,>(funcion: string, argumentos: Record<string, unknown> = {}) => {
    const claves = Object.keys(argumentos);
    if (!/^[a-z_]+$/.test(funcion) || claves.some((k) => !/^[a-z_]+$/.test(k))) throw new Error("nombre inválido");
    const valores = claves.map((k) => {
      const v = argumentos[k];
      return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
    });
    const sql = `select public.${funcion}(${claves.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
    try {
      const r = await comoUsuario(db, u, (tx) => tx.query<{ r: T }>(sql, valores));
      return { data: r.rows[0].r, error: null };
    } catch (e) {
      const err = e as { message: string; code?: string; detail?: string };
      return { data: null, error: { message: err.message, code: err.code, details: err.detail ?? null } };
    }
  };
}
