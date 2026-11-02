import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { actaDelGrupo } from "@/datos/actas";
import { Alerta, Emblema } from "@/componentes/ui";
import { celdaFinal, celdaParcial, LEYENDA, paginarActa } from "@/dominio/acta-impresa";
import { esUuid, fecha, fechaHora, hora } from "@/dominio/formato";
import { BotonImprimir } from "./boton";

export const metadata: Metadata = { title: "Hoja de registro de notas · SIGFIE-ADEI" };

/**
 * 002·CE-50 a CE-53: la Hoja de registro de notas de ADEI, llena por el sistema
 * (docs/formatos/hoja-de-registro-de-notas.jpg). Se reproduce el formato, no se
 * rediseña: emblema, encabezado bilingüe, datos del grupo, 20 renglones por hoja,
 * «Entregado», «Firma del profesor» y la nota del pie. La reprobada, en rojo.
 */
export default async function PaginaImprimirActa({ params }: PageProps<"/actas/[id]/imprimir">) {
  const estado = await exigirAcceso(["asistente", "direccion", "profesor"]);
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const acta = await actaDelGrupo(rpcDeSupabase(await clienteSesion()), id);
  if (acta.estado === "no_existe") notFound();
  const volver = (estado.roles.includes("asistente") || estado.roles.includes("direccion") ? `/grupos/${id}` : `/mis-grupos/${id}`) as Route;
  if (acta.estado !== "ok") return (
    <div className="mx-auto max-w-2xl space-y-3 p-6">
      <Alerta tipo="cuidado">{acta.estado === "denegado" ? "Este grupo no está asignado a usted." : acta.mensaje}</Alerta>
      <Link href="/inicio" className="text-sm font-semibold text-azul hover:underline">← Inicio</Link>
    </div>
  );

  const g = acta.grupo;
  const hojas = paginarActa(acta.filas);
  const horario = `${g.modalidad} (${g.dias_de_clase.toLowerCase()}), ${hora(g.hora_inicio)} a ${hora(g.hora_fin)}`;

  return (
    <>
      <div className="no-imprimir mx-auto flex max-w-[216mm] flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href={volver} className="text-sm font-semibold text-azul hover:underline">← Volver al grupo</Link>
        <div className="flex flex-wrap items-center gap-3">
          {g.estado_acta === "Abierta" && <span className="text-sm text-dorado-texto">⚠ El acta sigue abierta: las notas pueden cambiar.</span>}
          <BotonImprimir />
        </div>
      </div>

      {hojas.map((renglones, h) => (
        <article key={h} className="hoja relative mx-auto mb-6 flex min-h-[279mm] max-w-[216mm] flex-col overflow-hidden border border-borde bg-papel px-[14mm] py-[12mm] font-titulo text-[11pt] text-tinta">
          {/* Marca de agua: el emblema oficial, grande y tenue, como en el formato. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-marino opacity-[0.07]">
            <Emblema className="size-[150mm]" />
          </div>

          <header className="relative flex items-center gap-6">
            <Emblema className="size-[22mm] text-marino" titulo="Emblema de ADEI" />
            <div className="flex-1 text-center">
              <p className="text-[18pt] font-bold leading-tight">English Teaching Academy</p>
              <p className="text-[18pt] font-bold leading-tight">Academia de Enseñanza en Inglés</p>
            </div>
          </header>
          <h1 className="relative mt-5 text-center text-[12pt] font-bold tracking-wide">HOJA DE REGISTRO DE NOTAS</h1>

          <dl className="relative mt-5 grid grid-cols-[auto_1fr_auto_1fr] items-end gap-x-3 gap-y-2 text-[11pt]">
            <Campo etiqueta="Inicio">{fecha(g.fecha_inicio)}</Campo>
            <Campo etiqueta="Término">{fecha(g.fecha_termino)}</Campo>
            <Campo etiqueta="Nivel">{g.nivel}</Campo>
            <Campo etiqueta="Horario">{horario}</Campo>
            <Campo etiqueta="Profesor" ancho>{g.profesor}</Campo>
          </dl>

          <table className="relative mt-5 w-full border-collapse text-[10.5pt]">
            <thead>
              <tr className="[&>th]:border [&>th]:border-tinta [&>th]:px-1.5 [&>th]:py-1">
                <th className="w-[11mm] text-left">No.</th><th className="text-left">Nombres y Apellidos</th>
                <th className="w-[15mm]">I</th><th className="w-[15mm]">II</th><th className="w-[15mm]">III</th><th className="w-[19mm]">Final</th>
              </tr>
            </thead>
            <tbody>
              {renglones.map(({ numero, fila }) => {
                const final = fila ? celdaFinal(fila) : null;
                const excluida = fila && (fila.estado_inscripcion === "Retirada" || fila.estado_inscripcion === "Trasladada");
                return (
                  <tr key={numero} className="h-[6.9mm] [&>td]:border [&>td]:border-tinta [&>td]:px-1.5">
                    <td className="cifra font-bold">{numero}.</td>
                    <td className="font-sans text-[10pt]">{fila ? `${fila.nombres} ${fila.apellidos}` : ""}</td>
                    {[1, 2, 3].map((n) => (
                      <td key={n} className="cifra text-center font-sans">
                        {fila && !excluida ? celdaParcial(fila.parciales.find((p) => p.numero === n)) : ""}
                      </td>
                    ))}
                    <td className={`cifra text-center font-sans font-bold ${final?.reprobada ? "text-reprobado" : ""}`}>{final?.texto ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <footer className="relative mt-auto pt-5">
            <div className="grid grid-cols-[auto_1fr_auto_1fr] items-end gap-x-3 text-[12pt] font-bold">
              <span>Entregado:</span>
              <span className="border-b border-tinta pb-0.5 text-center font-sans text-[10pt] font-normal">
                {g.estado_acta === "Entregada" ? fechaHora(g.fecha_entrega_acta) : ""}
              </span>
              <span>Firma del profesor:</span>
              <span className="border-b border-tinta">&nbsp;</span>
            </div>
            <p className="mt-4 border-y border-tinta py-1.5 text-[10pt] font-bold">
              Nota: Favor no realizar enmiendas ni borrones, indicar en rojo las notas reprobadas.
            </p>
            <p className="mt-1.5 flex flex-wrap justify-between gap-2 font-sans text-[7.5pt] text-tinta-suave">
              <span>{LEYENDA}</span>
              <span>{g.codigo_grupo} · {g.sucursal} · Hoja {h + 1} de {hojas.length}</span>
            </p>
          </footer>
        </article>
      ))}
    </>
  );
}

function Campo({ etiqueta, ancho = false, children }: { etiqueta: string; ancho?: boolean; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-bold">{etiqueta}:</dt>
      <dd className={`border-b border-tinta px-1 pb-0.5 font-sans text-[10.5pt] ${ancho ? "col-span-3" : ""}`}>{children}</dd>
    </>
  );
}
