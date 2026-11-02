# Formatos impresos de ADEI

Fotos de los formatos en blanco que usa la academia (entregadas por Dirk el
31-oct y el 2-nov-2026). Sin datos de personas. Son la referencia de lo que el
sistema imprime o descarga; **no se rediseñan: se reproducen** (constitución,
principio 9; skill `marca-adei`).

| Formato | Archivo | Qué hace el sistema | Spec |
|---|---|---|---|
| Hoja de registro de notas | `hoja-de-registro-de-notas.jpg` | El acta impresa del grupo, llena con los parciales, la nota final y la entrega (CE-50 a CE-53) | 002 |
| Hoja de matrícula | `hoja-de-matricula.jpg` | Formato prellenado con el expediente y la inscripción (RF-18, PB-15), para imprimir o guardar en PDF | 003 |
| Factura contado (serie B) | *fuera del repositorio* | Solo se **registra** su número, serie, fecha y monto (RF-17, PB-12). El sistema no la reproduce | 003 |

## Hoja de registro de notas (002)

- Emblema arriba a la izquierda; marca de agua grande y tenue al centro.
- Encabezado: *English Teaching Academy* / *Academia de Enseñanza en Inglés*;
  título «HOJA DE REGISTRO DE NOTAS».
- Datos: Inicio, Término, Nivel, Horario, Profesor.
- Tabla: No. · Nombres y Apellidos · I · II · III · Final, 20 filas por hoja; un
  grupo de más de 20 sigue en otra hoja con el mismo encabezado y la numeración
  continua.
- Pie: «Entregado: ___ Firma del profesor: ___» y la nota «Favor no realizar
  enmiendas ni borrones, indicar en rojo las notas reprobadas».
- El sistema llena «Entregado» con la fecha y la hora de la entrega (CE-52) y, en
  lugar de una celda vacía, escribe la condición de un parcial que no es
  Registrado (NP, J, R) o el estado de una inscripción Retirada o Trasladada (CE-53).

## Hoja de matrícula (003)

Se prellena con lo que el sistema registra: nombres, apellidos, fecha de
nacimiento, edad, dirección, cédula, celular, correo, tutor, contacto de
emergencia, fecha de ingreso, nivel, horario, inicio y término del nivel,
profesor y curso.

- **No se imprimen «Estado civil» ni «Padece de alguna enfermedad»**: el sistema no
  registra esos datos (aviso de privacidad, Ley 787, minimización de datos).
- Lo que el sistema no registra (lugar donde vive, escolaridad, paga, requisitos
  entregados, foto) queda como línea en blanco para llenarse a mano.
- El N.º de recibo sale de la factura registrada (RF-17) cuando exista.

## Factura contado

Es un documento fiscal con numeración autorizada por la DGI, impreso en talonario.
El SRS (PB-12) decide «preservar la información del libro de recibos sin invadir
el ámbito fiscal»: el sistema guarda el número y el monto, pero no genera ni
imprime facturas. Por eso su foto no está en este repositorio público; está en la
carpeta `formatos/` del proyecto, fuera de git.
