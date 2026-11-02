import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { rpcDeSupabase } from "@/datos/rpc";
import { misGrupos } from "@/datos/actas";
import { Alerta, Insignia, Tabla, TituloPagina } from "@/componentes/ui";
import { cantidad, fecha, hora } from "@/dominio/formato";

export const metadata: Metadata = { title: "Mis grupos · SIGFIE-ADEI" };

/** 002·CE-1 a CE-3: los grupos del profesor, con el estado y el avance de su acta. */
export default async function PaginaMisGrupos() {
  await exigirAcceso(["profesor"]);
  const r = await misGrupos(rpcDeSupabase(await clienteSesion()));
  if (!r.ok) return <><TituloPagina titulo="Mis grupos" /><Alerta tipo="cuidado">{r.mensaje}</Alerta></>;
  const grupos = r.grupos;
  const avance = (g: (typeof grupos)[number]) => g.estado_acta === "Entregada"
    ? <Insignia color="gris">Entregada</Insignia>
    : <span className="cifra text-sm">{g.completas} de {g.total} con sus tres parciales</span>;
  const enlace = (g: (typeof grupos)[number]) => `/mis-grupos/${g.id}` as Route;

  return (
    <div className="space-y-4">
      <TituloPagina titulo="Mis grupos" descripcion={cantidad(grupos.length, "grupo asignado", "grupos asignados")} />
      <Tabla vacio="No tiene grupos asignados. Si debería tenerlos, avise a la Asistente de Dirección."
        columnas={[{ titulo: "Grupo", ancho: "8.5rem" }, { titulo: "Nivel" }, { titulo: "Horario" }, { titulo: "Sucursal" },
                   { titulo: "Fechas" }, { titulo: "Acta" }]}
        filas={grupos.map((g) => [
          <Link key="c" href={enlace(g)} className="font-mono font-semibold text-azul hover:underline">{g.codigo_grupo}</Link>,
          <Link key="n" href={enlace(g)} className="font-semibold hover:underline">{g.nivel}</Link>,
          `${g.modalidad} · ${hora(g.hora_inicio)} a ${hora(g.hora_fin)}`, g.sucursal,
          `${fecha(g.fecha_inicio)} – ${fecha(g.fecha_termino)}`, avance(g)])}
        movil={grupos.map((g) => (
          <Link key={g.id} href={enlace(g)} className="block px-3 py-3 hover:bg-marino-suave">
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold text-azul">{g.nivel}</span>
              <span className="font-mono text-xs text-tinta-suave">{g.codigo_grupo}</span>
            </span>
            <span className="mt-1 block text-sm">{g.modalidad} · {hora(g.hora_inicio)} a {hora(g.hora_fin)} · {g.sucursal}</span>
            <span className="mt-1 block text-sm text-tinta-suave">{fecha(g.fecha_inicio)} – {fecha(g.fecha_termino)}</span>
            <span className="mt-1.5 block">{avance(g)}</span>
          </Link>
        ))} />
    </div>
  );
}
