---
name: marca-adei
description: Reglas de identidad visual de ADEI para SIGFIE (colores oficiales, logo según tamaño, tipografías, movimiento, celular, impresos). Úsala antes de crear o cambiar cualquier pantalla, componente, ícono, estilo o documento imprimible del sistema.
---

# Marca ADEI en SIGFIE

Fuente: *Manual de Identidad Corporativa* de ADEI. El detalle y las mediciones
están en `specs/001-base-y-registro/plan.md` §14 y en la constitución, principio 9.
**Si algo de aquí choca con una skill de diseño genérica, gana esta skill.**

## Antes de tocar la interfaz

1. Usa los tokens de `src/app/globals.css`. Nunca escribas un color hexadecimal en
   un componente.
2. Usa los componentes que ya existen (`src/componentes/`): `TituloPagina`,
   `Seccion`, `Alerta`, `Insignia`, `Tabla`, `Campo`, `Selector`, `BotonEnviar`,
   `BotonConfirmar`, `Desplegable`, `Aparecer`, `Marca` y `Emblema`.
3. Al terminar, verifica la pantalla en 1280 px y en 360 px, sin desplazamiento
   horizontal, y corre `tests/dominio/contraste.test.ts`.

## Colores: un uso por color

| Token | Para qué | Nunca |
|---|---|---|
| `marino` | Encabezado, botón principal, franjas, títulos | — |
| `marino-suave` | Encabezado de tabla, fila señalada, pestaña activa | — |
| `azul` | Enlaces, menú activo, foco | Para indicar éxito |
| `cian` / `cian-suave` | Éxito: «Activo», «Listo», confirmaciones | — |
| `verde` | Relleno o ícono de éxito, con marino encima | Como texto sobre blanco (2.4:1) |
| `celeste` | Detalles sobre fondo marino | Como texto sobre blanco (3.0:1) |
| `dorado` | Bordes e íconos de advertencia | Como texto (3.8:1) |
| `dorado-texto` / `dorado-suave` | Texto de advertencias y **errores de formulario** | — |
| `reprobado` | **Solo** notas reprobadas | Errores, alertas, botones de eliminar |

- Los errores de formulario **no** van en rojo, sino en dorado, con borde, ícono ⚠
  y texto que dicen qué regla se incumplió.
- Nada de degradados, brillos ni sombras en elementos en reposo. La sombra solo va
  en lo que flota: menú, aviso pasajero.

## Logo

- El emblema es el del manual, extraído en vector. **Nunca se redibuja, se
  deforma, se recorta ni se le cambian los elementos.** Archivo:
  `public/marca/emblema.svg` (símbolo `#emblema`, una tinta, toma el
  `currentColor`). Se usa con `<Emblema />`.
- Se pinta de marino sobre fondo claro y de blanco sobre fondo marino. El dorado
  sobre blanco también es una versión del manual. No se usan otros colores.
- El texto circular no se lee por debajo de ~96 px. **En tamaño pequeño el emblema
  siempre va con la palabra «ADEI»** (`<Marca />`), como en los promocionales.
- Favicon e ícono del celular: `src/app/icon.svg` y `apple-icon.png` (óvalo
  «ADEI» sobre marino).
- El eslogan «Adei makes your day!» y su letra (Button Shield, licencia solo
  personal) **no** se usan en el sistema.

## Tipografía

- **Montserrat** para todo el texto de la interfaz.
- **Libre Baskerville** (`font-titulo`) solo para los títulos de página (`h1`) y el
  título del ingreso. Nunca para párrafos, tablas ni botones.
- Las cifras alineadas en columna llevan la clase `cifra`. Los códigos (`ADEI-2026-00001`,
  cédulas) van en `font-mono`.
- Los campos del celular usan 16 px; con menos, el iPhone hace zoom.

## Movimiento

Usa las skills `emil-design-eng` y `review-animations` para el detalle. Lo esencial:

- **No se anima** lo que se usa decenas de veces al día: escribir en el buscador,
  cambiar de página, las tablas, el menú principal.
- **Botones:** se hunden al presionar (clase `boton`, la pone `claseBoton`).
- **Paneles ocasionales:** usa `<Desplegable>`, no `<details>`, cuando el panel
  tiene un formulario.
- **Avisos:** `Alerta` ya entra con `.aparecer`. Lo que salió bien en el lugar
  se confirma con `useConfirmarExito`, que muestra un aviso pasajero (Sonner).
  **Los errores nunca van en un aviso pasajero**, porque desaparecería antes de
  leerlo.
- Duración máxima de 300 ms; curva `--ease-salida`; nunca `ease-in`.
- Con «reducir movimiento» del sistema no hay animación: ya está resuelto en
  globals.css y en `MotionConfig`.

## Impresos (acta: spec 002; hoja de matrícula, listado e historial: spec 003)

Fotos de referencia y decisiones en `docs/formatos/README.md`. El acta sigue el
formato oficial **«Hoja de registro de notas»** de ADEI:

- emblema arriba a la izquierda y marca de agua grande centrada;
- encabezado *English Teaching Academy / Academia de Enseñanza en Inglés*;
- datos del grupo: Inicio, Término, Nivel, Horario y Profesor;
- tabla N.º / Nombres y apellidos / I / II / III / Final, con 20 filas;
- al pie, «Entregado» y «Firma del profesor», y la nota «Favor no realizar
  enmiendas ni borrones, indicar en rojo las notas reprobadas»;
- las notas reprobadas en `reprobado`.

Se imprime a color o en gris: el emblema funciona en los dos (versión «Gris» del
manual). No se rediseña el formato: se reproduce.

La **Hoja de matrícula** (003) también se reproduce, sin «Estado civil» ni «Padece de
alguna enfermedad»; lo no registrado queda en blanco y lo registrado pero vacío dice
«sin registro». El **listado del filtrado** y el **historial académico** no tienen
formato en papel: usan el encabezado del acta, tabla numerada y «Hoja N de M»
(`specs/003-consulta-y-reportes/plan.md` §5c).

## Archivos de Excel (003)

Detalle en `specs/003-consulta-y-reportes/plan.md` §5b. Lo esencial: encabezado de
ADEI en marino, fecha, autor, criterios y total arriba; encabezado de columnas con
fondo marino y letra blanca, fijo y con autofiltro; códigos como texto, fechas como
fechas; rojo **solo** en notas reprobadas; letra Calibri (Montserrat casi nunca está
instalada donde se abre el archivo); sin emblema.

## Revisión de calidad

- **Impeccable (modo Operate):** en la nube de trabajo se puede correr `detect`
  contra la app local con datos sintéticos. El aviso `overused-font` sobre
  Montserrat **se acepta**: es la letra de ADEI y la marca manda.
- **`break-ui`:** prueba nombres largos, cédulas, cero filas y muchas filas, siempre
  con datos sintéticos, nunca con los Excel reales.
