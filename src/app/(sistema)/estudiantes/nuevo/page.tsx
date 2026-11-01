import type { Metadata } from "next";
import { exigirAcceso } from "@/servidor/sesion";
import { clienteSesion } from "@/servidor/supabase";
import { TituloPagina } from "@/componentes/ui";
import { FormularioEstudiante } from "./formulario";

export const metadata: Metadata = { title: "Registrar estudiante · SIGFIE-ADEI" };

export default async function PaginaNuevoEstudiante() {
  await exigirAcceso(["asistente"]);
  const supabase = await clienteSesion();
  const { data } = await supabase.from("sucursal").select("id, nombre, es_central").order("es_central", { ascending: false }).order("nombre");
  return (
    <>
      <TituloPagina titulo="Registrar estudiante" volver={{ href: "/estudiantes", texto: "Estudiantes" }}
        descripcion="El sistema le asigna el código ADEI y revisa que no esté registrado ya. Los campos con * son obligatorios." />
      <div className="max-w-4xl">
        <FormularioEstudiante sucursales={(data ?? []).map((s) => ({ valor: s.id, texto: s.es_central ? `${s.nombre} (central)` : s.nombre }))} />
      </div>
    </>
  );
}
