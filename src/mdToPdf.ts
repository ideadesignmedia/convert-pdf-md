import { readFile, writeFile } from 'node:fs/promises';
import PDFDocument from 'pdfkit';
import type PDFKit = require('pdfkit');

export type MarkdownToPdfOptions = {
  margin?: number;
};

type RenderState = {
  inCode: boolean;
};

function renderMarkdownToDoc(doc: PDFKit.PDFDocument, markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const state: RenderState = { inCode: false };

  const normal = () => doc.font('Helvetica').fontSize(12);
  const italic = () => doc.font('Helvetica-Oblique').fontSize(12);
  const mono = () => doc.font('Courier').fontSize(10);

  normal();

  const headingSize = (level: number) => {
    switch (level) {
      case 1:
        return 24;
      case 2:
        return 20;
      case 3:
        return 18;
      case 4:
        return 16;
      case 5:
        return 14;
      default:
        return 13;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code fences toggle monospace rendering
    const fenceMatch = line.match(/^\s*```/);
    if (fenceMatch) {
      state.inCode = !state.inCode;
      if (state.inCode) {
        doc.moveDown(0.4);
        mono();
      } else {
        doc.moveDown(0.4);
        normal();
      }
      continue;
    }

    if (state.inCode) {
      doc.text(line, { paragraphGap: 0 });
      continue;
    }

    // Horizontal rule
    if (/^\s*(\*\s*\*\s*\*|-{3,}|_{3,})\s*$/.test(line)) {
      doc.moveDown(0.4);
      doc
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.4);
      continue;
    }

    // Headings
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(headingSize(level));
      doc.text(text);
      doc.moveDown(0.2);
      normal();
      continue;
    }

    // Blockquote
    const bq = line.match(/^\s*>\s?(.*)$/);
    if (bq) {
      doc.moveDown(0.2);
      italic();
      doc.text(bq[1], { indent: 20, paragraphGap: 2 });
      normal();
      continue;
    }

    // Ordered list
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (ol) {
      const level = (line.match(/^\s+/) || [''])[0].length / 2;
      const idx = parseInt(ol[1], 10);
      doc.text(`${idx}. ${ol[2]}`, { indent: 18 * level, paragraphGap: 2 });
      continue;
    }

    // Unordered list
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      const level = (line.match(/^\s+/) || [''])[0].length / 2;
      doc.text(`- ${ul[1]}`, { indent: 18 * level, paragraphGap: 2 });
      continue;
    }

    // Blank line
    if (/^\s*$/.test(line)) {
      doc.moveDown(0.4);
      continue;
    }

    normal();
    doc.text(line, { paragraphGap: 4 });
  }
}

export async function markdownToPdf(
  markdown: string,
  options: MarkdownToPdfOptions = {},
): Promise<Buffer> {
  const margin = options.margin ?? 50;
  const doc = new PDFDocument({ autoFirstPage: true, margin });
  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderMarkdownToDoc(doc, markdown);
    doc.end();
  });
}

export async function mdToPdf(
  inputPath: string,
  outputPath: string,
  options?: MarkdownToPdfOptions,
): Promise<void> {
  const markdown = await readFile(inputPath, 'utf8');
  const pdfBuffer = await markdownToPdf(markdown, options);
  await writeFile(outputPath, pdfBuffer);
}
