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
import { nuevoNonce, politicaDeContenido } from "@/dominio/seguridad";

export async function proxy(request: NextRequest) {
  // CSP con un nonce nuevo (CE-102). Next lo lee del encabezado del pedido y lo
  // pone en sus propios scripts; el navegador no ejecuta ningún otro.
  const csp = politicaDeContenido(nuevoNonce(), process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NODE_ENV === "development");
  const seguir = () => {
    const encabezados = new Headers(request.headers);   // se copia aquí, con las cookies ya renovadas
    encabezados.set("Content-Security-Policy", csp);
    const r = NextResponse.next({ request: { headers: encabezados } });
    r.headers.set("Content-Security-Policy", csp);
    return r;
  };
  let respuesta = seguir();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = seguir();
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
  destino.headers.set("Content-Security-Policy", csp);
  respuesta.cookies.getAll().forEach((c) => destino.cookies.set(c));   // conserva la sesión renovada
  return destino;
}

export const config = {
  // Todo menos los archivos estáticos de Next y las imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
