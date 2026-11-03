import { NextResponse, type NextRequest } from "next/server";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { historialAcademico } from "@/datos/consultas";
import { hojaHistorial, nombreArchivo } from "@/dominio/exportacion";
import { generarXlsx, TIPO_XLSX } from "@/dominio/xlsx";
import { esUuid } from "@/dominio/formato";

/** CE-43: el historial académico en Excel. La base registra la consulta (CE-41). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const estado = await exigirAcceso(["asistente", "direccion"]);
  const { id } = await params;
  if (!esUuid(id)) return new NextResponse("No existe.", { status: 404 });
  const h = await historialAcademico(rpcDeSupabase(await clienteSesion()), id);
  if (h.estado === "no_existe") return new NextResponse("No existe.", { status: 404 });
  if (h.estado !== "ok") return NextResponse.redirect(new URL(`/estudiantes/${id}`, req.url), 303);
  const generado = { fechaHora: new Date().toISOString(), usuario: estado.nombre_usuario };
  const archivo = generarXlsx([hojaHistorial(h, generado)]);
  return new NextResponse(Buffer.from(archivo), { headers: {
    "Content-Type": TIPO_XLSX,
    "Content-Disposition": `attachment; filename="${nombreArchivo(`historial_${h.estudiante.codigo_adei}`, generado.fechaHora)}"`,
    "Cache-Control": "no-store",
  } });
}
