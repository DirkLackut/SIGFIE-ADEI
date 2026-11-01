/**
 * Forma única de llamar a las operaciones de la base (008). Las pantallas usan
 * Supabase; las pruebas, PGlite (tests/apoyo/rpc-pglite.ts). Como las dos cumplen
 * este mismo tipo, el código de src/datos se prueba tal como corre en producción.
 */
export interface ErrorBD { message: string; code?: string; details?: string | null; hint?: string | null }
export type RespuestaBD<T> = { data: T | null; error: ErrorBD | null };
export type Rpc = <T = unknown>(funcion: string, argumentos?: Record<string, unknown>) => Promise<RespuestaBD<T>>;

/** Adapta un cliente de Supabase al tipo Rpc. */
export function rpcDeSupabase(cliente: { rpc: (f: never, a?: never) => PromiseLike<{ data: unknown; error: ErrorBD | null }> }): Rpc {
  return async <T,>(funcion: string, argumentos?: Record<string, unknown>) => {
    const r = await cliente.rpc(funcion as never, argumentos as never);
    return { data: r.data as T, error: r.error };
  };
}
