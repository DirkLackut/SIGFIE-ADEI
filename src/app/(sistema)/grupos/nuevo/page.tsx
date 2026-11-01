import type { Metadata } from "next";
import { opcionSucursal } from "@/dominio/formato";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { Alerta, BotonEnlace, TituloPagina } from "@/componentes/ui";
import { FormularioGrupo, type Catalogo } from "./formulario";

export const metadata: Metadata = { title: "Abrir grupo · SIGFIE-ADEI" };

/** CE-21, CE-24: todo sale de los catálogos, y solo lo activo. */
export default async function PaginaNuevoGrupo() {
  await exigirAcceso(["asistente"]);
  const s = await clienteSesion();
  const [niveles, modalidades, profesores, sucursales] = await Promise.all([
    s.from("nivel").select("id, nombre, programa, orden").eq("activo", true).order("programa").order("orden"),
    s.from("modalidad").select("id, nombre, dias_de_clase, horario(id, hora_inicio, hora_fin, activo)").eq("activo", true).order("nombre"),
    s.from("profesor").select("id, nombres, apellidos").eq("activo", true).order("apellidos"),
    s.from("sucursal").select("id, nombre, es_central").order("es_central", { ascending: false }).order("nombre"),
  ]);
  const cat: Catalogo = {
    niveles: niveles.data ?? [],
    modalidades: (modalidades.data ?? []).map((m) => ({ ...m,
      horarios: ((m.horario ?? []) as { id: string; hora_inicio: string; hora_fin: string; activo: boolean }[])
        .filter((h) => h.activo).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)) })),
    profesores: (profesores.data ?? []).map((p) => ({ valor: p.id, texto: `${p.apellidos}, ${p.nombres}` })),
    sucursales: (sucursales.data ?? []).map(opcionSucursal),
  };
  return (
    <>
      <TituloPagina titulo="Abrir grupo" volver={{ href: "/grupos", texto: "Grupos" }}
        descripcion="El sistema le asigna el código y deja su acta abierta para inscribir." />
      {cat.profesores.length === 0 && (
        <div className="mb-4"><Alerta tipo="cuidado" titulo="No hay profesores activos">
          Registre al menos uno en el catálogo antes de abrir un grupo. <BotonEnlace href="/catalogos?ver=profesores" estilo="secundario">Ir a profesores</BotonEnlace>
        </Alerta></div>
      )}
      <div className="max-w-4xl"><FormularioGrupo cat={cat} /></div>
    </>
  );
}
