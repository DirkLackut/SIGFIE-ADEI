import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerEstado } from "@/servidor/sesion";
import { Alerta } from "@/componentes/ui";
import { FormularioCambio } from "./formulario";

export const metadata: Metadata = { title: "Cambiar contraseña · SIGFIE-ADEI" };

/** CE-9 (obligatorio con contraseña temporal) y CE-78 (cualquiera, cuando quiera). */
export default async function PaginaCambio() {
  const estado = await obtenerEstado();
  if (!estado?.cuenta) redirect("/ingresar");
  const obligatorio = estado.debe_cambiar;
  return (
    <div className="mx-auto max-w-md rounded-lg border border-borde bg-papel p-5 sm:p-8">
      {!obligatorio && estado.aviso_aceptado && (
        <Link href="/inicio" className="mb-3 inline-block text-sm font-medium text-azul hover:underline">← Volver al inicio</Link>
      )}
      <h1 className="font-titulo text-2xl font-bold text-marino">{obligatorio ? "Elija su contraseña" : "Cambiar contraseña"}</h1>
      <div className="mt-3 mb-6">
        {obligatorio ? (
          <Alerta tipo="info">
            Ingresó con una contraseña temporal. Antes de continuar, elija una propia que solo usted conozca.
          </Alerta>
        ) : (
          <p className="text-sm text-tinta-suave">La contraseña nueva reemplaza a la actual desde ahora.</p>
        )}
      </div>
      <FormularioCambio />
    </div>
  );
}
