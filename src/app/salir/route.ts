/**
 * Cerrar sesión. Acepta POST (botón "Salir") y GET (cuando proxy.ts cierra la
 * sesión de una cuenta desactivada, CE-7). Cierra en Supabase y en las cookies.
 */
import { NextResponse, type NextRequest } from "next/server";
import { clienteSesion } from "@/servidor/supabase";

async function salir(request: NextRequest) {
  const supabase = await clienteSesion();
  await supabase.auth.signOut();
  const motivo = request.nextUrl.searchParams.get("motivo") === "cuenta" ? "cuenta" : "salio";
  // Location relativa: el navegador vuelve al mismo dominio por el que entró
  // (con request.url, `next start` en 127.0.0.1 mandaba a localhost).
  return new NextResponse(null, { status: 303, headers: { Location: `/ingresar?motivo=${motivo}` } });
}

export const GET = salir;
export const POST = salir;
