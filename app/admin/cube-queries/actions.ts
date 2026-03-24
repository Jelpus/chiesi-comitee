'use server';

import {
  getCubePeriodValues,
  getCubeTableSchema,
  runCubeQuery,
  type CubeQueryInput,
} from '@/lib/bigquery/cube-queries';

export async function getCubeQuerySchema(optionKey: string) {
  return getCubeTableSchema(optionKey);
}

export async function getCubeQueryPeriods(optionKey: string, periodColumn: string) {
  return getCubePeriodValues(optionKey, periodColumn, 500);
}

export async function runCubePreviewQuery(input: CubeQueryInput) {
  const previewInput: CubeQueryInput = {
    ...input,
    previewLimit: input.previewLimit ?? 1000,
  };
  return runCubeQuery(previewInput);
}
