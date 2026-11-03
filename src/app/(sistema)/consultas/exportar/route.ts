import { NextResponse, type NextRequest } from "next/server";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { catalogoFiltro } from "@/servidor/catalogo-filtro";
import { rpcDeSupabase } from "@/datos/rpc";
import { filtrar } from "@/datos/consultas";
import { desdeDireccion, describirCriterios, haciaDireccion } from "@/dominio/filtro";
import { hojaListado, nombreArchivo, ErrorCompletitud, SinRegistros } from "@/dominio/exportacion";
import { generarXlsx, TIPO_XLSX } from "@/dominio/xlsx";

/**
 * CE-24 a CE-28, CE-30: el resultado del filtrado en Excel, con todas sus filas.
 * La base registra la exportación (destino «exportar») y la app vuelve a contar
 * antes de armar el archivo (CE-25). Si algo falla, vuelve a la consulta con el aviso.
 */
export async function GET(req: NextRequest) {
  const estado = await exigirAcceso(["asistente", "direccion"]);
  const e = desdeDireccion(req.nextUrl.searchParams);
  const volver = (aviso: string) => {
    const q = haciaDireccion({ ...e, pagina: 1 });
    return NextResponse.redirect(new URL(`/consultas?${q ? `${q}&` : ""}exportacion=${aviso}`, req.url), 303);
  };
  const [cat, r] = await Promise.all([
    catalogoFiltro(),
    filtrar(rpcDeSupabase(await clienteSesion()), e.criterios, e.vista, 1, "exportar"),
  ]);
  if (r.estado === "incompleto") return volver("incompleto");
  if (r.estado !== "ok") return volver("error");
  const generado = { fechaHora: new Date().toISOString(), usuario: estado.nombre_usuario };
  try {
    const hoja = r.vista === "inscripciones"
      ? hojaListado({ vista: "inscripciones", filas: r.filas, total: r.total, criterios: describirCriterios(e.criterios, cat), generado })
      : hojaListado({ vista: "estudiantes", filas: r.filas, total: r.total, criterios: describirCriterios(e.criterios, cat), generado });
    return new NextResponse(Buffer.from(generarXlsx([hoja])), { headers: {
      "Content-Type": TIPO_XLSX,
      "Content-Disposition": `attachment; filename="${nombreArchivo(r.vista, generado.fechaHora)}"`,
      "Cache-Control": "no-store",
    } });
  } catch (x) {
    if (x instanceof SinRegistros) return volver("sin-registros");
    if (x instanceof ErrorCompletitud) return volver("incompleto");
    throw x;
  }
}
