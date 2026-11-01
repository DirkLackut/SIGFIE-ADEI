import "server-only";

/**
 * Variables de entorno del servidor. Se leen aquí y en ningún otro lugar, para
 * que un nombre mal escrito falle con un mensaje claro y no con un error raro.
 * Los valores viven en .env.local (fuera de git); nunca en el código.
 */
function requerida(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre} (ver .env.example).`);
  return v;
}

export const entorno = {
  get url() { return requerida("NEXT_PUBLIC_SUPABASE_URL"); },
  get claveAnonima() { return requerida("NEXT_PUBLIC_SUPABASE_ANON_KEY"); },
  /** Clave de servicio: ignora RLS. Solo para lo que el plan §5.1 y §8 permiten. */
  get claveServicio() { return requerida("SUPABASE_SERVICE_ROLE_KEY"); },
};
