import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/tipos/base-de-datos";
import { entorno } from "./entorno";

/**
 * Cliente con la sesión de la persona (cookies). Todo lo que pide pasa por RLS:
 * es el cliente de casi todas las pantallas y acciones.
 */
export async function clienteSesion() {
  const almacen = await cookies();
  return createServerClient<Database>(entorno.url, entorno.claveAnonima, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        // En un Server Component no se pueden escribir cookies; proxy.ts ya las
        // renueva en cada navegación, así que aquí se ignora sin riesgo.
        try { lista.forEach(({ name, value, options }) => almacen.set(name, value, options)); } catch {}
      },
    },
  });
}

/**
 * Cliente con la clave de servicio: IGNORA RLS. Solo para lo que no puede hacer
 * la persona por sí misma y el plan lo autoriza:
 *   · buscar la cuenta y registrar un ingreso fallido, que ocurren sin sesión (§5.1, §8);
 *   · crear, suspender y restablecer usuarios de Supabase Auth (§5.2, CE-5, CE-8);
 *   · quitar la marca de contraseña temporal tras el cambio (migración 010).
 * Cada uso comprueba antes quién lo pide. Nunca llega al navegador.
 */
export function clienteServicio() {
  return createClient<Database>(entorno.url, entorno.claveServicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
