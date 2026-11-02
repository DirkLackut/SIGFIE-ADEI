import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { Alerta, BotonEnlace, Dato, Insignia, Seccion, Tabla, TituloPagina } from "@/componentes/ui";
import { cantidad, esCodigoAdei, esUuid, fecha, fechaHora, hora } from "@/dominio/formato";
import { rpcDeSupabase } from "@/datos/rpc";
import { actaDelGrupo } from "@/datos/actas";
import { ActaEnPantalla, TablaResumen } from "@/componentes/acta";
import { hoyEnManagua } from "@/dominio/edad";
import { Anular, CambiarProfesor, Inscribir } from "./cliente";
import { Desplegable } from "@/componentes/movimiento";

export const metadata: Metadata = { title: "Grupo · SIGFIE-ADEI" };

type Grupo = {
  id: string; codigo_grupo: string; fecha_inicio: string; fecha_termino: string; estado_acta: string; profesor_id: string;
  nivel: { nombre: string; programa: string }; profesor: { nombres: string; apellidos: string }; sucursal: { nombre: string };
  horario: { hora_inicio: string; hora_fin: string; modalidad: { nombre: string; dias_de_clase: string } };
};

export default async function PaginaGrupo({ params, searchParams }: PageProps<"/grupos/[id]">) {
  const estado = await exigirAcceso(["asistente", "direccion"]);
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const { abierto, inscribir } = await searchParams;
  const s = await clienteSesion();
  const [{ data }, { data: inscritos }, { data: profesores }, acta] = await Promise.all([
    s.from("grupo").select("id, codigo_grupo, fecha_inicio, fecha_termino, estado_acta, profesor_id, nivel(nombre, programa), profesor(nombres, apellidos), sucursal(nombre), horario(hora_inicio, hora_fin, modalidad(nombre, dias_de_clase))").eq("id", id).maybeSingle(),
    s.from("inscripcion").select("id, fecha_inscripcion, estado_inscripcion, estudiante(id, codigo_adei, nombres, apellidos)").eq("grupo_id", id).order("fecha_inscripcion"),
    s.from("profesor").select("id, nombres, apellidos").eq("activo", true).order("apellidos"),
    actaDelGrupo(rpcDeSupabase(s), id),
  ]);
  if (!data) notFound();
  const g = data as unknown as Grupo;
  const asistente = estado.roles.includes("asistente");
  const terminado = g.fecha_termino < hoyEnManagua(new Date());
  const editable = asistente && g.estado_acta === "Abierta";
  const filas = (inscritos ?? []) as unknown as { id: string; fecha_inscripcion: string; estado_inscripcion: string;
    estudiante: { id: string; codigo_adei: string; nombres: string; apellidos: string } }[];

  return (
    <div className="space-y-5">
      <TituloPagina volver={{ href: "/grupos", texto: "Grupos" }} titulo={`${g.nivel.nombre}`}
        descripcion={<span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold text-tinta">{g.codigo_grupo}</span>
          <Insignia color={g.estado_acta === "Abierta" ? "verde" : "gris"}>Acta {g.estado_acta.toLowerCase()}</Insignia>
          {terminado && <Insignia color="dorado">Terminado</Insignia>}
        </span>} />
      {abierto !== undefined && <Alerta tipo="exito">Grupo abierto con el código <strong className="font-mono">{g.codigo_grupo}</strong>. Ya puede inscribir estudiantes.</Alerta>}

      <Seccion titulo="Datos del grupo">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Programa">{g.nivel.programa}</Dato>
          <Dato etiqueta="Modalidad">{g.horario.modalidad.nombre} ({g.horario.modalidad.dias_de_clase})</Dato>
          <Dato etiqueta="Horario">{hora(g.horario.hora_inicio)} a {hora(g.horario.hora_fin)}</Dato>
          <Dato etiqueta="Fechas">{fecha(g.fecha_inicio)} – {fecha(g.fecha_termino)}</Dato>
          <Dato etiqueta="Profesor">{g.profesor.nombres} {g.profesor.apellidos}</Dato>
          <Dato etiqueta="Sucursal">{g.sucursal.nombre}</Dato>
        </dl>
        {editable && (
          <div className="mt-5"><Desplegable titulo="Cambiar profesor">
            <CambiarProfesor grupoId={g.id} profesores={(profesores ?? []).filter((p) => p.id !== g.profesor_id)
                .map((p) => ({ valor: p.id, texto: `${p.apellidos}, ${p.nombres}` }))} />
          </Desplegable></div>
        )}
      </Seccion>

      <Seccion titulo="Inscritos" descripcion={cantidad(filas.length, "estudiante", "estudiantes")}>
        {editable && !terminado && <div className="mb-5"><Inscribir grupoId={g.id} inscritos={filas.map((i) => i.estudiante.id)} inicial={esCodigoAdei(inscribir) ? inscribir : undefined} /></div>}
        {editable && terminado && <div className="mb-4"><Alerta tipo="info">El grupo ya terminó: no admite inscripciones nuevas.</Alerta></div>}
        {asistente && g.estado_acta !== "Abierta" && <div className="mb-4"><Alerta tipo="info">El acta fue entregada: no se pueden inscribir ni anular inscripciones.</Alerta></div>}
        <Tabla vacio="Este grupo todavía no tiene inscritos."
          columnas={[{ titulo: "N.º", ancho: "3rem", derecha: true }, { titulo: "Código ADEI", ancho: "10rem" }, { titulo: "Apellidos y nombres" },
                     { titulo: "Inscrito el" }, { titulo: "Estado" }, ...(editable ? [{ titulo: "" }] : [])]}
          filas={filas.map((i, n) => [n + 1,
            <Link key="c" href={`/estudiantes/${i.estudiante.id}` as Route} className="font-mono font-semibold text-azul hover:underline">{i.estudiante.codigo_adei}</Link>,
            `${i.estudiante.apellidos}, ${i.estudiante.nombres}`, fecha(i.fecha_inscripcion), i.estado_inscripcion,
            ...(editable ? [<Anular key="a" grupoId={g.id} inscripcionId={i.id} />] : [])])} />
      </Seccion>

      {/* 002·CE-29 a CE-41, CE-48, CE-49, CE-58: el acta, para la Asistente y Dirección. */}
      {acta.estado === "ok" && (
        <Seccion titulo="Acta" descripcion={g.estado_acta === "Entregada"
            ? `Entregada el ${fechaHora(acta.grupo.fecha_entrega_acta)}.${asistente ? " Puede corregir un parcial con un motivo." : ""}`
            : "Las notas las registra el profesor del grupo."}
          acciones={<BotonEnlace estilo="secundario" href={`/actas/${g.id}/imprimir` as Route}>Imprimir o guardar en PDF</BotonEnlace>}>
          <div className="space-y-4">
            <TablaResumen resumen={acta.resumen} />
            <ActaEnPantalla acta={acta} modo={asistente ? "asistente" : "lectura"} />
          </div>
        </Seccion>
      )}
      {acta.estado === "error" && <Alerta tipo="cuidado">No se pudo cargar el acta: {acta.mensaje}</Alerta>}
    </div>
  );
}
