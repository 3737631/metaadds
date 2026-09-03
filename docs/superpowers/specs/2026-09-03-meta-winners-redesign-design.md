# Meta Winners — Rediseño del producto alrededor de la simplicidad

**Fecha:** 2026-09-03
**Estado:** Aprobado por el usuario (2026-09-03)

## 1. Visión

Rehacer la aplicación actual (un panel de "inteligencia" de 9 páginas en inglés
lleno de dashboards y terminología técnica) convirtiéndola en una herramienta
**extremadamente sencilla, en español y mobile-first** cuyo flujo es:

```
HOME (elegir ámbito + país)
  → GANADORES de [categoría]
  → PRODUCTO (por qué es ganador, precio, saturación, vendedores, anuncios)
  → CREAR ANUNCIO CON IA (tipo + plataforma)
  → PROMPT por escenas → VISUALES NECESARIOS → prompts de visuales
  → GALERÍA → REGENERAR
```

La complejidad vive en el backend/el motor de ranking; la interfaz solo muestra
la información útil para decidir. Nunca se afirman ventas, ROAS, CPA ni gasto
publicitario que no existan: solo **señales publicitarias observables** de Meta.

## 2. Qué se conserva (backend)

Ya está correctamente arquitectado y alineado con esta dirección. Se conserva
casi intacto:

- `src/lib/types.ts` — modelo de datos. `RawAd` ya refleja campos reales de
  Meta (Library ID `id`, `advertiserId`/Page ID, `advertiserName`/Page name,
  copy `primaryText`/`headline`/`description`, `startDate`/`endDate` (delivery),
  `platforms`/publisher platforms, `market`/country, `creativeAssets`/media
  type). `Product`, `PriceInfo` (con `source`, `observedAt`, `currency`).
- `src/lib/repository.ts` — pipeline completo: normalize → dedupe → entity
  resolution → signals → saturation → confidence → winner scoring → ranking.
  Incluye `LocalWatchlist` (persistido en localStorage).
- `src/lib/intelligence/*` — signalEngine, saturationEngine, confidence, winner.
- `src/lib/present.ts` — **ya escrito para esta dirección**: `CATEGORIES`
  (categorías en español con emojis exactos del spec), `saturationView` (con
  barras `Competencia/Actividad/Tendencia`), `whyWinner`, `priceView`,
  `trendLabel`, formato EUR.
- `src/lib/data/provider.ts` + `mockData.ts` — abstracción `DataProvider`
  pensada para enchufar la API real de Meta. Demo claramente marcada
  (`isDemo: true`), nunca fabrica métricas de rendimiento.

## 3. Qué se elimina (UI)

- Páginas actuales en inglés: Overview, Discover, Winners, Watchlist, Products,
  Ads, Advertisers, Analytics, Settings → **se sustituyen** por el nuevo flujo.
- Sidebar de 9 entradas → navegación de 4: **Inicio · Ganadores · Guardados ·
  Ajustes**.
- Toda terminología técnica visible ("signal pipeline", "entity resolution",
  "confidence", "advertiser momentum", etc.) se elimina de la interfaz. La
  complejidad queda en el backend.

## 4. Navegación nueva

- **Móvil:** barra inferior fija con 4 entradas (Inicio, Ganadores, Guardados,
  Ajustes), iconos + etiqueta, targets ≥ 44 px. Respetar safe-area.
- **Escritorio:** barra lateral delgada (mismo contenido), contenido centrado
  con máximo de ancho para legibilidad.

## 5. Páginas y flujo

### 5.1 Home (`/`)
- Header: **META WINNERS** + tagline "Encuentra productos con las señales
  publicitarias más fuertes en Meta."
- "¿Qué quieres buscar?" → grid de cards grandes: 👕 Moda, 🧴 Belleza,
  🧹 Limpieza, 🐶 Mascotas, 👴 Personas mayores, 🏠 Hogar, 💪 Fitness, 🚗 Coche,
  👶 Bebés, 🎮 Tecnología, 🎁 Regalos, 🔥 Todos.
- Selector de **País** (🇪🇸 España por defecto; "Todos los países" opcional).
- Botón principal **🔎 ENCONTRAR GANADORES**.
- Indicador visible de **DEMO** cuando el proveedor sea demo.

### 5.2 Ganadores de categoría (`/ganadores?categoria=&pais=`)
- Título "🔥 Ganadores de [categoría]" + "Ordenados por fuerza de las señales
  publicitarias observadas en Meta."
- Filtros superiores: Categoría · País · Saturación · Tendencia.
- Lista vertical (mobile) / grid (desktop) de tarjetas de producto.

### 5.3 Tarjeta de producto (resultado de ranking)
- Imagen, **🔥 94/100**, etiqueta PROVEN WINNER, nombre.
- 👥 N vendedores · 📢 N anuncios · ⏱ N días observado · 📈 +N% actividad ·
  🌍 N mercados.
