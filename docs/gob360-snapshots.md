# Controles GOB360 Air y Care

## Regla de datos

Cada Excel se carga como un snapshot opcional. El operador elige el **último mes validado**; las columnas posteriores se descartan aunque tengan números. El parser toma `CLAVE`, `CLUE`, `PIEZAS` y mes, expande celdas combinadas y suma filas de la misma llave `(CLAVE normalizada, CLUE, mes)`. Compara cada suma mensual con la fila 4. Una celda vacía no crea control; un cero sí.

Las vistas efectivas sustituyen `PIEZAS` por el valor del snapshot activo cuando existe esa llave y mes. Si falta, conservan BigQuery. Para filas BigQuery con varias rutas, el ajuste se distribuye en proporción a las piezas existentes. Si la suma BigQuery de la llave es cero, se conservan esas filas y se agrega una fila de ajuste sin ruta atribuida. Las filas solo presentes en el Excel también se agregan sin dimensiones no disponibles. `FECHA` determina el mes de venta; `FECHA_MOVIL` permanece como campo original de la fuente.

El snapshot activo sigue aplicando a los meses incluidos cuando avanzan los reportes. Otro upload publicado del mismo módulo lo reemplaza; el anterior queda archivado con sus controles y hash del archivo original. La selección es global por módulo, así que volver a ejecutar una consulta histórica después de un reemplazo puede dar otro resultado. Las tablas materializadas EU conservan su resultado hasta que se refrescan.

## Preparación y activación

1. Ejecutar `sql/admin/011_gob360_snapshots_us.sql` como job **US** en `chiesi-committee`.
2. Ejecutar las dos vistas `sql/views/vw_gob360_pc_sales_effective.sql` y `sql/views/vw_gob360_sc_sales_effective.sql` como jobs **US**, con un principal que pueda leer las tablas fuente y crear vistas en el dataset nuevo.
3. Ejecutar `sql/admin/011_gob360_snapshots.sql` como job **EU**, después de la migración existente de `dim_module`.
4. Dar al service account de `GOB360_CLIENT_EMAIL` permiso de lectura sobre `chiesi-committee.gob360_snapshots`; verificar una consulta a ambas vistas desde ese principal. La cuenta de la aplicación necesita permiso de escritura en el dataset US.
5. Registrar y publicar los Excel desde Prepare o Admin, escogiendo el corte validado manualmente. Revisar las sumas, filas y meses excluidos. Para los archivos de referencia: Air hasta **2026-08**, Care hasta **2026-07**.
6. Solo después de validar las vistas y la reconciliación, configurar `GOB360_SNAPSHOT_ENABLED=true` en el entorno de la aplicación. Sin esa variable, las consultas siguen leyendo las tablas originales de GOB360. Una publicación Air con la bandera activa refresca el serving público de la versión seleccionada; una repetición de Publish reintenta ese refresco.

Las tablas `manifest` y `pieces` están en US para permitir consultas junto con las tablas `gob360.CHIESI_EXTERNAL`. Los metadatos de uploads y el serving del Comité siguen en EU; no hacer joins entre ambas regiones.

## Verificaciones antes de habilitar

- Comprobar que solo hay un `manifest.status = 'active'` por módulo y que `control_rows` coincide con `COUNT(*)` de `pieces` para su `snapshot_id`.
- Reconciliar por `(CLAVE normalizada, CLUE, mes)`: con control, la suma de `PIEZAS` de la vista debe igualar el Excel; sin control debe igualar la fuente GOB360. Verificar un cero explícito, una celda vacía, una llave solo en Excel y un mes posterior al corte.
- Confirmar consultas de Business Excellence Air/Care y el serving público AIR para la versión publicada. Una compilación local no demuestra permisos, costos ni resultados de producción.
