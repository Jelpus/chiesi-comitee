Cambiar DSO view por  

metricas de AR en el mes
cartera vencida y no vencida por canal  (AGING)
Cobranza por canal y cliente


Vale acabamos de crear un nuevo modulo al proyecto :

commercial_operations_aging

Este pertenece a Commercial Operations y se incluira dentro de la seccion que hoy se llama DSO view, que sera renombrada por AR view:  y nos dará 2 entregables: Aging y Cobranza

Para actualizar la ifnormacion necestiamos subir un EXCEL que espera el arhivo contenta 3 worksheets o pestañas

Aging | aging | AGING
Forecast | FORECAST | forecast
Cobranza | COBRANZA | cobranza

En la misma carga debemos trabajar con las 3 informaicones

Aging: entregable 1
Cobranza y Forecast: entregable 2

##Proceso de Aging:
El worksheet espera las siguientes columnas (normalicemos para evitar que por algo no se detecte: minusculas, acentos, espacios, etc):

Account
Name - customer
Document Number
Document Date - invoice_date
Amount - invoice_amount
Reference
Due date - invoice_due_date
Terms of Payment - payment_group
Days past due - days_past_due
Assignment
Distribution Channel - channel_group
Expiration status - status (Vencido | vencido : Expired, Por Vencer, por vencer, Por vencer: Due to expire)
Aging - aging_group
Sales sector - channel
Billing Year - billing_year
Sold to - cutomer_groups
Management - managment

Para el aging (o informe de antigüedad de saldos) es la herramienta de gestión que clasifica las cuentas por cobrar de los clientes según el tiempo transcurrido desde su vencimiento
Su objetivo principal es medir la calidad de la cartera, identificar facturas impagadas y priorizar las acciones de cobranza para evitar que las deudas se conviertan en incobrables.

Como entregable debemos poder interpreater en diferentes drill downs : total > channel > customer - poder entender desde lo general hasta lo particular
- mostrar invoice_amount clasificado segun sus aging_group y vistas por cada status (Total, Expired, Due to expire)

Respuestas que debe resolver la informacion ademas de comunicar la informacion:
- ¿Que porcentaje de la cartera esta vencida y no vencida?
- Como se distribuye las carteras entre canales
- Cuales son clientes con mas cartera vencida, que clientes generan mayor riesgo financiero
- Cuanto dinero esta en mayor riesgo


## Proceso Cobranza y Forecast

### Workseet Cobranza
El worksheet espera las siguientes columnas (normalicemos para evitar que por algo no se detecte: minusculas, acentos, espacios, etc):
Filtrar y dejar solo document_type = "BI"

Account
Name 1 - customer
Invoice Reference
Assignment
Reference
Document Number
Document Date
Payment Date
Terms of Payment
Document Type - document_type
Amount in Local Currency - invoice_amount
Arrears by Net Due Date  - period_month
Customer Reference
Clearing Document
Net Due Date
Distribution Channel  - channel_group
Text
Document Header Text
Fiscal Year


### Worksheet Forecast
El worksheet espera las siguientes columnas (normalicemos para evitar que por algo no se detecte: minusculas, acentos, espacios, etc):
Filtrar y dejar solo document_type = "CA"
Si Data As Of May 2026 (2026-05-01) filtrar period_month que sean (YEAR, month) y (Year, month -1 ) > en este caso seria Abril 2026 y Mayo 2026

Account
Name 1 - customer
Invoice Reference
Assignment
Reference
Document Number
Document Date
Payment Date
Terms of Payment
Document Type  - document_type
Amount in Local Currency - invoice_amount
Arrears by Net Due Date
Customer Reference
Clearing Document
Net Due Date - period_month
Distribution Channel  - channel_group
Text
Document Header Text
Fiscal Year

Este entregable se trata de dos cosas... uno mostrar la cobranza real durante el periodo y poder contrastar con el forecast

Como entregable debemos poder interpreater en diferentes drill downs : total > channel > customer - poder entender desde lo general hasta lo particular
- mostrar invoice_amount y cobertura vs forecast

Respuestas que debe resolver la informacion ademas de comunicar la informacion:
- ¿Que canales generan la cobranza?
- Cual es la desviacion vs el forecast?
- ¿Que clientes generan esta desviacion?
