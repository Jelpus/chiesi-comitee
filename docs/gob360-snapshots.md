# Controles GOB360 Air y Care

## Regla de datos

Cada Excel se carga como un snapshot opcional. El operador elige el **último mes validado**; las columnas posteriores se descartan aunque tengan números. El parser toma `CLAVE`, `CLUE`, `PIEZAS` y mes, expande celdas combinadas y suma filas de la misma llave `(CLAVE normalizada, CLUE, mes)`. Compara cada suma mensual con la fila 4. Una celda vacía no crea control; un cero sí.

Las vistas efectivas sustituyen `PIEZAS` por el valor del snapshot activo cuando existe esa llave y mes. Si falta, conservan BigQuery. Para filas BigQuery con varias rutas, el ajuste se distribuye en proporción a las piezas existentes. Si la suma BigQuery de la llave es cero, se conservan esas filas y se agrega una fila de ajuste sin ruta atribuida. Las filas solo presentes en el Excel también se agregan sin dimensiones no disponibles. `FECHA` determina el mes de venta; `FECHA_MOVIL` permanece como campo original de la fuente.

El snapshot activo sigue aplicando a los meses incluidos cuando avanzan los reportes. Otro upload publicado del mismo módulo lo reemplaza; el anterior queda archivado con sus controles y hash del archivo original. La selección es global por módulo, así que volver a ejecutar una consulta histórica después de un reemplazo puede dar otro resultado. Las tablas materializadas EU conservan su resultado hasta que se refrescan.

## Preparación y activación

1. Ejecutar `sql/admin/011_gob360_snapshots_us.sql` como job **US** en `chiesi-committee`.
2. Ejecutar `node scripts/setup-gob360-mirror.mjs --apply`. Crea `gob360_mirror` en US con acceso restringido, copia las tablas PC/SC usando la cuenta de servicio GOB360, autoriza las dos vistas existentes sobre ese dataset y cambia las vistas para leer la copia. Sin `--apply` solo inspecciona el estado.
3. Ejecutar `sql/admin/011_gob360_snapshots.sql` como job **EU**, después de la migración existente de `dim_module`.
4. Dar al service account de `GOB360_CLIENT_EMAIL` permiso de lectura sobre `chiesi-committee.gob360_snapshots`; verificar una consulta a ambas vistas desde ese principal. La cuenta de la aplicación necesita permiso de escritura en el dataset US. El setup concede a la cuenta GOB360 escritura solo sobre `gob360_mirror`.
5. Registrar y publicar los Excel desde Prepare o Admin, escogiendo el corte validado manualmente. Revisar las sumas, filas y meses excluidos. Para los archivos de referencia: Air hasta **2026-08**, Care hasta **2026-07**.
6. Solo después de validar las vistas y la reconciliación, configurar `GOB360_SNAPSHOT_ENABLED=true` en el entorno de la aplicación. Sin esa variable, las consultas siguen leyendo las tablas originales de GOB360. Una publicación Air con la bandera activa refresca el serving público de la versión seleccionada; una repetición de Publish reintenta ese refresco.

Las tablas `manifest`, `pieces` y la copia de GOB360 están en US. Los metadatos de uploads y el serving del Comité siguen en EU; no hacer joins entre ambas regiones. La copia de GOB360 se refresca cada día a las 03:17 UTC mediante `/api/cron/gob360-mirror` y conserva la última versión completa si falla un refresco. Las nuevas cargas del Excel aplican a las vistas en cuanto se activan; los cambios de la fuente GOB360 aparecen tras el siguiente refresco de la copia.

## Consultar las vistas desde BigQuery con una cuenta personal

Las vistas conservan sus nombres y columnas:

- `chiesi-committee.gob360_snapshots.vw_pc_sales_effective`
- `chiesi-committee.gob360_snapshots.vw_sc_sales_effective`

Ahora leen `gob360_mirror.pc_sales_source` y `gob360_mirror.sc_sales_source`, respectivamente, en lugar de consultar directamente el proyecto `gob360`. El dataset espejo permite leer sus tablas a **esas dos vistas autorizadas**, sin conceder a los lectores acceso directo a las copias. La persona que consulta necesita lectura sobre `gob360_snapshots` y `bigquery.jobs.create` en su proyecto de ejecución. Las vistas exponen las columnas originales de ventas además de `PIEZAS` corregidas.

La vista sigue aplicando el control `(CLAVE, CLUE, mes)` del snapshot activo en cada consulta. Si no hay control, usa las piezas de la copia GOB360. Si GOB360 cambia después del último refresco, la vista mostrará la versión copiada hasta el siguiente ciclo. Se puede ejecutar de nuevo `node scripts/setup-gob360-mirror.mjs --apply` para forzar un refresco y comprobar filas y fecha sin esperar al cron.

En la aplicación, `getGob360TableRefs()` selecciona estas vistas para las ventas PC y SC cuando `GOB360_SNAPSHOT_ENABLED=true`. Lo usan Business Excellence, Air público, la vista previa de tablas y el catálogo de claves sin mapear. El test de conexión de Admin sigue consultando las tablas originales para comprobar el acceso a GOB360; las tablas de estructura PC/SC siguen en origen porque el Excel solo controla piezas de ventas. Air público conserva su serving EU hasta que se refresca tras Publish o mediante su flujo de actualización.

## Verificaciones antes de habilitar

- Comprobar que solo hay un `manifest.status = 'active'` por módulo y que `control_rows` coincide con `COUNT(*)` de `pieces` para su `snapshot_id`.
- Reconciliar por `(CLAVE normalizada, CLUE, mes)`: con control, la suma de `PIEZAS` de la vista debe igualar el Excel; sin control debe igualar la fuente GOB360. Verificar un cero explícito, una celda vacía, una llave solo en Excel y un mes posterior al corte.
- Confirmar consultas de Business Excellence Air/Care y el serving público AIR para la versión publicada. Una compilación local no demuestra permisos, costos ni resultados de producción.
