import { NextResponse } from 'next/server';
import {
  applyCubeValueFilters,
  applyCubeEnrichment,
  buildCubeQuery,
  createCubeEnrichmentCache,
  getCubeQueryClient,
  getCubeQueryLocation,
  getCubeTableSchema,
  type CubeQueryInput,
} from '@/lib/bigquery/cube-queries';

export const dynamic = 'force-dynamic';

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const maybeWrapped = value as Record<string, unknown>;
    if ('value' in maybeWrapped && Object.keys(maybeWrapped).length <= 2) {
      return normalizeCellValue(maybeWrapped.value);
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CubeQueryInput;
    if (!body?.optionKey) {
      return NextResponse.json({ error: 'Missing optionKey.' }, { status: 400 });
    }

    const schema = await getCubeTableSchema(body.optionKey);
    const built = buildCubeQuery(
      {
        ...body,
        previewLimit: null,
      },
      schema.columns,
    );
    const client = getCubeQueryClient(body.optionKey);
    const location = getCubeQueryLocation(body.optionKey);

    const [job] = await client.createQueryJob({
      query: built.query,
      params: built.params,
      location,
    });

    const encoder = new TextEncoder();
    let headerSent = false;
    const enrichmentCache = createCubeEnrichmentCache();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let pageToken: string | undefined;
          do {
            const [rows, nextQuery, response] = await job.getQueryResults({
              autoPaginate: false,
              maxResults: 10000,
              pageToken,
            });

            const typedRows = rows as Array<Record<string, unknown>>;
            const enrichedRows = await applyCubeEnrichment(typedRows, built.enrichment, enrichmentCache);
            const filteredRows = applyCubeValueFilters(enrichedRows, body.valueFilters);
            const columns = built.selectedColumns;

            if (!headerSent) {
              controller.enqueue(encoder.encode(`${columns.map((column) => escapeCsvCell(column)).join(',')}\n`));
              headerSent = true;
            }

            for (const row of filteredRows) {
              const line = columns.map((column) => escapeCsvCell(normalizeCellValue(row[column]))).join(',');
              controller.enqueue(encoder.encode(`${line}\n`));
            }

            pageToken = (response as { pageToken?: string } | undefined)?.pageToken;
            if (nextQuery?.pageToken) {
              pageToken = nextQuery.pageToken;
            }
          } while (pageToken);

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    const filename = `cube_query_${built.tableId.replace(/[^a-zA-Z0-9_.-]/g, '_')}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
