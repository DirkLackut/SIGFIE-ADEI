import type { Metadata } from "next";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { actaDelGrupo } from "@/datos/actas";
import { Alerta, BotonEnlace, Dato, Insignia, Seccion, TituloPagina } from "@/componentes/ui";
import { ActaEnPantalla } from "@/componentes/acta";
import { esUuid, fecha, fechaHora, hora } from "@/dominio/formato";

export const metadata: Metadata = { title: "Acta · SIGFIE-ADEI" };

/** 002·CE-4 a CE-18, CE-37, CE-42 a CE-47: el acta del profesor. */
export default async function PaginaActaProfesor({ params }: PageProps<"/mis-grupos/[id]">) {
  await exigirAcceso(["profesor"]);
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const acta = await actaDelGrupo(rpcDeSupabase(await clienteSesion()), id);
  if (acta.estado === "no_existe") notFound();
  if (acta.estado !== "ok") return (
    <div className="space-y-4">
      <TituloPagina titulo="Acta" volver={{ href: "/mis-grupos", texto: "Mis grupos" }} />
      <Alerta tipo="cuidado">{acta.estado === "denegado" ? "Este grupo no está asignado a usted." : acta.mensaje}</Alerta>
    </div>
  );
  const g = acta.grupo;
  return (
    <div className="space-y-5">
      <TituloPagina volver={{ href: "/mis-grupos", texto: "Mis grupos" }} titulo={g.nivel}
        descripcion={<span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold text-tinta">{g.codigo_grupo}</span>
          <Insignia color={g.estado_acta === "Abierta" ? "verde" : "gris"}>Acta {g.estado_acta.toLowerCase()}</Insignia>
        </span>}
        acciones={<BotonEnlace estilo="secundario" href={`/actas/${g.id}/imprimir` as Route}>Imprimir o guardar en PDF</BotonEnlace>} />
      {g.estado_acta === "Entregada" && (
        <Alerta tipo="info">Acta entregada el {fechaHora(g.fecha_entrega_acta)}. Ya no se puede modificar; si hay un error, avise a la Asistente de Dirección.</Alerta>
      )}
      <Seccion titulo="Datos del grupo">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Inicio">{fecha(g.fecha_inicio)}</Dato>
          <Dato etiqueta="Término">{fecha(g.fecha_termino)}</Dato>
          <Dato etiqueta="Horario">{g.modalidad} · {hora(g.hora_inicio)} a {hora(g.hora_fin)}</Dato>
          <Dato etiqueta="Sucursal">{g.sucursal}</Dato>
        </dl>
      </Seccion>
      <Seccion titulo="Notas" descripcion={acta.permisos.capturar ? "Escriba la nota o elija la condición de cada parcial y guarde por estudiante." : undefined}>
        <ActaEnPantalla acta={acta} modo="profesor" />
      </Seccion>
    </div>
  );
}
