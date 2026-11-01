import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { Alerta, BotonEnlace, Insignia, Tabla, TituloPagina } from "@/componentes/ui";
import { cantidad, esCodigoAdei, fecha, hora } from "@/dominio/formato";
import { hoyEnManagua } from "@/dominio/edad";

export const metadata: Metadata = { title: "Grupos · SIGFIE-ADEI" };

export type FilaGrupo = {
  id: string; codigo_grupo: string; fecha_inicio: string; fecha_termino: string; estado_acta: string;
  nivel: { nombre: string }; profesor: { nombres: string; apellidos: string }; sucursal: { nombre: string };
  horario: { hora_inicio: string; hora_fin: string; modalidad: { nombre: string } }; inscripcion: { count: number }[];
};

export default async function PaginaGrupos({ searchParams }: PageProps<"/grupos">) {
  const estado = await exigirAcceso(["asistente", "direccion"]);
  const { ver, inscribir: pedido } = await searchParams;
  const todos = ver === "todos";
  // Viene de un expediente: se elige el grupo y el estudiante ya va buscado.
  const inscribir = esCodigoAdei(pedido) ? pedido : undefined;
  const destino = (id: string) => (inscribir ? `/grupos/${id}?inscribir=${inscribir}` : `/grupos/${id}`) as Route;
  const hoy = hoyEnManagua(new Date());
  const supabase = await clienteSesion();
  let consulta = supabase.from("grupo").select(
    "id, codigo_grupo, fecha_inicio, fecha_termino, estado_acta, nivel(nombre), profesor(nombres, apellidos), sucursal(nombre), horario(hora_inicio, hora_fin, modalidad(nombre)), inscripcion(count)",
    { count: "exact" }).order("fecha_inicio", { ascending: false });
  if (!todos) consulta = consulta.eq("estado_acta", "Abierta").gte("fecha_termino", hoy);
  const { data, count } = await consulta;
  const filas = (data ?? []) as unknown as FilaGrupo[];

  const pestana = (activo: boolean) => `rounded-md px-3 py-1.5 text-sm font-semibold ${activo ? "bg-marino-suave text-azul" : "text-tinta-suave hover:bg-papel-alt"}`;
  return (
    <>
      <TituloPagina titulo="Grupos"
        descripcion="Abra el grupo para ver sus inscritos e inscribir estudiantes."
        acciones={estado.roles.includes("asistente") && <BotonEnlace href="/grupos/nuevo">+ Abrir grupo</BotonEnlace>} />
      {inscribir && (
        <div className="mb-4">
          <Alerta tipo="info" titulo={`Inscribir a ${inscribir}`}>
            Pulse el código del grupo donde lo inscribirá. <Link href="/grupos" className="font-semibold text-azul underline">Cancelar</Link>
          </Alerta>
        </div>
      )}
      <div className="mb-3 flex gap-1" role="tablist" aria-label="Qué grupos ver">
        <Link href="/grupos" className={pestana(!todos)} aria-current={!todos ? "page" : undefined}>En curso y por iniciar</Link>
        <Link href={"/grupos?ver=todos" as Route} className={pestana(todos)} aria-current={todos ? "page" : undefined}>Todos</Link>
      </div>
      <Tabla
        resumen={cantidad(count ?? filas.length, "grupo", "grupos")}
        vacio={todos ? "Todavía no hay grupos." : "No hay grupos en curso ni por iniciar."}
        columnas={[{ titulo: "Código", ancho: "8rem" }, { titulo: "Nivel" }, { titulo: "Modalidad y horario" }, { titulo: "Profesor" },
                   { titulo: "Sucursal" }, { titulo: "Fechas" }, { titulo: "Inscritos", derecha: true }, { titulo: "Acta" }]}
        filas={filas.map((g) => [
          <Link key="c" href={destino(g.id)} className="font-mono font-semibold text-azul hover:underline">{g.codigo_grupo}</Link>,
          g.nivel?.nombre,
          `${g.horario?.modalidad?.nombre} · ${hora(g.horario.hora_inicio)} – ${hora(g.horario.hora_fin)}`,
          `${g.profesor?.nombres} ${g.profesor?.apellidos}`,
          g.sucursal?.nombre,
          <span key="f" className="whitespace-nowrap">{fecha(g.fecha_inicio)} – {fecha(g.fecha_termino)}</span>,
          g.inscripcion?.[0]?.count ?? 0,
          <Insignia key="a" color={g.estado_acta === "Abierta" ? "verde" : "gris"}>{g.estado_acta}</Insignia>,
        ])}
        movil={filas.map((g) => (
          <Link key={g.id} href={destino(g.id)} className="block px-3 py-2.5 hover:bg-papel-alt active:bg-marino-suave">
            <span className="flex items-start justify-between gap-2">
              <span className="font-semibold">{g.nivel?.nombre}</span>
              <span className="font-mono text-xs font-semibold text-azul">{g.codigo_grupo}</span>
            </span>
            <span className="mt-0.5 block text-xs text-tinta-suave">
              {g.horario?.modalidad?.nombre} · {hora(g.horario.hora_inicio)} – {hora(g.horario.hora_fin)} · {g.sucursal?.nombre}
            </span>
            <span className="mt-0.5 block text-xs text-tinta-suave">
              {g.profesor?.nombres} {g.profesor?.apellidos} · {fecha(g.fecha_inicio)} – {fecha(g.fecha_termino)} · {cantidad(g.inscripcion?.[0]?.count ?? 0, "inscrito", "inscritos")}
            </span>
          </Link>
        ))} />
    </>
  );
}
