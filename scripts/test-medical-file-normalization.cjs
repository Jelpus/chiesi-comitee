/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function scenario(count, { invalid = () => false, failBatch = 0, fullName = 'Fixture' } = {}) {
  const raw = Array.from({ length: count }, (_, i) => ({ row_number: i + 2 }));
  let checkpoint;
  let committed = 0;
  const staged = new Set();
  const reads = [];
  const requests = [];
  const client = { async query({ query, params }) {
    if (query.startsWith('CREATE TABLE')) return [[]];
    if (query.startsWith('SELECT * FROM')) return [[...(checkpoint ? [{ ...checkpoint }] : [])]];
    if (query.startsWith('BEGIN TRANSACTION')) {
      staged.clear();
      checkpoint = { last_row_number: 0, source_rows: raw.length, rows_valid: 0, rows_error: 0 };
      return [[]];
    }
    if (query.includes('CREATE TEMP TABLE batch')) {
      requests.push({ query, params });
      if (requests.length === failBatch) throw new Error('Simulated transaction failure');
      assert.equal(params.cursor, checkpoint.last_row_number);
      assert.ok(Buffer.byteLength(params.batch, 'utf8') <= 2_000_002);
      for (const row of JSON.parse(params.batch)) {
        assert.ok(row.row_number > checkpoint.last_row_number);
        if (row.status === 'valid') {
          assert.equal(staged.has(row.row_number), false, 'a resumed batch must not duplicate staging');
          staged.add(row.row_number);
        }
      }
      checkpoint.last_row_number = params.lastRow;
      checkpoint.rows_valid += params.valid;
      checkpoint.rows_error += params.errors;
      committed += 1;
      return [[]];
    }
    if (query.includes('distinct_staged')) return [[{
      source_rows: raw.length, remaining: raw.filter((r) => r.row_number > params.cursor).length,
      staged: staged.size, distinct_staged: staged.size,
    }]];
    if (query.includes('JSON_VALUE(issue)')) return [[...(checkpoint.rows_error ? [{ reason: 'Invalid row', count: checkpoint.rows_error }] : [])]];
    if (query.startsWith('DELETE FROM') && query.includes('previous.upload_id')) {
      assert.equal(checkpoint.rows_valid + checkpoint.rows_error, raw.length, 'retire old staging only after completion');
      return [[]];
    }
    throw new Error(`Unexpected query: ${query}`);
  } };
  const filename = path.resolve(__dirname, '../lib/uploads/medical-file-normalization.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = new Module(filename);
  loadedModule.filename = filename;
  loadedModule.require = (name) => {
    if (name === 'server-only') return {};
    if (name === '@/lib/bigquery/client') return { getBigQueryClient: () => client };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  loadedModule._compile(compiled, filename);
  const dependencies = {
    ensureSchema: async () => {},
    readPage: async (_id, cursor, limit) => {
      reads.push(cursor);
      return raw.filter((row) => row.row_number > cursor).slice(0, limit);
    },
    normalize: (rows) => ({
      validations: rows.map((row) => ({ rowNumber: row.row_number,
        validationStatus: invalid(row.row_number) ? 'error' : 'valid',
        errors: invalid(row.row_number) ? ['Invalid row'] : [] })),
      normalizedRows: rows.filter((row) => !invalid(row.row_number)).map((row) => ({
        rowNumber: row.row_number, onekeyId: 'fixture', territory: 'CHMX101', territoryNormalized: 'CHMX101',
        bu: null, district: null, imsId: null, fullName, specialtyConsolidated: null,
        periodMonth: '2026-09-01', objetivo: null, potencial: null,
      })),
    }),
  };
  return { run: (resume) => loadedModule.exports.normalizeMedicalFileInPages('fixture-upload', resume, dependencies),
    raw, staged, reads, requests, get committed() { return committed; } };
}

test('commits valid and invalid rows together and retains their error summary', async () => {
  const fixture = scenario(25, { invalid: (row) => row % 5 === 0 });
  const result = await fixture.run(false);
  assert.equal(result.incomplete, false);
  assert.equal(result.rowsValid, 20);
  assert.equal(result.rowsError, 5);
  assert.deepEqual(result.topValidationIssues, [{ reason: 'Invalid row', count: 5 }]);
  assert.equal(fixture.staged.size, 20);
});

test('resumes beyond the per-call page limit without repeating earlier rows', async () => {
  const fixture = scenario(21000);
  const first = await fixture.run(false);
  assert.equal(first.incomplete, true);
  assert.equal(first.rowsValid, 20000);
  const result = await fixture.run(true);
  assert.equal(fixture.reads[4], 20001);
  assert.equal(result.incomplete, false);
  assert.equal(result.normalizedRows, 21000);
});

test('an all-error page advances the cursor even when staging stays empty', async () => {
  const fixture = scenario(21000, { invalid: () => true });
  assert.equal((await fixture.run(false)).incomplete, true);
  const result = await fixture.run(true);
  assert.equal(result.incomplete, false);
  assert.equal(result.rowsError, 21000);
  assert.equal(result.normalizedRows, 0);
});

test('a failed batch resumes from the last committed transaction', async () => {
  const fixture = scenario(12000, { failBatch: 2 });
  await assert.rejects(fixture.run(false), /Simulated transaction failure/);
  assert.equal(fixture.committed, 1);
  assert.equal(fixture.staged.size, 5000);
  const result = await fixture.run(true);
  assert.equal(result.incomplete, false);
  assert.equal(result.normalizedRows, 12000);
  assert.equal(fixture.reads[2], 5001);
});

test('source row changes prevent a successful completion', async () => {
  const fixture = scenario(21000);
  await fixture.run(false);
  fixture.raw.push({ row_number: 22000 });
  await assert.rejects(fixture.run(true), /verification failed/);
});

test('splits large UTF-8 parameters without skipping rows within a page', async () => {
  const fixture = scenario(500, { fullName: 'é'.repeat(3000) });
  const result = await fixture.run(false);
  assert.ok(fixture.requests.length > 1);
  assert.equal(result.incomplete, false);
  assert.equal(result.normalizedRows, 500);
});
