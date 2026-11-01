"use client";
import { useActionState } from "react";
import { accionIngresar, type EstadoIngreso } from "./acciones";
import { Campo } from "@/componentes/campos";
import { BotonEnviar, CampoContrasena } from "@/componentes/ui-cliente";
import { Alerta } from "@/componentes/ui";

export function FormularioIngreso() {
  const [estado, accion] = useActionState<EstadoIngreso, FormData>(accionIngresar, {});
  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje && <Alerta tipo="cuidado" titulo="No se pudo ingresar">{estado.mensaje}</Alerta>}
      <Campo nombre="usuario" etiqueta="Usuario" requerido autoComplete="username" autoCapitalize="none"
             spellCheck={false} defaultValue={estado.usuario} autoFocus />
      <CampoContrasena nombre="contrasena" etiqueta="Contraseña" autoComplete="current-password" />
      <div className="pt-1 max-sm:[&>button]:w-full"><BotonEnviar enviando="Ingresando…">Ingresar</BotonEnviar></div>
    </form>
  );
}
