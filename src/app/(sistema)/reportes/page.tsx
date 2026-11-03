import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { reporteSucursales, type ConteoSucursal } from "@/datos/consultas";
import { Alerta, Seccion, Tabla, TituloPagina } from "@/componentes/ui";
import { Selector } from "@/componentes/campos";
import { Cifra, FormularioPeriodo } from "@/componentes/periodo";
import { mesEnCurso, describirPeriodo } from "@/dominio/periodo";
import { hoyEnManagua } from "@/dominio/edad";
import { haciaDireccion } from "@/dominio/filtro";
import { esUuid } from "@/dominio/formato";

export const metadata: Metadata = { title: "Reporte por sucursal · SIGFIE-ADEI" };

const ESTADOS = [["Activo", "activos", "bg-marino"], ["Desertor", "desertores", "bg-dorado"], ["Egresado", "egresados", "bg-azul"]] as const;

/**
 * CE-81 a CE-88: estudiantes por sucursal (estado de hoy) y movimientos del
 * período. Cada cifra del estado de hoy abre el filtrado que la produce (CE-88).
 */
export default async function PaginaReportes({ searchParams }: PageProps<"/reportes">) {
  await exigirAcceso(["asistente", "direccion"]);
  const sp = await searchParams;
  const mes = mesEnCurso(hoyEnManagua(new Date()));
  const desde = typeof sp.desde === "string" && sp.desde ? sp.desde : mes.desde;
  const hasta = typeof sp.hasta === "string" && sp.hasta ? sp.hasta : mes.hasta;
  const sucursal = typeof sp.sucursal === "string" && esUuid(sp.sucursal) ? sp.sucursal : null;
  const supabase = await clienteSesion();
  const [r, { data: sucursales }] = await Promise.all([
    reporteSucursales(rpcDeSupabase(supabase), desde, hasta, sucursal),
    supabase.from("sucursal").select("id, nombre").order("es_central", { ascending: false }).order("nombre"),
  ]);
  const enlace = (sucursalId: string, estado: string) =>
    `/consultas?${haciaDireccion({ criterios: { sucursal_id: sucursalId, estado_matricula: estado }, vista: "estudiantes", pagina: 1 })}` as Route;

  return (
    <div className="space-y-5">
      <TituloPagina titulo="Reporte por sucursal"
        descripcion="Cuántos estudiantes hay hoy en cada estado, y qué se movió en el período. Cada cifra de hoy abre el listado que la produce." />
      <Seccion titulo="Período y sucursal">
        <FormularioPeriodo desde={desde} hasta={hasta} extra={
          <div className="w-52"><Selector nombre="sucursal" etiqueta="Sucursal" vacio="Todas" defaultValue={sucursal ?? ""}
            opciones={(sucursales ?? []).map((s) => ({ valor: s.id, texto: s.nombre }))} /></div>} />
      </Seccion>
      {r.estado === "error" && <Alerta tipo="cuidado">{r.mensaje}</Alerta>}
      {r.estado === "no_existe" && <Alerta tipo="cuidado">Esa sucursal no existe.</Alerta>}
      {r.estado === "denegado" && <Alerta tipo="cuidado">El reporte es para la Asistente de Dirección y para Dirección.</Alerta>}
      {r.estado === "incompleto" && <Alerta tipo="cuidado" titulo="Los totales no cuadran">No se muestra el reporte. El incidente quedó registrado; intente de nuevo.</Alerta>}
      {r.estado === "ok" && (
        <>
          {r.sin_datos && <Alerta tipo="info">Sin datos en el período: los conteos están en 0.</Alerta>}
          <section aria-label="Totales de hoy" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Cifra nombre="Activos" valor={r.totales.activos} />
            <Cifra nombre="Desertores" valor={r.totales.desertores} />
            <Cifra nombre="Egresados" valor={r.totales.egresados} />
            <Cifra nombre="Total" valor={r.totales.total} />
          </section>

          <Seccion titulo="Estado de hoy, por sucursal">
            <ul className="space-y-4">
              {r.sucursales.map((f) => (
                <li key={f.sucursal_id}>
                  <p className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-semibold">{f.sucursal}</span>
                    <span className="cifra text-tinta-suave">{f.total.toLocaleString("en-US")} estudiantes</span>
                  </p>
                  <Barras f={f} maximo={Math.max(1, ...r.sucursales.map((x) => x.total))} />
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {ESTADOS.map(([estado, clave, color]) => (
                      <Link key={estado} href={enlace(f.sucursal_id, estado)} className="inline-flex items-center gap-1.5 text-azul hover:underline">
                        <span aria-hidden className={`inline-block size-2.5 rounded-sm ${color}`} />
                        {estado === "Activo" ? "Activos" : estado === "Desertor" ? "Desertores" : "Egresados"}: <span className="cifra font-semibold">{f[clave].toLocaleString("en-US")}</span>
                      </Link>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          </Seccion>

          <Seccion titulo={`Movimientos · ${describirPeriodo(r.desde, r.hasta)}`}
            descripcion="Solo se conoce el último cambio de estado de cada estudiante: quien desertó y volvió en el mismo período cuenta como Activo.">
            <Tabla vacio="Sin sucursales."
              columnas={[{ titulo: "Sucursal" }, { titulo: "Registrados", derecha: true }, { titulo: "Pasaron a Desertor", derecha: true },
                { titulo: "Pasaron a Egresado", derecha: true }]}
              filas={[...r.sucursales.map((f) => [f.sucursal, f.registrados, f.a_desertor, f.a_egresado]),
                [<strong key="t">Total</strong>, <strong key="r">{r.totales.registrados}</strong>, <strong key="d">{r.totales.a_desertor}</strong>,
                 <strong key="e">{r.totales.a_egresado}</strong>]]} />
          </Seccion>
        </>
      )}
    </div>
  );
}

/** Barra apilada proporcional al total de la sucursal más grande; los números van al lado (CE-87). */
function Barras({ f, maximo }: { f: ConteoSucursal; maximo: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-sm bg-papel-alt" role="img"
         aria-label={`Activos ${f.activos}, desertores ${f.desertores}, egresados ${f.egresados}`}>
      {ESTADOS.map(([estado, clave, color]) => (
        <span key={estado} className={color} style={{ width: `${(f[clave] / maximo) * 100}%` }} />
      ))}
    </div>
  );
}
