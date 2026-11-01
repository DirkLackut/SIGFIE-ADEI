import type { Metadata } from "next";
import { exigirAcceso } from "@/servidor/sesion";
import { BotonEnlace, TituloPagina } from "@/componentes/ui";
import { Buscador } from "./buscador";

export const metadata: Metadata = { title: "Estudiantes · SIGFIE-ADEI" };

export default async function PaginaEstudiantes({ searchParams }: PageProps<"/estudiantes">) {
  const estado = await exigirAcceso(["asistente", "direccion"]);
  const { q } = await searchParams;
  return (
    <>
      <TituloPagina titulo="Estudiantes"
        descripcion="Busque un expediente. Para registrar a alguien, búsquelo primero: así se evita duplicarlo."
        acciones={estado.roles.includes("asistente") && <BotonEnlace href="/estudiantes/nuevo">+ Registrar estudiante</BotonEnlace>} />
      <Buscador textoInicial={typeof q === "string" ? q : ""} />
    </>
  );
}
