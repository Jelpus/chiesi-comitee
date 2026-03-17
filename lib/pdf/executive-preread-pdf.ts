import 'server-only';

import type { ExecutivePreReadSnapshotRow } from '@/lib/data/excecutive/get-executive-insights-preread-snapshot';

type PdfPayload = {
  versionLabel: string;
  periodLabel: string;
  generatedAt: string;
  rows: ExecutivePreReadSnapshotRow[];
};

function toAsciiText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(input: string, maxChars: number) {
  const words = toAsciiText(input).split(' ').filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

type PdfLine = {
  text: string;
  style: 'title' | 'subtitle' | 'section' | 'body' | 'small';
};

function buildLines(payload: PdfPayload): PdfLine[] {
  const lines: PdfLine[] = [];
  lines.push({ text: 'Executive Pre-Read Paper', style: 'title' });
  lines.push({ text: `Version: ${payload.versionLabel}`, style: 'subtitle' });
  lines.push({ text: `Period: ${payload.periodLabel}`, style: 'subtitle' });
  lines.push({ text: `Generated: ${payload.generatedAt}`, style: 'small' });
  lines.push({ text: '', style: 'body' });

  for (const row of payload.rows) {
    lines.push({ text: row.area, style: 'section' });
    if (row.headline) lines.push({ text: row.headline, style: 'body' });
    if (row.summary) lines.push({ text: row.summary, style: 'body' });

    for (const section of row.sections) {
      lines.push({ text: section.title, style: 'subtitle' });
      for (const line of section.lines) {
        lines.push({ text: `- ${line}`, style: 'body' });
      }
    }

    if (row.sections.length === 0 && row.preReadText) {
      for (const paragraph of row.preReadText.split('\n').map((line) => line.trim()).filter(Boolean)) {
        lines.push({ text: paragraph, style: 'body' });
      }
    }

    lines.push({ text: '', style: 'body' });
  }

  return lines;
}

function lineHeightForStyle(style: PdfLine['style']) {
  if (style === 'title') return 18;
  if (style === 'section') return 16;
  if (style === 'subtitle') return 14;
  if (style === 'small') return 12;
  return 13;
}

function fontForStyle(style: PdfLine['style']) {
  if (style === 'title' || style === 'section' || style === 'subtitle') return 'F2';
  return 'F1';
}

function fontSizeForStyle(style: PdfLine['style']) {
  if (style === 'title') return 18;
  if (style === 'section') return 14;
  if (style === 'subtitle') return 11;
  if (style === 'small') return 9;
  return 10;
}

function buildPageStreams(lines: PdfLine[]) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 50;
  const topY = 745;
  const bottomY = 55;
  const maxBodyChars = 95;

  const pages: string[] = [];
  let chunks: string[] = ['BT'];
  let y = topY;

  const pushNewPage = () => {
    chunks.push('ET');
    pages.push(chunks.join('\n'));
    chunks = ['BT'];
    y = topY;
  };

  const writeLine = (text: string, style: PdfLine['style']) => {
    const font = fontForStyle(style);
    const size = fontSizeForStyle(style);
    const height = lineHeightForStyle(style);
    if (y - height < bottomY) {
      pushNewPage();
    }
    const safe = escapePdfText(toAsciiText(text));
    chunks.push(`/${font} ${size} Tf`);
    chunks.push(`1 0 0 1 ${marginX} ${y} Tm`);
    chunks.push(`(${safe}) Tj`);
    y -= height;
  };

  for (const line of lines) {
    const style = line.style;
    if (!line.text.trim()) {
      y -= lineHeightForStyle(style);
      if (y < bottomY) pushNewPage();
      continue;
    }
    const wrapped = style === 'body' || style === 'small' ? wrapText(line.text, maxBodyChars) : [toAsciiText(line.text)];
    for (const wrappedLine of wrapped) {
      writeLine(wrappedLine, style);
    }
  }

  chunks.push('ET');
  pages.push(chunks.join('\n'));

  return { pages, pageWidth, pageHeight };
}

export function renderExecutivePreReadPdf(payload: PdfPayload): Buffer {
  const { pages, pageWidth, pageHeight } = buildPageStreams(buildLines(payload));
  const objects: string[] = [];

  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];

  for (const content of pages) {
    const stream = `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`;
    objects.push(stream);
    const contentObjectNumber = objects.length;
    contentObjectNumbers.push(contentObjectNumber);

    const pageObject = `<< /Type /Page /Parent PAGES_REF /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 1 0 R /F2 2 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects.push(pageObject);
    pageObjectNumbers.push(objects.length);
  }

  const pagesKids = pageObjectNumbers.map((num) => `${num} 0 R`).join(' ');
  objects.push(`<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [${pagesKids}] >>`);
  const pagesObjectNumber = objects.length;

  for (const pageNumber of pageObjectNumbers) {
    objects[pageNumber - 1] = objects[pageNumber - 1].replace('PAGES_REF', `${pagesObjectNumber} 0 R`);
  }

  objects.push(`<< /Type /Catalog /Pages ${pagesObjectNumber} 0 R >>`);
  const catalogObjectNumber = objects.length;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectNumber} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}
