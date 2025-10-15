import { describe, it, expect } from 'vitest';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';

// Import built JS (pretest builds dist first)
import { convertMarkdownToPdf, convertPdfToMarkdown, convertFile } from '../dist/index.js';

describe('convert-pdf-md (rich)', () => {
  it('MD -> PDF (rich) captures tables, links, lists, images', async () => {
    const mdUrl = new URL('../fixtures/sample.md', import.meta.url);
    const md = await readFile(mdUrl, 'utf8');

    const pdfBuf = await convertMarkdownToPdf(md, {
      engine: 'rich',
      baseDir: path.dirname(mdUrl.pathname),
    });
    expect(pdfBuf.toString('ascii', 0, 4)).toBe('%PDF');

    const roundTrip = await convertPdfToMarkdown(pdfBuf, 'rich');
    expect(roundTrip).toContain('Sample Document');
    expect(roundTrip).toMatch(/Item one/i);
    expect(roundTrip).toMatch(/First/);
    expect(roundTrip).toMatch(/Table/);
  });

  it('PDF -> MD (rich) recovers headings and bullets', async () => {
    // Generate a small PDF via pdfkit to simulate headings + bullets
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    const bufPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    doc.font('Helvetica-Bold').fontSize(24).text('Hello PDF');
    doc.moveDown();
    doc.font('Helvetica').fontSize(12).text('This is a sample PDF with bullets:');
    doc.text('- First bullet');
    doc.text('- Second bullet');
    doc.end();
    const buf = await bufPromise;

    const mdOut = await convertPdfToMarkdown(buf, 'rich');
    expect(mdOut).toMatch(/^#\s+Hello PDF/m);
    expect(mdOut).toContain('- First bullet');
    expect(mdOut).toContain('- Second bullet');
  });

  it('convertFile with engine option and output swapping', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'convert-pdf-md-'));
    try {
      const mdPath = path.join(tmp, 'test.md');
      const md = '# Title\n\nBody text.';
      await writeFile(mdPath, md, 'utf8');

      const pdfPath = await convertFile(mdPath, { engine: 'rich' });
      const pdfBuf = await readFile(pdfPath!);
      const parsed = await convertPdfToMarkdown(pdfBuf, 'rich');
      expect(parsed).toContain('# Title');

      const roundTripPath = path.join(tmp, 'roundtrip.md');
      const mdFromPdfPath = await convertFile(pdfPath!, {
        engine: 'rich',
        out: roundTripPath,
        force: true,
      });
      const mdBack = await readFile(mdFromPdfPath!, 'utf8');
      expect(mdBack).toMatch(/#\s+Title/);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
