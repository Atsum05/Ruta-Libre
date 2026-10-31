# RutaLibre

[English](README.md) · **Español**

[![CI](https://github.com/Atsum05/Ruta-Libre/actions/workflows/ci.yml/badge.svg)](https://github.com/Atsum05/Ruta-Libre/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Atsum05/Ruta-Libre/actions/workflows/codeql.yml/badge.svg)](https://github.com/Atsum05/Ruta-Libre/actions/workflows/codeql.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

Rutas accesibles de transporte público en Santiago de Chile. RutaLibre planifica viajes en Metro y
micro evitando los ascensores y escaleras mecánicas fuera de servicio, revisa cada estación del
camino en la dirección en que viajas, y dice claramente cuando no puede estar seguro.

> **Estado:** demo funcional. La API está en Render y el sitio en Netlify
> ([`docs/DEPLOY.md`](docs/DEPLOY.md)). La fuente del estado de los ascensores está pausada por
> ahora, así que la demo usa el último estado conocido, indicado en pantalla
> ([ADR 0014](docs/adr/0014-metro-first-and-demo-mode.md)). RutaLibre es una reconstrucción para
> producción de un prototipo del HaCAithon 2026: la misma idea, hecha desde cero con tests, CI,
> una API tipada y decisiones documentadas ([lo que nos enseñó el prototipo](docs/PROTOTYPE_LESSONS.md)).
> Los documentos enlazados están en inglés.

## Contenido

- [Qué hace](#qué-hace)
- [Cómo decide](#cómo-decide)
- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Datos](#datos)
- [API](#api)
- [Aplicación web](#aplicación-web)
- [Seguridad y privacidad](#seguridad-y-privacidad)
- [Tests](#tests)
- [CI/CD](#cicd)
- [Forma de trabajo](#forma-de-trabajo)
- [Cómo empezar](#cómo-empezar)
- [Documentación](#documentación)
- [Datos y créditos](#datos-y-créditos)

## Qué hace

- **Planifica un viaje** entre dos lugares, a partir de texto libre ("de Plaza Italia al
  Costanera") o por voz. Entre opciones igual de accesibles, el Metro va primero.
- **Revisa cada estación del viaje**: el acceso, el andén donde subes, el andén donde bajas y cada
  combinación, en tu dirección de viaje.
- **Da un veredicto por ruta:** accesible, accesible con avisos, no accesible o "no podemos
  confirmarlo", con el motivo en lenguaje simple y el ascensor nombrado con las palabras de Metro.
- **Muestra la ruta en el mapa** con hora de salida y de llegada, caminando a un ritmo de
  movilidad reducida.
- **Te deja elegir** cualquier otra opción: pasa a ser la ruta principal y se dibuja en el mapa.
- **Explica cada estación:** toca un punto para ver cada ascensor y escalera, hacia dónde va y si
  funciona.
- En español (es-CL) e inglés, pensado primero para el teléfono, usable con teclado y lector de
  pantalla.

## Cómo decide

El veredicto es el producto, así que sus reglas son funciones puras y testeadas en `packages/core`,
y están documentadas como decisiones.

| Situación en tu camino                                                           | Veredicto                            |
| -------------------------------------------------------------------------------- | ------------------------------------ |
| Todos los ascensores funcionan                                                   | Accesible                            |
| Una escalera mecánica está fuera de servicio                                     | Aviso                                |
| Un ascensor está fuera de servicio, pero otro hace el mismo recorrido y funciona | Aviso, indicando cuál usar           |
| Un ascensor está fuera de servicio en el andén contrario                         | Aviso (por si la dirección está mal) |
| Un ascensor está fuera de servicio en tu andén, acceso o combinación             | **No accesible**                     |
| Estado faltante, muy antiguo, o una parada que no reconocemos                    | **No podemos confirmarlo**           |
- Un dato faltante nunca se toma como "todo bien" ([ADR 0005](docs/adr/0005-tri-state-accessibility-verdict.md)).
- La dirección se compara por ID de estación, desde el letrero del tren hasta la estación terminal
  de la línea ([ADR 0006](docs/adr/0006-match-stops-by-location.md), [ADR 0011](docs/adr/0011-registry-stations-per-line.md)).
- Un ascensor de respaldo solo cuenta si conecta exactamente los mismos dos lugares en la misma
  línea ([ADR 0015](docs/adr/0015-backup-elevators.md)).
- La antigüedad del estado se mide desde que la fuente lo observó, no desde que lo descargamos
  ([ADR 0012](docs/adr/0012-status-freshness-follows-the-source.md)).
- Orden: primero las accesibles, luego las inciertas, luego las bloqueadas; dentro de cada grupo,
  el Metro primero ([ADR 0014](docs/adr/0014-metro-first-and-demo-mode.md)). Tabla completa de
  reglas: [ADR 0010](docs/adr/0010-verdict-rules.md).

## Arquitectura

```
 Navegador (apps/web)                     API (apps/api)                          Externo
 ────────────────────                     ──────────────                          ───────
 lugares, texto o voz ──► POST /v1/plan ──► Google Routes API (transporte) ───────► Google
                                │             (todos los modos + solo Metro, en paralelo)
                                │
                                ├─ cada tramo de Metro: reconoce ambas paradas en el registro
                                │    de estaciones (por línea, posición y nombre) ◄── packages/registry
                                ├─ evalúa cada estación con el último estado conocido
                                │    ok | aviso | bloqueada | incierta  ◄── sondeo ◄── seguimos.cl
                                ├─ ¿nada accesible? pide de nuevo, solo micros
                                └─ ordena, agrega horarios y descripciones ──► respuesta JSON tipada
 veredicto + pasos + mapa ◄─────┘
```

**Las dependencias apuntan solo hacia adentro:** apps → packages → `core`. Core no tiene
dependencias en tiempo de ejecución ni entrada/salida: nada de red, DOM ni módulos de Node. Esto se
asegura de tres formas: una regla de lint que prohíbe esas importaciones, una configuración de
TypeScript propia sin tipos de DOM ni de Node, y un test que revisa las importaciones de core
([ADR 0002](docs/adr/0002-monorepo-with-pure-core.md)). Todo lo que se comunica con el exterior es
un adaptador detrás de una interfaz en `apps/api`, así que el proveedor de rutas se puede cambiar y
cada llamada externa se puede simular en los tests ([ADR 0007](docs/adr/0007-routing-behind-provider-interface.md)).
Las claves nunca llegan al navegador, salvo la clave restringida para mostrar el mapa
([ADR 0004](docs/adr/0004-thin-server-api-no-keys-in-browser.md)).

## Tecnologías

| Área         | Elección                                                                  | Por qué                                                                                                         |
| ------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Lenguaje     | TypeScript 7, en su modo más estricto                                     | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`                        |
| Entorno      | Node 24                                                                   | Ejecuta TypeScript directamente: la API no necesita compilación                                                 |
| Monorepo     | pnpm workspaces con catálogo de versiones                                 | Un solo cambio actualiza una herramienta en todo el repo ([ADR 0002](docs/adr/0002-monorepo-with-pure-core.md)) |
| API          | Hono sobre `@hono/node-server`                                            | Pequeño, tipado, con `Request`/`Response` estándar                                                              |
| Contrato     | Esquemas zod 4 compartidos por la API y la web, OpenAPI generado de ellos | Una sola fuente de verdad para la API HTTP ([ADR 0013](docs/adr/0013-shared-contract-package.md))               |
| Web          | React 19, Vite 8, TanStack Query                                          | Builds rápidos; estado del servidor con caché y reintentos                                                      |
| Mapas        | Google Maps (`@vis.gl/react-google-maps`), Routes y Places API            | Rutas de transporte en Santiago ([ADR 0009](docs/adr/0009-google-maps-for-map-rendering.md))                    |
| IA           | Google Gemini                                                             | Convierte texto libre en origen y destino                                                                       |
| Lint/formato | Biome                                                                     | Una herramienta rápida para ambos                                                                               |
| Tests        | Vitest 5 + Testing Library, Playwright + axe-core                         | Tests unitarios, de integración y en navegador, con revisión de accesibilidad                                   |
| Hosting      | Render (API), Netlify (web)                                               | [ADR 0008](docs/adr/0008-hosting-platform.md)                                                                   |

## Datos

`packages/registry` convierte las fuentes originales en `stations.json`, el registro de estaciones
del que dependen el reconocimiento de paradas y los veredictos:

- **Entradas:** el catálogo de equipos de Metro (un punto por ascensor y escalera) y la lista de
  equipos de la fuente de estado en vivo, ambos en [`packages/registry/sources/`](packages/registry/sources/).
- **Salida:** 143 estaciones, una por línea en las estaciones de combinación, con 1.111 equipos.
  Cada equipo tiene su tipo, su alcance (toda la estación, o un andén con su dirección), la
  descripción de Metro y un `link` normalizado (los dos lugares que conecta) que sirve para
  encontrar respaldos.
- **Cero problemas sin explicar:** la generación reporta cada anomalía (tipos desconocidos,
  direcciones no reconocidas, terminales faltantes, nombres duplicados) y **falla** ante cualquiera
  que no esté listada con su motivo en `config.ts`. El resultado queda en
  [`REPORT.md`](packages/registry/REPORT.md), incluidas las correcciones de coordenadas con su
  evidencia de OpenStreetMap.
- Un test regenera el registro desde las fuentes y falla si `stations.json` difiere, así que no se
  puede editar a mano.

**Estado en vivo:** la API consulta la fuente cada 2 minutos. Una descarga fallida o mal formada
nunca reemplaza el último estado bueno: registra el error y sigue entregando el anterior, con su
antigüedad. Un estado de más de 13 horas hace que los veredictos sean "no podemos confirmarlo",
salvo en modo demo (`STATUS_DEMO=true`), que se indica en la interfaz y en cada respuesta.

## API

| Endpoint               | Qué hace                                                                         |
| ---------------------- | -------------------------------------------------------------------------------- |
| `POST /v1/plan`        | Planifica un viaje: rutas de Google, revisadas estación por estación y ordenadas |
| `GET /v1/places`       | Autocompletado de lugares, priorizando Santiago (con tokens de sesión)           |
| `POST /v1/interpret`   | Texto libre → origen y destino (Gemini)                                          |
| `GET /v1/status`       | Estado de ascensores y escaleras, su antigüedad y salud                          |
| `GET /v1/health`       | Versión, commit y entorno                                                        |
| `GET /v1/openapi.json` | Documento OpenAPI generado desde los esquemas zod                                |
- Las solicitudes y respuestas se validan con los esquemas zod compartidos; la web usa un cliente
  tipado construido con los mismos esquemas, así que un cambio incompatible falla en la revisión de
  tipos y no en producción.
- Las llamadas externas tienen un tiempo límite por intento y reintentos con espera exponencial
  ante 429 y 5xx.
- La configuración se valida al arrancar, y el servidor no inicia con un valor mal formado (el
  prototipo falló una vez porque una clave tenía un carácter invisible al inicio).

## Aplicación web

- Diseño pensado primero para el teléfono: un panel inferior sobre el mapa en el teléfono y un
  panel flotante en escritorio.
- **Diseño "Cordillera":** la parte superior del panel muestra la cordillera bajo un cielo que
  sigue la hora del día en Santiago (el sol saliendo tras los cerros, la nieve rosada del
  atardecer, estrellas de noche). Fondo blanco nieve, tinta profunda, un brillo coral para la
  acción principal; Fraunces para los títulos y Atkinson Hyperlegible para leer; un mapa con los
  mismos colores y modo oscuro. Agrega `?sky=dawn`, `day`, `dusk` o `night` a la dirección para
  ver cada cielo.
- La librería del mapa se carga por separado, así que la primera pantalla es rápida (unos 115 KB
  de JavaScript comprimido).
- **Accesibilidad:** WCAG 2.2 AA, revisado con axe en los tests de navegador, incluido el
  contraste de colores. Los veredictos usan palabras y formas de íconos, nunca solo color; el foco
  se mueve a la ruta elegida; los lectores de pantalla leen los horarios como una frase.
- La entrada por voz usa el reconocimiento de voz del navegador y explica cada falla (permiso
  denegado, no se escuchó nada, sin micrófono, navegador no compatible).
- Todos los textos están en catálogos tipados en español e inglés; un test asegura que tengan las
  mismas claves y variables.

## Seguridad y privacidad

- **Claves en el servidor** ([ADR 0004](docs/adr/0004-thin-server-api-no-keys-in-browser.md)): el
  navegador solo tiene una clave para mostrar el mapa, restringida a los dominios del sitio.
- **Endurecimiento HTTP:** cabeceras de seguridad estrictas y `default-src 'none'` en la API; una
  Content Security Policy para el sitio (en modo solo reporte mientras se ajusta); CORS limitado a
  los orígenes permitidos.
- **Límite de solicitudes por cliente** en cada endpoint con costo (`/v1/plan` 20/min,
  `/v1/places` 60/min, `/v1/interpret` 10/min), con cabeceras estándar `RateLimit-*`; la IP del
  cliente solo se toma de `X-Forwarded-For` detrás de un proxy de confianza.
- **Sin datos personales en los logs:** una línea estructurada por solicitud con ID, método, ruta,
  código y duración; nunca parámetros ni cuerpos, que pueden contener lugares (Ley 21.719 de
  protección de datos; ver [`DATA_SOURCES.md`](docs/DATA_SOURCES.md)).
- **Cadena de suministro:** `pnpm audit` hace fallar la CI ante vulnerabilidades graves en las
  dependencias de producción; CodeQL analiza cada pull request y corre cada semana; Renovate
  mantiene al día las dependencias y las GitHub Actions (fijadas por digest).

## Tests

Unos **500 tests unitarios y de integración** y **26 tests en navegador**, todos ejecutados en cada
pull request.

- **Umbrales de cobertura:** todo el código debe mantener al menos 98% de líneas, 97% de
  sentencias y funciones, y 90% de ramas; `packages/core` exige 95% en todo. Hoy: 99,5% de líneas y
  92,5% de ramas. Los umbrales se suben a medida que crece la cobertura; nunca se bajan para hacer
  merge.
- **Cada test en su nivel:** las reglas puras se prueban en core; la API se prueba por HTTP con
  proveedores simulados; los flujos completos corren en un navegador real.
- **Datos reales en los tests:** las reglas de core corren sobre el registro real de estaciones; el
  adaptador de Google se prueba con una respuesta real guardada; el lector del estado, con una
  muestra real de la fuente; un test usa las coordenadas reales de Google de un andén que antes no
  se reconocía.
- **Cada bug se convierte en un test de regresión**, incluidos los encontrados en el prototipo.
- **Tests en navegador** (Playwright, teléfono y escritorio): viajes limpios, reorientados y sin
  alternativa, elegir otra ruta, datos antiguos, falla del mapa, entrada por voz, inglés, solo
  teclado, sin desplazamiento lateral, y revisión WCAG 2.2 AA con axe. La API está simulada y Google
  bloqueado, así que son deterministas y no necesitan claves. Corren en unos 8 segundos.

## CI/CD

Cada pull request y cada push a `main` ejecuta, en GitHub Actions
([`.github/workflows/`](.github/workflows/)):

| Job            | Qué ejecuta                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CI / check** | Lint, revisión de tipos, todos los tests con los umbrales de cobertura, una tabla de cobertura en el resumen de la ejecución (con el informe HTML descargable), un build de producción del sitio y una auditoría de vulnerabilidades |
| **CI / e2e**   | Los tests de Playwright en Chromium, guardando los resultados si fallan                                                                                                                                                              |
| **CodeQL**     | El análisis de seguridad y calidad de GitHub, también cada lunes                                                                                                                                                                     |
- Un push nuevo cancela las ejecuciones desactualizadas; los jobs tienen tiempo límite y permisos
  de solo lectura.
- **Protección de `main`:** los cambios solo llegan por pull request, el job `check` debe pasar, y
  solo se permite squash merge, así que `main` tiene un commit por cambio y siempre se puede
  desplegar.
- **Despliegue continuo:** un merge a `main` vuelve a desplegar la API en Render (`render.yaml`) y
  el sitio en Netlify (`netlify.toml`), que además genera una vista previa para cada pull request.
  Los pasos para volver atrás están en [`docs/DEPLOY.md`](docs/DEPLOY.md).
- **Renovate** abre un pull request agrupado por semana con las actualizaciones menores, con
  mensajes de commit semánticos, y mantiene el lockfile al día.

## Forma de trabajo

- **Conventional Commits:** `tipo(ámbito): resumen`, por ejemplo
  `feat(core): evaluate each leg against its own direction` o `fix(registry): …`, con los tipos
  habituales (`feat`, `fix`, `docs`, `chore`, `test`, `refactor`). Con squash merge queda un commit así por pull
  request en `main`.
- **Ramas:** `feat/…`, `fix/…`, `chore/…`, `docs/…`, pequeñas y enfocadas (una idea por pull
  request).
- **Definición de terminado** en la [plantilla de pull request](.github/pull_request_template.md):
  `pnpm check` pasa, tests en el nivel correcto, sin secretos ni datos personales, revisado en ancho
  de teléfono y con teclado, documentación y ADR actualizados, verificado en la vista previa.
- **Architecture Decision Records:** cada decisión que alguien podría cuestionar después queda
  escrita con su contexto y consecuencias: [`docs/adr/`](docs/adr/), 16 hasta ahora, desde la
  estructura del monorepo hasta la regla de ascensores de respaldo.
- **Hoja de ruta por fases**, cada una con su criterio de "terminado": [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Cómo empezar

Requiere Node 24 (`.nvmrc`) y pnpm (versión fijada en `package.json`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # clave de Maps JavaScript (navegador)
cp apps/api/.env.example apps/api/.env          # clave de Google para rutas y lugares, clave de Gemini opcional
pnpm dev                                        # API en :8787, web en :5173 (con proxy en /api)
```

Sin claves, la API igual arranca y entrega el estado de los ascensores; para planificar viajes se
necesita la clave de Google. Con `STATUS_DEMO=true` en `apps/api/.env`, el último estado conocido
se usa como actual.

| Comando                                            | Qué hace                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm check`                                       | Lint, revisión de tipos y todos los tests con cobertura: exactamente lo que corre la CI |
| `pnpm test:e2e`                                    | Tests en navegador, en teléfono y escritorio, con revisión de accesibilidad             |
| `pnpm test:watch`                                  | Tests en modo observación mientras trabajas                                             |
| `pnpm format`                                      | Corrige el formato y problemas de lint seguros                                          |
| `pnpm --filter @rutalibre/registry build:registry` | Regenera `stations.json` y `REPORT.md` desde las fuentes                                |

### Estructura del repositorio

```
rutalibre/
├─ packages/core/       reglas: reconocer paradas, veredictos, orden, ritmo al caminar. Puro, sin dependencias
├─ packages/registry/   registro de estaciones generado desde sources/, con su informe
├─ packages/contract/   esquemas zod de la API HTTP, cliente tipado, fuente de OpenAPI
├─ apps/api/            API Hono: rutas, adaptadores de Google y Gemini, sondeo de estado, middleware
├─ apps/web/            app React: búsqueda, resultados, mapa, idiomas; tests de Playwright en e2e/
├─ docs/                hoja de ruta, despliegue, fuentes de datos, ADR
└─ .github/             workflows de CI y CodeQL, plantilla de pull request
```

## Documentación

En inglés:

- [`docs/ROADMAP.md`](docs/ROADMAP.md): el plan de construcción por fases, con lo hecho y lo pendiente
- [`docs/BRIEF.md`](docs/BRIEF.md): para quién es, la promesa principal, lo que no es, métricas de éxito
- [`docs/DEPLOY.md`](docs/DEPLOY.md): despliegue en Render y Netlify, y cómo volver atrás
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md): licencias, permisos y términos de cada fuente
- [`docs/adr/`](docs/adr/): Architecture Decision Records
- [`docs/PROTOTYPE_LESSONS.md`](docs/PROTOTYPE_LESSONS.md): lo que nos enseñó el prototipo del hackathon
- [`CONTRIBUTING.md`](CONTRIBUTING.md) y [`AGENTS.md`](AGENTS.md): cómo trabajar en este repositorio

## Datos y créditos

- Catálogo y estado de ascensores y escaleras: [ariellopez.cl](https://ariellopez.cl/metro/accesibilidad/)
  y [seguimos.cl](https://velocidades.seguimos.cl/), de Ariel López y Willy Maikowski.
- Geometría de las líneas de Metro y correcciones de estaciones: © colaboradores de OpenStreetMap
  ([ODbL](https://www.openstreetmap.org/copyright)).
- Mapas, rutas y búsqueda de lugares: Google Maps Platform. Viajes en texto libre: Google Gemini.

## Licencia

Código: [MIT](LICENSE). Los archivos de datos mantienen sus propios términos
([`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)); la geometría de las líneas derivada de
OpenStreetMap sigue bajo la ODbL.
