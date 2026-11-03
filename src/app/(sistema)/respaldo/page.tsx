import type { Metadata } from "next";
import { exigirAcceso } from "@/servidor/sesion";
import { Seccion, TituloPagina } from "@/componentes/ui";
import { BotonRespaldo } from "./boton";

export const metadata: Metadata = { title: "Respaldo · SIGFIE-ADEI" };

/** CE-31 a CE-35, RNF-08: el respaldo completo en Excel, que genera la Asistente. */
export default async function PaginaRespaldo() {
  await exigirAcceso(["asistente"]);
  return (
    <div className="space-y-5">
      <TituloPagina titulo="Respaldo completo"
        descripcion="Un archivo de Excel con todos los datos de la academia, para guardarlo fuera del sistema y para analizarlo por su cuenta." />
      <Seccion titulo="Qué incluye">
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">
          <li>Una hoja por conjunto: estudiantes, tutores, grupos, inscripciones, parciales, resultados, facturas y los catálogos.</li>
          <li>Una primera hoja «Índice» con la fecha, quién lo generó y cuántas filas tiene cada hoja.</li>
          <li><strong>No incluye</strong> las cuentas de usuario ni la bitácora.</li>
          <li>Tiene datos personales de estudiantes, incluidos menores de edad: guárdelo en un lugar seguro y no lo comparta.</li>
        </ul>
        <BotonRespaldo />
      </Seccion>
    </div>
  );
}