- Precio de mercado (rango).
- Saturación 🟢/🟡/🟠/🔴.
- CTA **VER PRODUCTO**.
- **Importante:** "vendedores" = **anunciantes independientes** (no anuncios).
  Nunca confundir anuncios con vendedores.

### 5.4 Detalle de producto (`/productos/[id]`)
Flujo visual en vertical:
1. **← Volver a ganadores**.
2. Imagen grande, score, PROVEN WINNER, nombre.
3. **¿Por qué está aquí?** — 5-7 razones en lenguaje normal (✓ vendedores
   independientes, ✓ actividad creciente, ✓ creativos diferentes, ✓ anuncios
   persistentes, ✓ varios mercados). Footer honesto: "Esto no garantiza ventas.
   Son señales observables de actividad publicitaria."
4. **💰 Precio de mercado** — precio mínimo / habitual / máximo observados;
   coste potencial (con fuente, o "No disponible"); margen bruto potencial
   (solo si hay datos; "Antes de publicidad, impuestos, envío y otros costes").
5. **🔥 ¿Está quemado?** — nivel 🟢BAJA/🟡MEDIA/🟠ALTA/🔴MUY ALTA + explicación
   en lenguaje normal + barras Competencia/Actividad/Tendencia.
6. **👥 Vendedores** — lista: vendedor, nº anuncios, nº días. "No disponible"
   si no hay datos.
7. **📢 Anuncios encontrados** — grid visual con vendedor, país, activo/inactivo,
   fecha observada, duración observada. Solo campos disponibles.
8. Botón principal **🤖 CREAR ANUNCIO CON IA**.

### 5.5 Creador de anuncio con IA
1. **¿Qué quieres crear?** — Vídeo UGC, Vídeo demostración, Vídeo producto,
   Imagen publicitaria, Carrusel.
2. **Plataforma IA** — VIDEO: Veo, Kling, Seedance, Runway, Sora · IMAGEN:
   Nano Banana, Gemini, ChatGPT Images, Flux.
3. **Prompt por escenas** (formato del prompt adaptado por plataforma):
   duración, ratio, escena, segundos exactos, HOOK/SEÑAL/PROBLEMA/DEMO/
   RESULTADO/CTA, cámara/lente, movimiento, iluminación, entorno, persona/ropa/
   expresión, posición del producto, acción, audio, diálogo, texto en pantalla,
   transición, continuidad, **REFERENCIA VISUAL explícita**, instrucciones para
   conservar el producto idéntico, constraints negativos útiles. Total coherente.
   Botones: COPIAR · REGENERAR · CAMBIAR MODELO.
4. **🖼 Visuales necesarios** — lista (ej. Visual 1 producto frontal, Visual 2
   en uso, Visual 3 resultado, Visual 4 lifestyle, Visual 5 close-up), cada uno
   con "GENERAR PROMPT".
5. **Prompt de visual** — prompt específico del modelo (subject, environment,
   composition, camera, lighting, styling, placement, realism, continuity,
   aspect ratio). COPIAR · GENERAR VISUAL.
6. **Galería de visuales** — grid 2 columnas; cada visual con REGENERAR.
7. **Regenerar** — "¿Qué quieres cambiar?" (Más realista, Cambiar persona,
   Cambiar escenario, Cambiar ropa, Cambiar iluminación, Cambiar cámara,
   Mantener producto idéntico, Otro cambio + "Escribe el cambio...") → genera
   NUEVO prompt basado en el anterior + el cambio.
8. **✍️ Copy** — Hook, texto principal, titular, CTA en varias variantes
   (sección secundaria, no complica la página principal).

### 5.6 Guardados (`/guardados`)
- Productos guardados (score, saturación, precio, tendencia).

### 5.7 Ajustes (`/ajustes`)
- Estado/oculto demo vs real, política de datos/evidencia. Sencillo.

## 6. Motor de prompts IA — motor local basado en plantillas

Decisión (usuario): **motor local basado en plantillas**, sin API key, sin
backend, funciona en la exportación estática.

- `src/lib/ai/templates.ts` — generadores de prompts de vídeo por escenas,
  adaptados por plataforma (mapa Veo/Kling/Seedance/Runway/Sora con sus
  convenciones: duración, ratio, motion, etc.).
- `src/lib/ai/visualPrompts.ts` — generadores de prompts de imagen por modelo
  (Nano Banana / Gemini / ChatGPT Images / Flux).
- `src/lib/ai/regenerate.ts` — lógica de regeneración: muta el prompt base con
  el cambio solicitado, manteniendo continuidad del producto.
- `src/lib/ai/copy.ts` — generador de copy (hook, texto, titular, CTA,
  variantes).
- El generador **aprende de las creatividades observadas** del producto
  (estructura/estilo/hooks) como referencia para crear una creatividad
  **original**, nunca copiando literalmente anuncios de terceros.
- Se incluye `src/lib/ai/models.ts` con el catálogo de plataformas/categorías.
- Continuidad: instrucciones explícitas para que el producto (forma, color,
  packaging) permanezca idéntico entre visuales/vídeo.

