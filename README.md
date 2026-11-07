# Indicadores Chile

Sitio estático con indicadores de Chile que se actualizan automáticamente desde fuentes oficiales
(Banco Central, CMF, Banco Mundial, FMI) y un **dashboard personalizable** que cada visitante arma a su gusto,
sin login. Bilingüe español / inglés.

- **Economía y finanzas**: dólar, euro, UF, UTM, TPM, IPC, expectativas, Imacec, PIB, desempleo, cobre, litio, petróleo, balanza comercial.
- **Chile en el mundo**: PIB per cápita PPA, crecimiento, inflación, desempleo y deuda (FMI, con proyecciones), Gini, esperanza de vida, indicadores de gobernanza (WGI), gasto en I+D, educación y salud, emisiones; comparados con OCDE y América Latina.
- **Próximas fases**: fiscal y transparencia (DIPRES, ChileCompra, InfoLobby, CPLT) y social y territorial (CASEN, DEIS, Mineduc, CEAD).

El catálogo completo de fuentes investigadas está en [`docs/FUENTES.md`](docs/FUENTES.md).

## Cómo funciona

```
GitHub Actions (2 veces al día)
  └─ pipeline/ (TypeScript)  ── descarga ──▶  APIs oficiales
       │  respaldo entre fuentes, carga incremental, validación (zod)
       ▼
  public/data/series/<id>.json  +  catalog.json  +  status.json   (versionados en git)
       ▼
  Astro (sitio estático) ──▶ GitHub Pages
```

- `config/indicators.yaml` es la única fuente de verdad: cada indicador lista sus **proveedores en orden de preferencia**.
  Se usa el primero que tenga credenciales y responda bien; si el Banco Central falla, se intenta la CMF y luego mindicador.cl.
- Si todas las fuentes de un indicador fallan, se conservan los datos anteriores y el workflow abre (o actualiza) un issue
  con el detalle. El issue se cierra solo cuando todo vuelve a funcionar.
- El sitio marca cuándo un dato viene de una fuente de respaldo no oficial, cuándo es una proyección del FMI
  y cuándo la fuente no ha publicado datos recientes.

### Dashboard personalizable

En **Mi dashboard** cada visitante agrega indicadores y elige, por tarjeta: vista (cifra, línea, barras), período,
transformación (nivel, diferencia, variación % del período, variación anual, índice base 100) y comparación con agregados
internacionales. La configuración se guarda en el navegador (`localStorage`) y se puede compartir con un enlace
(`#d=…`). Cada indicador tiene además su página con tabla de datos y descarga en CSV y JSON.

## Puesta en marcha

1. **Secrets del repositorio** (Settings → Secrets and variables → Actions):
   | Secret | Cómo obtenerlo |
   |---|---|
   | `BCCH_USER` | Correo de tu cuenta en la [BDE del Banco Central](https://si3.bcentral.cl/siete). |
   | `BCCH_PASS` | Clave / API key de esa cuenta, con la API habilitada desde el portal de la BDE. Vence al año: renovarla. |
   | `CMF_API_KEY` | API key gratuita en [api.cmfchile.cl](https://api.cmfchile.cl). |

   Sin estas claves el sitio funciona igual con las fuentes sin credenciales (mindicador.cl, Banco Mundial, FMI), pero los
   7 indicadores que solo publica la BDE (inflación 12 meses, expectativas, Imacec no minero, PIB, litio, petróleo,
   balanza comercial) quedan vacíos.
2. **GitHub Pages**: Settings → Pages → Source: *GitHub Actions*.
3. Fusionar a `main`. El push despliega el sitio; luego corre solo dos veces al día. También se puede lanzar a mano en
   *Actions → Datos y sitio → Run workflow* (opción “historia completa” para recargar todo).

## Desarrollo local

Requiere Node 22.12 o superior.

```bash
npm install
npm run fetch            # descarga datos (usa .env si existe; ver .env.example)
npm run fetch -- --only dolar-observado,uf   # solo algunos indicadores
npm run fetch -- --full  # ignora lo guardado y descarga toda la historia
npm run fetch -- --catalog-only              # regenera catalog.json sin descargar
npm run dev              # http://localhost:4321/es/
npm test                 # tests del pipeline y transformaciones
npm run check            # tipos (Astro + TypeScript)
npm run build
```

Detrás de un proxy corporativo, el `fetch` de Node necesita `NODE_USE_ENV_PROXY=1`.

## Agregar un indicador

1. Busca el código de la serie en la fuente (en la BDE: abre el cuadro y mira el atributo `data-serie`;
   en el Banco Mundial: `data.worldbank.org/indicator/<código>`).
2. Agrega una entrada en `config/indicators.yaml` con nombre y descripción en ambos idiomas, unidad, frecuencia y
   proveedores. Si el proveedor entrega un índice y quieres la variación anual, usa `derive: yoy`.
3. `npm run fetch -- --only <id>` y revisa `public/data/series/<id>.json`.

Todos los proveedores de un mismo indicador deben medir exactamente lo mismo (misma unidad y definición).

## Estructura

```
config/indicators.yaml     registro de áreas, fuentes e indicadores
pipeline/                  descarga y normalización (sources/ = un conector por fuente)
public/data/               datos generados (los actualiza el workflow)
src/pages/[lang]/          inicio, área, serie/<id>, dashboard, fuentes
src/components/            tarjetas, gráfico (ECharts) y dashboard (Preact)
src/lib/                   transformaciones de series, formato, estado del dashboard
docs/FUENTES.md            catálogo de fuentes investigadas
```

## Licencia de los datos

Cada serie conserva la atribución de su fuente (visible en la página del indicador). Banco Mundial: CC BY 4.0.
Banco Central, CMF y FMI: uso libre citando la fuente.
