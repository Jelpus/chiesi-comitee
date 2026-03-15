import 'server-only';
import { BigQuery } from '@google-cloud/bigquery';
import { getBigQueryClient } from '@/lib/bigquery/client';

let gob360BigQueryClient: BigQuery | null = null;

function getGob360PrivateKey() {
  const key = process.env.GOB360_PRIVATE_KEY;
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
}

export function getGob360BigQueryClient(strict = false) {
  if (gob360BigQueryClient) return gob360BigQueryClient;

  const projectId = process.env.GOB360_PROJECT_ID || process.env.GCP_PROJECT_ID || 'chiesi-committee';
  const clientEmail = process.env.GOB360_CLIENT_EMAIL;
  const privateKey = getGob360PrivateKey();

  if (clientEmail && privateKey) {
    gob360BigQueryClient = new BigQuery({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    });
    return gob360BigQueryClient;
  }

  if (strict) {
    throw new Error(
      'Missing GOB360 credentials. Set GOB360_CLIENT_EMAIL and GOB360_PRIVATE_KEY in .env.local.',
    );
  }

  return getBigQueryClient();
}

export function getGob360TableRefs() {
  const projectId = process.env.GOB360_PROJECT_ID || process.env.GCP_PROJECT_ID || 'chiesi-committee';
  const datasetId = process.env.GOB360_DATASET_ID || 'CHIESI_EXTERNAL';
  const pcSalesTable = process.env.GOB360_PC_TABLE || 'CHIESI_PC_VENTAS_EXTERNAL';
  const scSalesTable = process.env.GOB360_SC_TABLE || 'CHIESI_SC_VENTAS_EXTERNAL';
  const pcStructureTable = process.env.GOB360_SALESFORCE_PC_TABLE || 'CHIESI_ESTRUCTURA_PC';
  const scStructureTable = process.env.GOB360_SALESFORCE_SC_TABLE || 'CHIESI_ESTRUCTURA_SC';

  return {
    projectId,
    datasetId,
    pcSalesTable,
    scSalesTable,
    pcStructureTable,
    scStructureTable,
    pcSalesTableId: `${projectId}.${datasetId}.${pcSalesTable}`,
    scSalesTableId: `${projectId}.${datasetId}.${scSalesTable}`,
    pcStructureTableId: `${projectId}.${datasetId}.${pcStructureTable}`,
    scStructureTableId: `${projectId}.${datasetId}.${scStructureTable}`,
  };
}
