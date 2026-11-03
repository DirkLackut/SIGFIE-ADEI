/**
 * Hoja de matrícula prellenada (spec 003, CE-44 a CE-49; docs/formatos/README.md).
 * Reproduce el formato impreso de ADEI con sus tres secciones. Tres clases de campo:
 *   · dato: lo que el sistema registra y este estudiante tiene;
 *   · sin_registro: lo que el sistema registra pero este estudiante no tiene (CE-46);
 *   · en_blanco: lo que el sistema no registra para nadie, para llenarse a mano (CE-47).
 * «Estado civil» y «Padece de alguna enfermedad» no se imprimen (CE-48, RN-21).
 */
import { fecha, hora, telefono } from "./formato";
import { formatoMonto } from "./factura";

export const SIN_REGISTRO = "sin registro";

export interface DatosHoja {
  alumno: { nombres: string; apellidos: string; fecha_nacimiento: string; edad: number; direccion: string | null;
    cedula: string | null; telefono: string | null; correo: string | null; contacto_emergencia: string | null;
    codigo_adei: string; fecha_ingreso: string; id?: string };
  tutor: { nombre_completo: string; cedula: string; telefono: string } | null;
  tutores_adicionales: number;
  academia: { nivel: string; curso: string; modalidad: string; hora_inicio: string; hora_fin: string; fecha_inicio: string;
    fecha_termino: string; profesor: string; sucursal: string; codigo_grupo: string; grupo_id?: string; inscrito_por: string | null;
    recibo: string | null; paga: { monto: number; moneda: string } | null };
}

export interface Campo { etiqueta: string; valor: string; tipo: "dato" | "sin_registro" | "en_blanco" }

const dato = (etiqueta: string, v: string | null | undefined): Campo =>
  v ? { etiqueta, valor: v, tipo: "dato" } : { etiqueta, valor: SIN_REGISTRO, tipo: "sin_registro" };
const blanco = (etiqueta: string): Campo => ({ etiqueta, valor: "", tipo: "en_blanco" });

export function componerHoja(d: DatosHoja) {
  const { alumno: a, tutor: t, academia: c } = d;
  const extra = d.tutores_adicionales;
  return {
    codigo_adei: a.codigo_adei,
    codigo_grupo: c.codigo_grupo,
    sucursal: c.sucursal,
    recuadroFoto: true,
    secciones: {
      alumno: [
        dato("Nombres completos", a.nombres), dato("Apellidos", a.apellidos),
        dato("Fecha de nacimiento", fecha(a.fecha_nacimiento)), dato("Edad", `${a.edad} años`),
        dato("Dirección", a.direccion), blanco("Lugar donde vive"), dato("Cédula del alumno N.º", a.cedula),
        dato("N.º Celular del alumno", telefono(a.telefono)), blanco("Nivel de escolaridad"), dato("Correo electrónico", a.correo),
      ],
      tutor: [
        dato("Nombre del tutor", t?.nombre_completo), dato("N.º Celular del tutor", telefono(t?.telefono)),
        dato("Cédula del tutor", t?.cedula), dato("En caso de emergencia llamar a", a.contacto_emergencia),
      ],
      academia: [
        dato("Fecha de ingreso", fecha(a.fecha_ingreso)), dato("N.º Recibo", c.recibo), dato("Nivel", c.nivel),
        dato("Horario", `${c.modalidad}, ${hora(c.hora_inicio)} – ${hora(c.hora_fin)}`),
        dato("Inicio nivel", fecha(c.fecha_inicio)), dato("Término nivel", fecha(c.fecha_termino)),
        dato("Profesor", c.profesor), dato("Curso", c.curso), dato("Inscrito por", c.inscrito_por),
        dato("Paga", c.paga ? formatoMonto(Number(c.paga.monto), c.paga.moneda) : null),
      ],
    },
    requisitos: ["Fotocopia de cédula", "Tutor", "Part. nacimiento", "Foto"],
    notaTutores: extra > 0 ? `El estudiante tiene ${extra} ${extra === 1 ? "tutor más registrado" : "tutores más registrados"} en el sistema.` : null,
  };
}
