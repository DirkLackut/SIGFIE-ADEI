import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { catalogoFiltro } from "@/servidor/catalogo-filtro";
import { rpcDeSupabase } from "@/datos/rpc";
import { filtrar } from "@/datos/consultas";
import { Alerta } from "@/componentes/ui";
import { HojaImpresa, TABLA_IMPRESA } from "@/componentes/impreso";
import { desdeDireccion, describirCriterios, haciaDireccion } from "@/dominio/filtro";
import { estadoEnPalabras, fechaHoraArchivo } from "@/dominio/exportacion";
import { paginar } from "@/dominio/impresion";
import { fecha, hora } from "@/dominio/formato";
import { BotonImprimir } from "../../actas/[id]/imprimir/boton";

export const metadata: Metadata = { title: "Listado para imprimir · SIGFIE-ADEI" };
// Filas por hoja carta horizontal, medidas con nombres de 48 caracteres (hallazgo 1 de
// T23): una inscripción ocupa dos líneas (nombre y fechas), un estudiante una.
const POR_HOJA = 16;
const POR_HOJA_ESTUDIANTES = 24;

/** CE-29: el resultado completo para imprimir, en carta horizontal, con la
 *  numeración continua entre hojas. La base registra la impresión (CE-28). */
export default async function PaginaImprimirListado({ searchParams }: PageProps<"/consultas/imprimir">) {
  const estado = await exigirAcceso(["asistente", "direccion"]);
  const e = desdeDireccion(await searchParams);
  const q = haciaDireccion({ ...e, pagina: 1 });
  const volver = (q ? `/consultas?${q}` : "/consultas") as Route;
  const [cat, r] = await Promise.all([catalogoFiltro(), filtrar(rpcDeSupabase(await clienteSesion()), e.criterios, e.vista, 1, "imprimir")]);
  if (r.estado !== "ok" || r.filas.length !== r.total) return (
    <div className="mx-auto max-w-2xl space-y-3 p-6">
      <Alerta tipo="cuidado" titulo="No se puede imprimir">
        {r.estado === "incompleto" || r.estado === "ok" ? "El resultado no estaba completo. El incidente quedó registrado; intente de nuevo."
          : r.estado === "denegado" ? "Las consultas son para la Asistente de Dirección y para Dirección." : "No se pudo consultar."}
      </Alerta>
      <Link href={volver} className="text-sm font-semibold text-azul hover:underline">← Volver a la consulta</Link>
    </div>
  );

  const ahora = fechaHoraArchivo(new Date().toISOString());
  const criterios = describirCriterios(e.criterios, cat).join(" · ");
  const titulo = r.vista === "inscripciones" ? "LISTADO DE INSCRIPCIONES" : "LISTADO DE ESTUDIANTES";
  const pie = `Generado el ${ahora} por ${estado.nombre_usuario} · ${r.total.toLocaleString("en-US")} ${r.total === 1 ? "registro" : "registros"}, listado completo`;

  return (
    <>
      <div className="no-imprimir mx-auto flex max-w-[279mm] flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href={volver} className="text-sm font-semibold text-azul hover:underline">← Volver a la consulta</Link>
        <BotonImprimir />
      </div>
      {r.vista === "inscripciones" ? paginar(r.filas, POR_HOJA).map((filas, h, todas) => (
        <HojaImpresa key={h} titulo={titulo} numero={h + 1} de={todas.length} pie={pie}>
          <p className="mb-2"><strong>Criterios:</strong> {criterios} · <strong>Total:</strong> {r.total.toLocaleString("en-US")}</p>
          <table className={TABLA_IMPRESA}>
            <thead><tr><th>N.º</th><th>Código</th><th className="min-w-[42mm]">Apellidos y nombres</th><th>Sucursal</th><th className="min-w-[30mm]">Grupo y nivel</th>
              <th className="min-w-[34mm]">Horario y profesor</th><th>Inicio / Término</th><th>Inscripción</th><th>Final</th><th>Estado</th></tr></thead>
            <tbody>
              {filas.map((f, i) => {
                const rep = f.estado_academico === "Reprobado";
                return (
                  <tr key={f.id}>
                    <td className="cifra">{h * POR_HOJA + i + 1}</td><td className="font-mono">{f.codigo_adei}</td>
                    <td>{f.apellidos}, {f.nombres}</td><td>{f.sucursal}</td>
                    <td><span className="font-mono whitespace-nowrap">{f.codigo_grupo}</span><br />{f.nivel}</td>
                    <td><span className="whitespace-nowrap">{f.modalidad} {hora(f.hora_inicio)}</span><br />{f.profesor}</td>
                    <td className="fecha">{fecha(f.fecha_inicio)}<br />{fecha(f.fecha_termino)}</td><td>{f.estado_inscripcion}</td>
                    <td className={`cifra text-center font-bold ${rep ? "text-reprobado" : ""}`}>{f.nota_final ?? ""}</td>
                    <td className={rep ? "text-reprobado" : ""}>{estadoEnPalabras(f.estado_academico, f.provisional)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </HojaImpresa>
      )) : paginar(r.filas, POR_HOJA_ESTUDIANTES).map((filas, h, todas) => (
        <HojaImpresa key={h} titulo={titulo} numero={h + 1} de={todas.length} pie={pie}>
          <p className="mb-2"><strong>Criterios:</strong> {criterios} · <strong>Total:</strong> {r.total.toLocaleString("en-US")}</p>
          <table className={TABLA_IMPRESA}>
            <thead><tr><th>N.º</th><th>Código ADEI</th><th>Apellidos y nombres</th><th>Cédula</th><th>Sucursal</th><th>Estado de matrícula</th>
              <th>Último nivel cursado</th><th>Inscripciones</th></tr></thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.id}>
                  <td className="cifra">{h * POR_HOJA_ESTUDIANTES + i + 1}</td><td className="font-mono">{f.codigo_adei}</td><td>{f.apellidos}, {f.nombres}</td>
                  <td className="font-mono">{f.cedula ?? "—"}</td><td>{f.sucursal}</td><td>{f.estado_matricula}</td>
                  <td>{f.ultimo_nivel ?? "Sin niveles cursados"}</td><td className="cifra text-center">{f.inscripciones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </HojaImpresa>
      ))}
    </>
  );
}
