import { describe, it, expect } from 'vitest';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { mdToPdf, pdfToMd, convertFile } from '../dist/index.js';

const tmp = path.join(__dirname, 'tmp');
async function cleanup() {
  await fsp.rm(tmp, { recursive: true, force: true });
  await fsp.mkdir(tmp, { recursive: true });
}

describe('Markdown <-> PDF', () => {
  it('converts sample.md -> PDF and back', async () => {
    await cleanup();
    const mdPath = path.join(__dirname, '..', 'sample', 'sample.md');
    const outPdf = path.join(tmp, 'out.pdf');
    const outMd = path.join(tmp, 'roundtrip.md');

    await mdToPdf(mdPath, outPdf);
    const stat = await fsp.stat(outPdf);
    expect(stat.size).toBeGreaterThan(800);

    await pdfToMd(outPdf, outMd);
    const txt = await fsp.readFile(outMd, 'utf8');
    expect(txt).toContain('quick brown fox');
  });

  it('auto-detects by extension/magic and converts', async () => {
    await cleanup();
    const pdfPath = path.join(__dirname, '..', 'sample', 'sample.pdf');
    const outMd = path.join(tmp, 'out.md');
    const out = await convertFile(pdfPath, { out: outMd });
    expect(out).toBe(outMd);
    const txt = await fsp.readFile(out, 'utf8');
    expect(txt).toContain('Sample PDF for testing');
  });
});
