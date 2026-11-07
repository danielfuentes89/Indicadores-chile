# Catálogo de fuentes de datos

Investigación de fuentes oficiales y de indicadores internacionales sobre Chile, hecha en noviembre de 2026
para planificar el sitio. Las marcadas con ✅ ya están integradas en el pipeline; el resto está planificado.

Leyenda de acceso: **API** = servicio con datos estructurados · **Archivo** = descarga CSV/XLSX · **Key** = requiere registro gratuito.

## A. Economía y finanzas

| Estado | Fuente | Acceso | Qué aporta |
|---|---|---|---|
| ✅ | **Banco Central de Chile – Base de Datos Estadísticos (BDE)** | API REST `SieteRestWS.ashx?token=…&function=GetSeries` (Key: API Key Token de la cuenta BDE, vence al año; el método antiguo `user`/`pass` sigue disponible). Una serie por llamada. | Tipo de cambio, UF, UTM, TPM, IPC, Imacec, PIB, desempleo (INE), materias primas, balanza de pagos, expectativas (EEE/EOF), estadísticas regionales. Es la fuente preferida: replica muchas series del INE. |
| ✅ | **CMF – API recursos** (`api.cmfchile.cl/api-sbifv3/recursos_api/…`) | API (Key gratuita) | UF, UTM, dólar, euro, IPC, TMC, TAB. Segunda fuente oficial. |
| ✅ | **mindicador.cl** | API sin key | Réplica no oficial de indicadores del Banco Central. Solo respaldo. Ojo: su IPC está detenido en dic-2025. |
| — | **INE** (ine.gob.cl) | Archivo (sin API pública documentada); calendario en la *Agenda Estadística 2026* | IPC desagregado, ENE regional, remuneraciones, IPP, Censo 2024. |
| — | **Cochilco** | Archivo | Precio y producción de cobre. |
| — | **Superintendencia de Pensiones** | Archivo | Valor cuota y rentabilidad de fondos AFP. |
| — | **CNE – Energía Abierta** | API (Key) | Precios de combustibles y energía. |

### Códigos BDE verificados (páginas públicas de la BDE, nov-2026)

| Indicador | Código |
|---|---|
| Dólar observado | `F073.TCO.PRE.Z.D` |
| Euro | `F072.CLP.EUR.N.O.D` |
| UF | `F073.UFF.PRE.Z.D` |
| UTM | `F073.UTR.PRE.Z.M` |
| TPM | `F022.TPM.TIN.D001.NO.Z.D` |
| IPC variación mensual (INE) | `F074.IPC.VAR.Z.Z.C.M` |
| IPC variación 12 meses (empalme BCCh) | `G073.IPC.V12.2023.M` |
| Imacec (índice) | `F032.IMC.IND.Z.Z.EP18.Z.Z.0.M` |
| Imacec no minero (índice) | `F032.IMC.IND.Z.Z.EP18.N03.Z.0.M` |
| PIB volumen encadenado (trimestral) | `F032.PIB.FLU.R.CLP.EP18.Z.Z.0.T` |
| Desempleo nacional | `F049.DES.TAS.INE9.10.M` (regiones: `F049.DES.TAS.INE9.11.M` … `.26.M`) |
| Cobre BML | `F019.PPB.PRE.100.D` |
| Litio | `F019.PPB.PRE.37.D` |
| Petróleo WTI | `F019.PPB.PRE.41B.D` |
| Saldo balanza comercial | `F068.B1.VAR.T0.0.S.N.Z.Z.Z.Z.6.0.M` |
| Expectativa IPC 11 meses (EEE) | `F089.IPC.V12.14.M` |

Para buscar más códigos: abrir un cuadro en https://si3.bcentral.cl/Siete y revisar el atributo `data-serie` de cada fila,
o usar la función `SearchSeries` de la API.

## B. Chile en el mundo

| Estado | Fuente | Acceso | Qué aporta |
|---|---|---|---|
| ✅ | **Banco Mundial – WDI** (`api.worldbank.org/v2`) | API sin key. Agregados `OED` (OCDE) y `LCN` (América Latina y el Caribe) | PIB per cápita PPA, Gini, esperanza de vida, gasto en I+D, educación y salud, emisiones. |
| ✅ | **Banco Mundial – WGI** | API sin key, `source=3`, códigos `GOV_WGI_*.EST` | Control de la corrupción, Estado de derecho, Efectividad del gobierno, Voz y rendición de cuentas. Sin agregados regionales. |
| ✅ | **FMI – DataMapper / WEO** (`imf.org/external/datamapper/api/v1`) | API sin key (devuelve todos los países por indicador) | Crecimiento, inflación, desempleo, deuda, con proyecciones. Agregados: `WEOWORLD`, `ADVEC`, `OEMDC`, `SMQ` (América del Sur), `WHQ`. |
| — | **OCDE – SDMX** (`sdmx.oecd.org/public/rest`) | API sin key | Indicadores adelantados, PISA, Better Life, comparación con el promedio OCDE. |
| — | **PNUD – IDH** | Archivo anual (API opcional con key) | IDH e IDH ajustado por desigualdad. |
| — | **Transparency International – IPC** | Archivo anual | Puntaje y ranking de percepción de corrupción. |
| — | **Heritage / Fraser – Libertad económica** | Archivo anual | Puntaje y posición. |
| — | **World Happiness Report, Yale EPI, WIPO GII, RSF, Global Peace Index, Freedom House, V-Dem** | Archivo anual | Rankings por año. |
| ✕ | IMD World Competitiveness, WEF | Licencia no permite redistribuir | Solo enlazar. |

## C. Fiscal y transparencia (fase 2)

| Fuente | Acceso | Qué aporta |
|---|---|---|
| **DIPRES – datos abiertos** | Archivo + API CKAN vía datos.gob.cl | Ejecución presupuestaria mensual del Gobierno Central desde 2013, leyes de presupuesto, deuda bruta. Datos del SIAP. |
| **Presupuesto Abierto** (presupuestoabierto.gob.cl) | Archivo | Ejecución transaccional por institución. |
| **ChileCompra – API Mercado Público + API OCDS** | API (ticket gratuito) | Licitaciones, órdenes de compra, montos por organismo. |
| **InfoLobby** | Archivo / SPARQL | Audiencias, viajes y donativos. |
| **CPLT – InfoProbidad / CPLT en Línea** (dic-2025) | Archivo | Declaraciones de patrimonio e intereses, cumplimiento de transparencia, reclamos. El Portal de Transparencia no tiene API pública. |
| **Contraloría, SERVEL** | Archivo | Estadísticas de dictámenes, participación y gasto electoral. |

## D. Social y territorial (fase 3)

| Fuente | Qué aporta |
|---|---|
| **MDSF – Observatorio Social (CASEN)** | Pobreza por ingresos y multidimensional por región y comuna. |
| **DEIS – MINSAL** | Natalidad, mortalidad, egresos hospitalarios, listas de espera. |
| **Mineduc – datos abiertos** | Matrícula, asistencia, SIMCE/PAES agregados. |
| **CEAD – Subsecretaría de Prevención del Delito** | Casos policiales por comuna. |
| **SINIM** | Indicadores municipales. |
| **SINCA (MMA), DGA** | Calidad del aire, recursos hídricos. |
| **INE – Censo 2024 y proyecciones** | Población por región y comuna. |
| **datos.gob.cl** (CKAN, más de 255 organismos) | Catálogo general para descubrir nuevos datasets. |

Estas fuentes cambian de formato con frecuencia: cada una tendrá su propio conector con validación de esquema, y el
pipeline abrirá un issue cuando un formato cambie.
