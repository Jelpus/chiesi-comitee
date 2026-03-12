import 'server-only';
import { getBigQueryClient } from './client';

export async function testBigQueryConnection() {
  const client = getBigQueryClient();

  const query = `
    SELECT 1 AS ok
  `;

  const [rows] = await client.query({ query });

  return rows;
}