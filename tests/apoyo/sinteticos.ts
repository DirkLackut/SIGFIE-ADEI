/**
 * Generador de estudiantes SINTÉTICOS (CE-45, plan §9). Nombres y cédulas
 * inventados por combinación; ninguno sale de los archivos reales de ADEI
 * (constitución, principio 3). Determinista: la misma cantidad da siempre los
 * mismos datos, así una medición se puede repetir.
 */
import type { PGlite } from "@electric-sql/pglite";

const NOMBRES = ["José", "María", "Luis", "Ana", "Carlos", "Sofía", "Jorge", "Lucía", "Andrés", "Valeria",
  "Ángel", "Camila", "Diego", "Fernanda", "Miguel", "Gabriela", "Óscar", "Isabel", "Raúl", "Daniela",
  "Iván", "Martha", "Félix", "Rocío", "Julio", "Noemí", "Héctor", "Elena", "Ramón", "Inés"];
const APELLIDOS = ["Gutiérrez", "López", "Martínez", "Hernández", "González", "Pérez", "Rodríguez", "Sánchez",
  "Ramírez", "Flores", "Núñez", "Álvarez", "Castillo", "Mendoza", "Rivera", "Ortega", "Chávez", "Morales",
  "Jiménez", "Reyes", "Vargas", "Rocha", "Espinoza", "Báez", "Téllez", "Zelaya", "Úbeda", "Obando", "Lacayo", "Solórzano"];

/**
 * Inserta `cantidad` estudiantes adultos en la organización. Se cargan como
 * superusuario y sin la auditoría de cada fila (es un acervo de prueba, no una
 * captura); las validaciones de la tabla sí corren.
 */
export async function cargarEstudiantesSinteticos(
  db: PGlite, org: string, sucursales: string[], cantidad: number, prefijo = "ADEI",
) {
  await db.exec("alter table estudiante disable trigger auditar");
  try {
    await db.query(
      `insert into estudiante (organizacion_id, codigo_adei, cedula, nombres, apellidos, fecha_nacimiento, telefono, sucursal_id)
       select $1,
              $2 || '-' || (2021 + i % 6) || '-' || lpad(i::text, 5, '0'),
              case when i % 5 = 0 then null   -- uno de cada cinco sin cédula, como en el acervo
                   else lpad((i % 999 + 1)::text, 3, '0') || '-' || lpad((i * 7919 % 1000000)::text, 6, '0') || '-'
                        || lpad(i::text, 4, '0') || chr(65 + i % 26) end,
              ($3::text[])[1 + i % 30] || case when i % 3 = 0 then ' ' || ($3::text[])[1 + (i / 30) % 30] else '' end,
              ($4::text[])[1 + (i / 7) % 30] || ' ' || ($4::text[])[1 + (i * 13) % 30],
              date '1960-01-01' + (i * 37 % 15000),
              '8' || lpad((i * 104729 % 10000000)::text, 7, '0'),
              ($5::uuid[])[1 + i % array_length($5::uuid[], 1)]
       from generate_series(1, $6::int) i`,
      [org, prefijo, NOMBRES, APELLIDOS, sucursales, cantidad]);
  } finally {
    await db.exec("alter table estudiante enable trigger auditar");
  }
  await db.exec("analyze estudiante");
}
