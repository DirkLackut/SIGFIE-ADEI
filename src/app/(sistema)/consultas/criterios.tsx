"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Selector } from "@/componentes/campos";
import { CampoFecha } from "@/componentes/ui-cliente";
import { claseBoton } from "@/componentes/ui";
import {
  cambiarCriterio, haciaDireccion, horariosDe, nivelesDe, revisarCoherencia,
  ESTADOS_ACADEMICOS, ESTADOS_INSCRIPCION, ESTADOS_MATRICULA,
  type CatalogoFiltro, type Clave, type EstadoFiltro,
} from "@/dominio/filtro";
import { hora } from "@/dominio/formato";

/**
 * Criterios del filtrado (CE-1, CE-6 a CE-8, CE-22). Las listas dependientes se
 * filtran aquí (horario según modalidad, nivel según programa) y la base vuelve a
 * comprobarlo. Al filtrar se navega a la dirección con los criterios (CE-23).
 */
export function Criterios({ inicial, cat, programas, errorBase }: {
  inicial: EstadoFiltro; cat: CatalogoFiltro; programas: string[]; errorBase?: { campo: string; mensaje: string };
}) {
  const router = useRouter();
  const [e, setE] = useState(inicial);
  const [errores, setErrores] = useState<Partial<Record<Clave, string>>>(
    errorBase ? { [errorBase.campo]: errorBase.mensaje } as Partial<Record<Clave, string>> : {});
  const c = e.criterios;
  const poner = (k: Clave) => (ev: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setE(cambiarCriterio(e, k, ev.target.value, cat));
    setErrores((x) => ({ ...x, [k]: undefined }));
  };
  const filtrar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const r = revisarCoherencia(c, cat);
    setErrores(r);
    if (Object.keys(r).length) return;
    const q = haciaDireccion({ ...e, pagina: 1 });
    router.push((q ? `/consultas?${q}` : "/consultas") as Route);
  };
  const opciones = <T,>(lista: T[], f: (x: T) => { valor: string; texto: string }) => lista.map(f);

  return (
    <form onSubmit={filtrar} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Selector nombre="sucursal_id" etiqueta="Sucursal" vacio="Todas" value={c.sucursal_id ?? ""} onChange={poner("sucursal_id")}
          error={errores.sucursal_id} opciones={opciones(cat.sucursales, (s) => ({ valor: s.id, texto: s.nombre }))}
          ayuda={e.vista === "estudiantes" ? "La del estudiante" : "La del grupo"} />
        <Selector nombre="programa" etiqueta="Programa" vacio="Todos" value={c.programa ?? ""} onChange={poner("programa")}
          error={errores.programa} opciones={programas.map((p) => ({ valor: p, texto: p }))} />
        <Selector nombre="nivel_id" etiqueta="Nivel" vacio="Todos" value={c.nivel_id ?? ""} onChange={poner("nivel_id")}
          error={errores.nivel_id} opciones={opciones(nivelesDe(c.programa, cat.niveles), (n) => ({ valor: n.id, texto: c.programa ? n.nombre : `${n.nombre} · ${n.programa}` }))} />
        <Selector nombre="modalidad_id" etiqueta="Modalidad" vacio="Todas" value={c.modalidad_id ?? ""} onChange={poner("modalidad_id")}
          error={errores.modalidad_id} opciones={opciones(cat.modalidades, (m) => ({ valor: m.id, texto: m.nombre }))} />
        <Selector nombre="horario_id" etiqueta="Horario" vacio="Todos" value={c.horario_id ?? ""} onChange={poner("horario_id")}
          error={errores.horario_id}
          opciones={opciones(horariosDe(c.modalidad_id, cat.horarios), (h) => ({ valor: h.id,
            texto: `${hora(h.hora_inicio)} – ${hora(h.hora_fin)}${c.modalidad_id ? "" : ` · ${cat.modalidades.find((m) => m.id === h.modalidad_id)?.nombre ?? ""}`}` }))} />
        <Selector nombre="profesor_id" etiqueta="Profesor" vacio="Todos" value={c.profesor_id ?? ""} onChange={poner("profesor_id")}
          error={errores.profesor_id} opciones={opciones(cat.profesores, (p) => ({ valor: p.id, texto: `${p.apellidos}, ${p.nombres}` }))} />
        <Selector nombre="estado_matricula" etiqueta="Estado de matrícula" vacio="Todos" value={c.estado_matricula ?? ""}
          onChange={poner("estado_matricula")} opciones={ESTADOS_MATRICULA.map((x) => ({ valor: x, texto: x }))} />
        <Selector nombre="estado_inscripcion" etiqueta="Estado de inscripción" vacio="Todos" value={c.estado_inscripcion ?? ""}
          onChange={poner("estado_inscripcion")} opciones={ESTADOS_INSCRIPCION.map((x) => ({ valor: x, texto: x }))} />
        <Selector nombre="estado_academico" etiqueta="Estado académico" vacio="Todos" value={c.estado_academico ?? ""}
          onChange={poner("estado_academico")} opciones={ESTADOS_ACADEMICOS.map((x) => ({ valor: x, texto: x }))} />
        <CampoFecha nombre="desde" etiqueta="En curso desde" value={c.desde ?? ""} onChange={poner("desde")} error={errores.desde} />
        <CampoFecha nombre="hasta" etiqueta="En curso hasta" value={c.hasta ?? ""} onChange={poner("hasta")} error={errores.hasta}
          ayuda="Grupos en curso algún día del rango" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={claseBoton("primario")}>Filtrar</button>
        {Object.keys(c).length > 0 && (
          <button type="button" className={claseBoton("secundario")}
                  onClick={() => router.push((e.vista === "estudiantes" ? "/consultas?vista=estudiantes" : "/consultas") as Route)}>
            Quitar los criterios
          </button>
        )}
      </div>
    </form>
  );
}
