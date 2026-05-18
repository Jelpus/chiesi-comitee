export type ExpectedUploadColumnGroup = {
  label: string;
  columns: string[];
  helper?: string;
};

const definitions: Record<string, ExpectedUploadColumnGroup[]> = {
  sales_internal: [
    { label: 'Identificacion', columns: ['Key', 'Code for FPA', 'Description for FPA'] },
    { label: 'Valores mensuales', columns: ['January 2026', 'February 2026', '...'] },
  ],
  business_excellence_ddd: [
    { label: 'Producto', columns: ['PACK_DES', 'Pack Description'] },
    { label: 'Periodo', columns: ['MONTH', 'YEAR'] },
    { label: 'Metricas', columns: ['UN', 'LC'] },
  ],
  business_excellence_pmm: [
    { label: 'Producto', columns: ['PACK_DES', 'Pack Description'] },
    { label: 'Periodo', columns: ['MONTH', 'YEAR'] },
    { label: 'Metricas', columns: ['UN', 'LC'] },
  ],
  pmm: [
    { label: 'Producto', columns: ['PACK_DES', 'Pack Description'] },
    { label: 'Periodo', columns: ['MONTH', 'YEAR'] },
    { label: 'Metricas', columns: ['UN', 'LC'] },
  ],
  ddd: [
    { label: 'Producto', columns: ['PACK_DES', 'Pack Description'] },
    { label: 'Periodo', columns: ['MONTH', 'YEAR'] },
    { label: 'Metricas', columns: ['UN', 'LC'] },
  ],
  business_excellence_closeup: [
    { label: 'Producto', columns: ['Producto', 'Product', 'PRODUCTO_NAME'] },
    { label: 'Medico', columns: ['Nombre Médico', 'Nombre Medico', 'HCP Name'] },
    { label: 'Periodo', columns: ['Date', 'Fecha', 'Period', 'Month'] },
    { label: 'Recetas', columns: ['Recetas', 'Rx', 'Prescripciones'] },
  ],
  closeup: [
    { label: 'Producto', columns: ['Producto', 'Product', 'PRODUCTO_NAME'] },
    { label: 'Medico', columns: ['Nombre Médico', 'Nombre Medico', 'HCP Name'] },
    { label: 'Periodo', columns: ['Date', 'Fecha', 'Period', 'Month'] },
    { label: 'Recetas', columns: ['Recetas', 'Rx', 'Prescripciones'] },
  ],
  business_excellence_brick_assignment: [
    { label: 'Brick', columns: ['BRICK_COD', 'BRICK', 'ID BRICK'] },
    { label: 'Territorio', columns: ['TERRITORY', 'Territorio', 'REFERENCIA', 'PRIORIDAD'] },
  ],
  business_excellence_bricks_visited: [
    { label: 'Brick', columns: ['BRICK_COD', 'BRICK', 'ID BRICK'] },
    { label: 'Territorio', columns: ['TERRITORY', 'Territorio', 'REFERENCIA', 'PRIORIDAD'] },
  ],
  bricks_visited: [
    { label: 'Brick', columns: ['BRICK_COD', 'BRICK', 'ID BRICK'] },
    { label: 'Territorio', columns: ['TERRITORY', 'Territorio', 'REFERENCIA', 'PRIORIDAD'] },
  ],
  business_excellence_budget_sell_out: [
    { label: 'Periodo', columns: ['Date', 'Fecha', 'Period', 'Periodo'] },
    { label: 'Productos', columns: ['Columnas de producto con valores numericos'] },
  ],
  business_excellence_sell_out: [
    { label: 'Periodo', columns: ['Date', 'Fecha', 'Period', 'Periodo'] },
    { label: 'Productos', columns: ['Columnas de producto con valores numericos'] },
  ],
  sell_out: [
    { label: 'Periodo', columns: ['Date', 'Fecha', 'Period', 'Periodo'] },
    { label: 'Productos', columns: ['Columnas de producto con valores numericos'] },
  ],
  business_excellence_iqvia_weekly: [
    { label: 'Periodo', columns: ['Week', 'Date', 'Fecha', 'Period'] },
    { label: 'Producto', columns: ['PACK_DES', 'PROD_DES', 'PRODCODE'] },
    { label: 'Metricas', columns: ['UN', 'LC', 'Net Sales'] },
  ],
  business_excellence_weekly_tracking: [
    { label: 'Periodo', columns: ['Week', 'Date', 'Fecha', 'Period'] },
    { label: 'Producto', columns: ['PACK_DES', 'PROD_DES', 'PRODCODE'] },
    { label: 'Metricas', columns: ['UN', 'LC', 'Net Sales'] },
  ],
  iqvia_weekly: [
    { label: 'Periodo', columns: ['Week', 'Date', 'Fecha', 'Period'] },
    { label: 'Producto', columns: ['PACK_DES', 'PROD_DES', 'PRODCODE'] },
    { label: 'Metricas', columns: ['UN', 'LC', 'Net Sales'] },
  ],
  weekly_tracking: [
    { label: 'Periodo', columns: ['Week', 'Date', 'Fecha', 'Period'] },
    { label: 'Producto', columns: ['PACK_DES', 'PROD_DES', 'PRODCODE'] },
    { label: 'Metricas', columns: ['UN', 'LC', 'Net Sales'] },
  ],
  business_excellence_salesforce_fichero_medico: [
    { label: 'Contacto', columns: ['Onekey ID'] },
    { label: 'Territorio', columns: ['Territory', 'Territorio'] },
    { label: 'Periodo', columns: ['Mes', 'Month', 'Periodo'] },
  ],
  business_excellence_fichero_medico: [
    { label: 'Contacto', columns: ['Onekey ID'] },
    { label: 'Territorio', columns: ['Territory', 'Territorio'] },
    { label: 'Periodo', columns: ['Mes', 'Month', 'Periodo'] },
  ],
  fichero_medico: [
    { label: 'Contacto', columns: ['Onekey ID'] },
    { label: 'Territorio', columns: ['Territory', 'Territorio'] },
    { label: 'Periodo', columns: ['Mes', 'Month', 'Periodo'] },
  ],
  business_excellence_salesforce_tft: [
    { label: 'Territorio', columns: ['Territorio', 'Territory'] },
    { label: 'Fecha', columns: ['Fecha de inicio', 'Start Date'] },
    { label: 'Duracion', columns: ['Days', 'Dias'] },
  ],
  business_excellence_tft: [
    { label: 'Territorio', columns: ['Territorio', 'Territory'] },
    { label: 'Fecha', columns: ['Fecha de inicio', 'Start Date'] },
    { label: 'Duracion', columns: ['Days', 'Dias'] },
  ],
  tft: [
    { label: 'Territorio', columns: ['Territorio', 'Territory'] },
    { label: 'Fecha', columns: ['Fecha de inicio', 'Start Date'] },
    { label: 'Duracion', columns: ['Days', 'Dias'] },
  ],
  business_excellence_salesforce_interacciones: [
    { label: 'Interaccion', columns: ['Interaction: Id.', 'Interaction: Call Name'] },
    { label: 'Cuenta', columns: ['Cuenta: Codigo OneKey', 'Onekey ID'] },
    { label: 'Territorio y fecha', columns: ['Territorio', 'Fecha y Hora'] },
  ],
  business_excellence_interacciones: [
    { label: 'Interaccion', columns: ['Interaction: Id.', 'Interaction: Call Name'] },
    { label: 'Cuenta', columns: ['Cuenta: Codigo OneKey', 'Onekey ID'] },
    { label: 'Territorio y fecha', columns: ['Territorio', 'Fecha y Hora'] },
  ],
  interacciones: [
    { label: 'Interaccion', columns: ['Interaction: Id.', 'Interaction: Call Name'] },
    { label: 'Cuenta', columns: ['Cuenta: Codigo OneKey', 'Onekey ID'] },
    { label: 'Territorio y fecha', columns: ['Territorio', 'Fecha y Hora'] },
  ],
  business_excellence_standard_days: [
    { label: 'Periodo', columns: ['periodo'] },
    { label: 'Dias estandar', columns: ['standard_days'] },
  ],
  business_excellence_recompra_lexicomp: [
    { label: 'Fecha y periodo', columns: ['Fecha', 'AÑO', 'MES'] },
    { label: 'Cliente y ruta', columns: ['DISTRIBUIDOR', 'Cliente', 'AGRUPADOR', 'CORPORATIVO', 'RUTA'] },
    { label: 'Metricas y equipo', columns: ['Piezas Vendidas', 'Médico', 'EJECUTIVO', 'GERENTE'] },
  ],
  human_resources_open_vacancy: [
    { label: 'Vacante', columns: ['ESTATUS', 'UBICACION', 'AREA', 'TIPO', 'SUBTIPO'] },
    { label: 'Responsables', columns: ['MANAGER', 'RESP HR', 'AGENCIA', 'ENCARGADA'] },
    { label: 'Fechas y KPI', columns: ['Fecha inicio busqueda', 'Fecha fin', 'Time to fill', 'Fecha ingreso'] },
  ],
  commercial_operations_dso: [
    { label: 'Estructura', columns: ['Secciones B2B/B2C/Gobierno/Privado'] },
    { label: 'Periodo', columns: ['Year', 'Jan', 'Feb', 'Mar', '...'] },
    { label: 'Valores', columns: ['Filas por ano con valores numericos'] },
  ],
  commercial_operations_days_sales_outstanding: [
    { label: 'Estructura', columns: ['Secciones B2B/B2C/Gobierno/Privado'] },
    { label: 'Periodo', columns: ['Year', 'Jan', 'Feb', 'Mar', '...'] },
    { label: 'Valores', columns: ['Filas por ano con valores numericos'] },
  ],
  dso: [
    { label: 'Estructura', columns: ['Secciones B2B/B2C/Gobierno/Privado'] },
    { label: 'Periodo', columns: ['Year', 'Jan', 'Feb', 'Mar', '...'] },
    { label: 'Valores', columns: ['Filas por ano con valores numericos'] },
  ],
  commercial_operations_government_orders: [
    { label: 'Producto y fechas', columns: ['MEDICAMENTO', 'FECHA PEDIDO SAP', 'FECHA DE PEDIDO'] },
    { label: 'Cantidad', columns: ['CANTIDAD ENTREGADA', 'CANTIDAD SUMINISTRADA', 'CONFIRMADAS'] },
  ],
  government_orders: [
    { label: 'Producto y fechas', columns: ['MEDICAMENTO', 'FECHA PEDIDO SAP', 'FECHA DE PEDIDO'] },
    { label: 'Cantidad', columns: ['CANTIDAD ENTREGADA', 'CANTIDAD SUMINISTRADA', 'CONFIRMADAS'] },
  ],
  commercial_operations_private_orders: [
    { label: 'Producto y fechas', columns: ['Material', 'Product code', 'Order date'] },
    { label: 'Cantidad', columns: ['Cantidad de pedido', 'pzas', 'NO. PIEZAS ENTREGADAS'] },
    { label: 'Operacion', columns: ['Canal', 'Cliente', 'Orden', 'FACTURAS Y NC'] },
  ],
  private_orders: [
    { label: 'Producto y fechas', columns: ['Material', 'Product code', 'Order date'] },
    { label: 'Cantidad', columns: ['Cantidad de pedido', 'pzas', 'NO. PIEZAS ENTREGADAS'] },
    { label: 'Operacion', columns: ['Canal', 'Cliente', 'Orden', 'FACTURAS Y NC'] },
  ],
  commercial_operations_stocks: [
    { label: 'Producto', columns: ['Producto', 'MEDICAMENTO'] },
    { label: 'Clasificacion', columns: ['Tipo Negocio', 'Mercado', 'Cliente'] },
    { label: 'Valores mensuales', columns: ['January 2026', 'February 2026', '...'] },
  ],
  commercial_operations_incidencias: [
    { label: 'Periodo y orden', columns: ['Mes', 'Order date', 'Orden', 'Referencia cliente'] },
    { label: 'Cliente y canal', columns: ['Solicitante', 'Goods consignee', 'ShipTo City', 'Region', 'Canal'] },
    { label: 'OTIF', columns: ['OTIF', 'TIPO', 'OBSERVACION', 'NO. PIEZAS ENTREGADAS'] },
  ],
  commercial_operations_sanctions: [
    { label: 'Periodo', columns: ['AÑO', 'MES DE PROVISION'] },
    { label: 'Responsable y cliente', columns: ['RESPONSABLE DE SANCION', 'GRUPO CLIENTE'] },
    { label: 'Producto y sancion', columns: ['MEDICAMENTO', 'SANCION ESTIMADA', 'MOTIVO DE SANCION'] },
  ],
  stocks: [
    { label: 'Producto', columns: ['Producto', 'MEDICAMENTO'] },
    { label: 'Clasificacion', columns: ['Tipo Negocio', 'Mercado', 'Cliente'] },
    { label: 'Valores mensuales', columns: ['January 2026', 'February 2026', '...'] },
  ],
  opex_by_cc: [
    { label: 'Hojas requeridas', columns: ['Previous/Ant', 'Budget/Presupuesto', 'Current/Actual'] },
    { label: 'Catalogo', columns: ['Key1', 'Key2', 'Account', 'CeCo'] },
    { label: 'Valores', columns: ['Jan', 'Feb', 'Mar', '...'] },
  ],
  opex_master_catalog: [
    { label: 'Hojas requeridas', columns: ['Previous/Ant', 'Budget/Presupuesto', 'Current/Actual'] },
    { label: 'Catalogo', columns: ['Key1', 'Key2', 'Account', 'CeCo'] },
    { label: 'Valores', columns: ['Jan', 'Feb', 'Mar', '...'] },
  ],
};

export function getExpectedUploadColumnGroups(moduleCode: string) {
  return definitions[moduleCode.trim().toLowerCase()] ?? [];
}
