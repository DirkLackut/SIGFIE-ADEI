"use client";
import { useActionState } from "react";
import { accionEditar, accionVincularTutor, accionDesvincularTutor, type EstadoEdicion, type EstadoTutor } from "./acciones";
import { Campo, Selector } from "@/componentes/campos";
import { BotonConfirmar, BotonEnviar, conservarSiFalla, useErroresVivos, CampoFecha } from "@/componentes/ui-cliente";
import { useConfirmarExito } from "@/componentes/movimiento";
import { Alerta } from "@/componentes/ui";
import { hoyEnManagua } from "@/dominio/edad";

export interface DatosExpediente {
  id: string; version: number; cedula: string | null; nombres: string; apellidos: string; fecha_nacimiento: string;
  telefono: string | null; correo: string | null; direccion: string | null; contacto_emergencia: string | null; sucursal_id: string;
}

export function FormularioEdicion({ est, sucursales }: { est: DatosExpediente; sucursales: { valor: string; texto: string }[] }) {
  const [s, accion] = useActionState<EstadoEdicion, FormData>(accionEditar, {});
  const v = { ...est, ...Object.fromEntries(Object.entries(s.valores ?? {})) } as Record<string, string | number | null>;
  const { e, alEscribir } = useErroresVivos(s.errores, s);
  const val = (k: string) => (v[k] ?? "") as string;
  return (
    <form action={accion} onReset={conservarSiFalla(s.version !== undefined)} onInput={alEscribir} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={est.id} />
      <input type="hidden" name="version" value={s.version ?? est.version} />
      {s.mensaje && <Alerta tipo={s.tipo ?? "info"}>{s.mensaje}</Alerta>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nombre="nombres" etiqueta="Nombres" requerido defaultValue={val("nombres")} error={e.nombres} />
        <Campo nombre="apellidos" etiqueta="Apellidos" requerido defaultValue={val("apellidos")} error={e.apellidos} />
        <Campo nombre="cedula" etiqueta="Cédula" defaultValue={val("cedula")} error={e.cedula} ayuda="Formato 001-150190-0012K." />
        <CampoFecha nombre="fecha_nacimiento" etiqueta="Fecha de nacimiento" requerido max={hoyEnManagua(new Date())} defaultValue={val("fecha_nacimiento")} error={e.fecha_nacimiento} />
        <Campo nombre="telefono" etiqueta="Teléfono" inputMode="numeric" defaultValue={val("telefono")} error={e.telefono} ayuda="8 dígitos." />
        <Campo nombre="correo" etiqueta="Correo" type="email" defaultValue={val("correo")} error={e.correo} />
        <Campo nombre="direccion" etiqueta="Dirección" defaultValue={val("direccion")} error={e.direccion} />
        <Campo nombre="contacto_emergencia" etiqueta="Contacto de emergencia" defaultValue={val("contacto_emergencia")} error={e.contacto_emergencia} />
        <Selector nombre="sucursal_id" etiqueta="Sucursal" requerido opciones={sucursales} defaultValue={val("sucursal_id")} error={e.sucursal_id} />
      </div>
      <p className="text-xs text-tinta-suave">El código ADEI no se puede cambiar.</p>
      <BotonEnviar>Guardar cambios</BotonEnviar>
    </form>
  );
}

export function QuitarTutor({ estudianteId, tutorId, nombre }: { estudianteId: string; tutorId: string; nombre: string }) {
  const [s, accion] = useActionState<EstadoTutor, FormData>(accionDesvincularTutor, {});
  // Al quitarlo, su fila desaparece: la confirmación va en un aviso pasajero.
  useConfirmarExito(s, s.tipo === "exito", s.mensaje);
  return (
    <form action={accion} className="inline">
      <input type="hidden" name="id" value={estudianteId} />
      <input type="hidden" name="tutor_id" value={tutorId} />
      <BotonConfirmar pequeno pregunta={<>¿Quitar a {nombre} como tutor?</>} confirmar="Sí, quitar" enviando="Quitando…">Quitar</BotonConfirmar>
      {s.mensaje && s.tipo !== "exito" && <div className="mt-2"><Alerta tipo={s.tipo ?? "info"}>{s.mensaje}</Alerta></div>}
    </form>
  );
}

export function VincularTutor({ estudianteId }: { estudianteId: string }) {
  const [s, accion] = useActionState<EstadoTutor, FormData>(accionVincularTutor, {});
  const { e, alEscribir } = useErroresVivos(s.errores, s);
  useConfirmarExito(s, s.tipo === "exito", s.mensaje);
  return (
    <form action={accion} onReset={conservarSiFalla(s.tipo === "exito")} onInput={alEscribir} className="space-y-3" noValidate>
      <input type="hidden" name="id" value={estudianteId} />
      {s.mensaje && s.tipo !== "exito" && <Alerta tipo={s.tipo ?? "info"}>{s.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo nombre="tutor_cedula" etiqueta="Cédula del tutor" requerido error={e.tutor_cedula} ayuda="Si ya está registrado, basta la cédula." />
        <Campo nombre="tutor_nombre" etiqueta="Nombre completo" error={e.tutor_nombre} ayuda="Solo si es un tutor nuevo." />
        <Campo nombre="tutor_telefono" etiqueta="Teléfono" inputMode="numeric" error={e.tutor_telefono} ayuda="Solo si es un tutor nuevo." />
      </div>
      <BotonEnviar estilo="secundario" enviando="Vinculando…">Vincular tutor</BotonEnviar>
    </form>
  );
}
