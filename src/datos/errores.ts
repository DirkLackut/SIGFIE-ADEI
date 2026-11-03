/**
 * Traduce un error de la base a un mensaje para la persona y, si se puede, al
 * campo del formulario que lo causó (CE-37: "indicará el campo y la regla").
 *
 * La base es la que decide (principio 1); aquí solo se le pone nombre humano a
 * lo que la base ya rechazó. Los mensajes que la base escribe en español (los de
 * los triggers y funciones) se muestran tal cual.
 */
import type { ErrorBD } from "./rpc";

export interface ErrorTraducido { campo?: string; mensaje: string }

const POR_RESTRICCION: Record<string, ErrorTraducido> = {
  estudiante_cedula_formato:   { campo: "cedula", mensaje: "Debe tener el formato 000-000000-0000A." },
  estudiante_cedula_unica:     { campo: "cedula", mensaje: "Esa cédula ya pertenece a otro estudiante." },
  estudiante_nombres_formato:  { campo: "nombres", mensaje: "Solo letras, espacios y apóstrofos, de 2 a 60 caracteres." },
  estudiante_apellidos_formato:{ campo: "apellidos", mensaje: "Solo letras, espacios y apóstrofos, de 2 a 60 caracteres." },
  estudiante_telefono_formato: { campo: "telefono", mensaje: "Debe tener 8 dígitos, sin espacios ni guiones." },
  estudiante_correo_formato:   { campo: "correo", mensaje: "No es un correo válido (ejemplo: nombre@correo.com)." },
  tutor_cedula_formato:        { campo: "tutor_cedula", mensaje: "Debe tener el formato 000-000000-0000A." },
  tutor_telefono_formato:      { campo: "tutor_telefono", mensaje: "Debe tener 8 dígitos, sin espacios ni guiones." },
  tutor_cedula_unica:          { campo: "tutor_cedula", mensaje: "Ya hay un tutor con esa cédula." },
  grupo_termino_despues_de_inicio: { campo: "fecha_termino", mensaje: "Debe ser posterior a la fecha de inicio." },
  horario_fin_despues_de_inicio:   { campo: "hora_fin", mensaje: "Debe ser posterior a la hora de inicio." },
  horario_unico:               { mensaje: "Esa modalidad ya tiene un horario con la misma hora de inicio y de fin." },
  inscripcion_unica:           { mensaje: "El estudiante ya está inscrito en este grupo." },
  inscripcion_observacion_obligatoria: { campo: "observaciones", mensaje: "Escriba la observación." },
  modalidad_nombre_unico:      { campo: "nombre", mensaje: "Ya existe una modalidad con ese nombre." },
  sucursal_nombre_unico:       { campo: "nombre", mensaje: "Ya existe una sucursal con ese nombre." },
  sucursal_una_central:        { mensaje: "Ya hay una sucursal central." },
  nivel_nombre_unico:          { campo: "nombre", mensaje: "Ya existe un nivel con ese nombre." },
  nivel_codigo_unico:          { campo: "codigo", mensaje: "Ya existe un nivel con ese código." },
  nivel_orden_unico:           { campo: "orden", mensaje: "Ese programa ya tiene un nivel con ese número de orden." },
  usuario_nombre_formato:      { campo: "nombre_usuario", mensaje: "De 4 a 30 caracteres, sin espacios." },
  usuario_nombre_usuario_key:  { campo: "nombre_usuario", mensaje: "Ese nombre de usuario ya está en uso." },
  usuario_profesor_id_key:     { campo: "profesor_id", mensaje: "Ese profesor ya tiene una cuenta." },
  // Spec 003: facturas (CE-53 a CE-55, CE-60) y estado de matrícula (CE-67).
  factura_serie_formato:       { campo: "serie", mensaje: "La serie es una sola letra." },
  factura_numero_rango:        { campo: "numero", mensaje: "El número es un entero de 1 a 5 cifras." },
  factura_monto_rango:         { campo: "monto", mensaje: "El monto va de 0.01 a 9,999.99, con dos decimales como máximo." },
  factura_moneda_valida:       { campo: "moneda", mensaje: "Elija US$ o C$." },
  factura_forma_pago_valida:   { campo: "forma_pago", mensaje: "Elija Efectivo, Tarjeta o Transferencia." },
  factura_fecha_cuatro_cifras: { campo: "fecha_emision", mensaje: "La fecha de emisión debe tener un año de cuatro cifras." },
  factura_fecha_valida:        { campo: "fecha_emision", mensaje: "La fecha de emisión no es válida." },
  factura_numero_unico:        { campo: "numero", mensaje: "Ya hay una factura con esa serie y ese número." },
  factura_inscripcion_unica:   { campo: "inscripcion_id", mensaje: "Esa inscripción ya tiene una factura." },
  estudiante_estado_matricula_check: { campo: "estado", mensaje: "Elija Activo, Desertor o Egresado." },
};

/** Lo que significa una regla de "check" sin nombre propio, por la columna. */
const POR_COLUMNA: Record<string, string> = {
  telefono: "Debe tener 8 dígitos, sin espacios ni guiones.",
  nombres: "Solo letras, espacios y apóstrofos, de 2 a 60 caracteres.",
  apellidos: "Solo letras, espacios y apóstrofos, de 2 a 60 caracteres.",
  nombre: "Revise el nombre: es demasiado corto o demasiado largo.",
  direccion: "Revise la dirección: es demasiado corta o demasiado larga.",
  codigo: "Revise el código: de 1 a 10 caracteres.",
  orden: "Debe ser un número del 1 al 99.",
  dias_de_clase: "Escriba los días de clase (de 2 a 40 caracteres).",
  nombre_completo: "Escriba el nombre completo (de 5 a 120 caracteres).",
  correo: "No es un correo válido (ejemplo: nombre@correo.com).",
};

export function traducirError(e: ErrorBD): ErrorTraducido {
  const texto = `${e.message} ${e.details ?? ""}`;
  const restriccion = /constraint "([a-z_]+)"/.exec(texto)?.[1];
  if (restriccion && POR_RESTRICCION[restriccion]) return POR_RESTRICCION[restriccion];
  // Las funciones revisan antes que la tabla y responden con el mismo mensaje de la
  // regla (la API no trae el nombre de la restricción): se reconoce por el mensaje.
  const porMensaje = Object.values(POR_RESTRICCION).find((r) => r.mensaje === e.message.trim());
  if (porMensaje) return porMensaje;
  if (restriccion?.endsWith("_check")) {
    const col = Object.keys(POR_COLUMNA).find((c) => restriccion.endsWith(`_${c}_check`));
    if (col) return { campo: col, mensaje: POR_COLUMNA[col] };
  }
  if (e.code === "23503") return { mensaje: "Está en uso en otros registros, por eso no se puede eliminar. Puede desactivarlo." };
  if (e.code === "42501" && !/[áéíóúñ]/i.test(e.message)) return { mensaje: "No tiene permiso para hacer esto." };
  if (e.code === "PGRST301" || /JWT|sesi[oó]n/.test(e.message) && !/[áéíóú]/.test(e.message))
    return { mensaje: "Su sesión venció. Ingrese de nuevo; lo que no guardó no se aplicó." };
  // Mensajes propios de la base (triggers y funciones): ya están en español.
  if (/^[A-ZÁÉÍÓÚÑ¿][^"]*[.:%]?$/.test(e.message.trim()) && !/violates|duplicate|syntax|invalid input/.test(e.message))
    return { mensaje: e.message.trim() };
  return { mensaje: "No se pudo guardar. Revise los datos e intente de nuevo." };
}