## 7. Datos reales — Meta Ad Library (P0, por fases)

**Condicionante confirmado y aprobado:** la vía oficial
(`graph.facebook.com/v25.0/ads_archive`) requiere un access token de Meta
(verificación de identidad + app de developer; **gratis, sin tarjeta**). El
endpoint público `.../async/search_ads/` está bloqueado (403) sin sesión de
navegador → no es fiable. Los anuncios comerciales entregados en **España/UE**
sí son consultables por el API oficial (`ad_reached_countries=['ES']`), lo que
encaja con el foco 🇪🇸.

**Estrategia por fases (aprobada):**

- **Fase A (implementar ahora):** construir el **proveedor real de Meta**
  completo y conectar la UI para que lo consuma, pero con **DEMO claramente
  etiquetada** hasta disponer del token. El ranking real entra sin tocar la UI.
  - `src/lib/data/metaProvider.ts` — implementa `DataProvider`:
    - `fetchRawAds(ad_reached_countries)` con paginación (Cursor/paging next).
    - Mapeo de campos Met a `RawAd`: `id`→Library ID,
      `page_id`/`page_name`→advertiser, `ad_creative_bodies`→copy,
      `ad_delivery_start_time`/`ad_delivery_stop_time`→fechas,
      `publisher_platforms`→platforms, `country`→market,
      `ad_creative_link_captions`/`link_titles`/`link_descriptions`→headline/
      description, `imgs`/`videos`→creativeAssets.
    - Requiere `META_ADS_ACCESS_TOKEN` desde `.env` (nunca en repo).
  - Script `npm run ingest` (Node, `scripts/ingest.ts`): llama a `ads_archive`
    paginado para España, escribe un **snapshot JSON** (`data/meta-snapshot.json`,
    con `source`, `ingested_at`, lista de raw ads) que el provider real lee.
  - `repository.ts` elige proveedor según configuración (`META_ADS_ACCESS_TOKEN`
    presente y snapshot existente → Meta; si no → demo).
  - Todo el pipeline/inteligencia/UI funciona igual con cualquiera de los dos.
  - **PRECIO:** nunca se inventa. Solo fuentes legítimas con `source`,
    `observed_at`, `currency`, `price`. Si no hay, "No disponible"/"Precio
    observado".
- **Fase B (requiere acción del usuario):** verificación de identidad en Meta +
  app + token (guía paso a paso entregada); el usuario lo pone en `.env` y
  ejecuta `npm run ingest` → productos reales de España.

## 8. Precio, saturación, honestidad de datos

- Precio mínimo/habitual/máximo observados (solo con fuentes). Coste y margen
  solo si hay fuente fiable; si no "No disponible". Nunca inventar ventas,
  ROAS, CPA, beneficio o gasto publicitario.
- Saturation: nivel 🟢/🟡/🟠/🔴 + lenguaje normal + barras
  Competencia/Actividad/Tendencia (ya en `present.ts`).
- Ranking = "mejores señales" (diversidad de anunciantes, crecimiento,
  persistencia, actividad, diversidad creativa, expansión geográfica, nuevos
  anunciantes, calidad de evidencia), penalizando duplicados, un solo
  anunciante con muchos anuncios, saturación extrema, baja confianza de
  agrupación, datos insuficientes.
- Categorías internas del pipeline mapeadas a categorías de usuario en español.

## 9. Diseño visual y rendimiento

- Estética premium, limpia, moderna, sencilla, rápida, visual (inspiración
  conceptual Apple/Linear/Vercel, sin copiar interfaces).
- **Mobile-first**; responsive real 375px/tablet/desktop.
- Dark + light (`prefers-color-scheme`), tokens semánticos.
- Respetar `prefers-reduced-motion`; animar solo `transform`/`opacity`; lazy
  loading de imágenes; sin JS innecesario; sin renders repetidos. Verificación
  con Playwright: consola sin errores, red sin peticiones inútiles, sin lag.

## 10. Config, repo y verificación

- Conservar `.env.example`, `.gitignore` (ya ignora `.env*`), README (actualizar),
  TypeScript, lint. Añadir tests del motor de prompts y del mapeo del provider.
- Sin secretos en el repo; `META_ADS_ACCESS_TOKEN` solo en `.env`/variables
  locales de CI.
- Verificación al finalizar: typecheck/build OK, `npm run lint`, Playwright
  responsive + consola sin errores, tests del motor de prompts.

## 11. Fuera de alcance (P1+/no hacer)

- CRM, facturación, analytics empresarial, dashboards de 30 métricas,
  predicciones de ventas falsas, sistemas de agentes innecesarios (más allá de
  los generadores de prompts), múltiples fuentes (TikTok/Amazon/AliExpress
  para decidir ranking).

## 12. Prioridades

- **P0:** Meta data ingestion (proveedor + ingest), product clustering ya
  existente, winner ranking, category browsing, product detail, price,
  saturation, ad creatives.
- **P1:** AI prompt generation, visual prompt generation, regeneration, copy,
  saved products.
