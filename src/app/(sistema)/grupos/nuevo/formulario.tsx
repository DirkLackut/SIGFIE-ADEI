"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { accionAbrirGrupo, type EstadoNuevoGrupo } from "./acciones";
import { Campo, Selector } from "@/componentes/campos";
import { BotonEnviar, conservarSiFalla } from "@/componentes/ui-cliente";
import { Alerta, BarraAcciones, claseBoton } from "@/componentes/ui";
import { hora } from "@/dominio/formato";

type Op = { valor: string; texto: string };
export interface Catalogo {
  niveles: { id: string; nombre: string; programa: string }[];
  modalidades: { id: string; nombre: string; dias_de_clase: string; horarios: { id: string; hora_inicio: string; hora_fin: string }[] }[];
  profesores: Op[]; sucursales: Op[];
}

/** Abrir grupo. Al elegir la modalidad solo se ofrecen SUS horarios (CE-49). */
export function FormularioGrupo({ cat }: { cat: Catalogo }) {
  const [s, accion] = useActionState<EstadoNuevoGrupo, FormData>(accionAbrirGrupo, {});
  const v = s.valores ?? {}; const e = s.errores ?? {};
  const [modalidad, setModalidad] = useState(v.modalidad_id ?? "");
  const mod = cat.modalidades.find((m) => m.id === modalidad);
  const programas = [...new Set(cat.niveles.map((n) => n.programa))];

  return (
    <form action={accion} onReset={conservarSiFalla()} className="space-y-5" noValidate>
      {s.mensaje && <Alerta tipo="cuidado" titulo="No se abrió el grupo">{s.mensaje}</Alerta>}
      <fieldset className="grid gap-4 rounded-lg border border-borde bg-papel p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Qué y quién</legend>
        <div>
          <label htmlFor="nivel_id" className="mb-1 block text-sm font-semibold">Nivel <span className="text-dorado-texto">*</span></label>
          <select id="nivel_id" name="nivel_id" defaultValue={v.nivel_id ?? ""} className="campo-entrada" aria-invalid={e.nivel_id ? true : undefined}>
            <option value="">Seleccione…</option>
            {programas.map((p) => (
              <optgroup key={p} label={p}>
                {cat.niveles.filter((n) => n.programa === p).map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
              </optgroup>
            ))}
          </select>
          {e.nivel_id && <p className="mt-1 text-sm font-medium text-dorado-texto">⚠ {e.nivel_id}</p>}
        </div>
        <Selector nombre="profesor_id" etiqueta="Profesor" requerido opciones={cat.profesores} defaultValue={v.profesor_id} error={e.profesor_id}
                  ayuda="Solo aparecen los profesores activos del catálogo." />
        <Selector nombre="sucursal_id" etiqueta="Sucursal" requerido opciones={cat.sucursales} defaultValue={v.sucursal_id} error={e.sucursal_id} />
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border border-borde bg-papel p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Cuándo</legend>
        <Selector nombre="modalidad_id" etiqueta="Modalidad" requerido error={e.modalidad_id} value={modalidad}
                  onChange={(ev) => setModalidad(ev.currentTarget.value)}
                  opciones={cat.modalidades.map((m) => ({ valor: m.id, texto: `${m.nombre} (${m.dias_de_clase})` }))} />
        <Selector key={modalidad} nombre="horario_id" etiqueta="Horario" requerido error={e.horario_id}
                  defaultValue={mod?.horarios.some((h) => h.id === v.horario_id) ? v.horario_id : ""}
                  disabled={!mod} vacio={mod ? "Seleccione…" : "Primero elija la modalidad"}
                  opciones={(mod?.horarios ?? []).map((h) => ({ valor: h.id, texto: `${hora(h.hora_inicio)} a ${hora(h.hora_fin)}` }))} />
        <Campo nombre="fecha_inicio" etiqueta="Fecha de inicio" requerido type="date" defaultValue={v.fecha_inicio} error={e.fecha_inicio}
               ayuda="Puede ser anterior a hoy si el grupo ya empezó." />
        <Campo nombre="fecha_termino" etiqueta="Fecha de término" requerido type="date" defaultValue={v.fecha_termino} error={e.fecha_termino}
               ayuda="Debe ser posterior al inicio y no haber pasado." />
      </fieldset>

      <BarraAcciones>
        <BotonEnviar enviando="Abriendo…">Abrir grupo</BotonEnviar>
        <Link href="/grupos" className={claseBoton("secundario")}>Cancelar</Link>
      </BarraAcciones>
    </form>
  );
}
