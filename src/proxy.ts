/**
 * proxy.ts (Next 16; antes "middleware"). Corre antes de cada pantalla.
 *
 *   1. Renueva la sesión de Supabase en las cookies (si el token venció).
 *   2. Pide a la base el estado de acceso de la persona (migración 010).
 *   3. La manda a donde le corresponde: ingreso, cambio de contraseña temporal,
 *      aviso de privacidad o la pantalla pedida (dominio/acceso.ts).
 *
 * Guía, no protege: aunque alguien se saltara esto, la base no le devuelve datos
 * sin acceso habilitado (plan §5.4, D6).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/tipos/base-de-datos";
import { decidirRuta, type EstadoAcceso } from "@/dominio/acceso";

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims() verifica la firma del token; no basta con leer la cookie.
  const { data: sesion } = await supabase.auth.getClaims();
  let estado: EstadoAcceso | null = null;
  if (sesion?.claims) {
    const { data, error } = await supabase.rpc("mi_estado_acceso");
    estado = error ? null : (data as unknown as EstadoAcceso);
  }

  const decision = decidirRuta(estado, request.nextUrl.pathname);
  if (decision.tipo === "seguir") return respuesta;

  const destino = NextResponse.redirect(new URL(decision.a, request.url));
  respuesta.cookies.getAll().forEach((c) => destino.cookies.set(c));   // conserva la sesión renovada
  return destino;
}

export const config = {
  // Todo menos los archivos estáticos de Next y las imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
