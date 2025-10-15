/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from 'pdfkit';
import type PDFKit = require('pdfkit');
import { marked } from 'marked';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

type Options = { margin?: number; baseDir?: string };

type PdfDoc = PDFKit.PDFDocument;

type InlineToken = {
  type: string;
  raw?: string;
  text?: string;
  tokens?: InlineToken[];
  href?: string;
  depth?: number;
  ordered?: boolean;
  start?: number;
  items?: InlineToken[];
  header?: InlineToken[];
  rows?: InlineToken[][];
  loose?: boolean;
};

function inlineText(tokens?: InlineToken[]): string {
  if (!tokens) return '';
  return tokens
    .map((t) => {
      switch (t.type) {
        case 'text':
        case 'codespan':
          return t.text ?? '';
        case 'strong':
        case 'em':
        case 'del':
        case 'link':
          return inlineText(t.tokens);
        case 'image':
          return t.text ?? t.tokens?.[0]?.text ?? '';
        case 'br':
          return '\n';
        default:
          return t.raw ?? '';
      }
    })
    .join('');
}

async function drawImage(doc: PdfDoc, src: string, baseDir?: string) {
  try {
    if (/^data:image\/(png|jpeg);base64,/.test(src)) {
      const [, data] = src.split(',', 2);
      const buf = Buffer.from(data, 'base64');
      doc.image(buf, {
        fit: [doc.page.width - doc.page.margins.left - doc.page.margins.right, 300],
      });
      return;
    }
    const abs = baseDir ? path.resolve(baseDir, src) : src;
    const buf = await readFile(abs);
    doc.image(buf, { fit: [doc.page.width - doc.page.margins.left - doc.page.margins.right, 300] });
  } catch {
    // ignore missing image
  }
}

function drawHr(doc: PdfDoc) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const y = doc.y + 4;
  doc.moveTo(left, y).lineTo(right, y).stroke();
  doc.moveDown(0.5);
}

function drawCodeBlock(doc: PdfDoc, text: string) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const startY = doc.y;
  const boxPadding = 6;
  const lines = text.split('\n');
  doc.font('Courier').fontSize(10);
  const height = lines.length * (doc.currentLineHeight() + 1) + boxPadding * 2;
  doc.save().rect(left, startY, width, height).fillOpacity(0.06).fill().restore();
  doc.text(text, left + boxPadding, startY + boxPadding, { width: width - boxPadding * 2 });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(12);
}

function drawBlockquote(doc: PdfDoc, text: string) {
  const left = doc.page.margins.left;
  const ruleX = left + 2;
  const before = doc.y;
  doc.moveDown(0.1);
  const indent = 14;
  doc
    .save()
    .moveTo(ruleX, before)
    .lineTo(ruleX, before + 12)
    .stroke()
    .restore();
  doc
    .font('Helvetica-Oblique')
    .fontSize(12)
    .text(text, left + indent, before, { paragraphGap: 10 });
  doc.font('Helvetica').fontSize(12);
}

function drawTable(doc: PdfDoc, header: string[], rows: string[][]) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const cols = header.length;
  const colWidth = width / cols;

  const drawRow = (cells: string[], isHeader = false) => {
    const rowY = doc.y;
    for (let i = 0; i < cols; i++) {
      const x = left + i * colWidth;
      doc.rect(x, rowY, colWidth, 18).stroke();
      const txt = cells[i] ?? '';
      if (isHeader) doc.font('Helvetica-Bold');
      doc.text(txt, x + 4, rowY + 4, { width: colWidth - 8, height: 10 });
      doc.font('Helvetica');
    }
    doc.moveDown(1);
  };

  drawRow(header, true);
  for (const row of rows) drawRow(row, false);
}

export async function markdownToPdfRich(markdown: string, options?: Options): Promise<Buffer> {
  const tokens = marked.lexer(markdown, { gfm: true });
  const margin = options?.margin ?? 50;

  const doc = new PDFDocument({ margin });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  for (const token of tokens as InlineToken[]) {
    switch (token.type) {
      case 'heading': {
        const size = token.depth === 1 ? 26 : token.depth === 2 ? 20 : token.depth === 3 ? 18 : 14;
        const txt = inlineText(token.tokens ?? [{ type: 'text', text: token.text ?? '' }]);
        doc.font('Helvetica-Bold').fontSize(size).text(txt, { paragraphGap: 8 });
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(12);
        break;
      }
      case 'paragraph': {
        let hasLink = false;
        let txt = '';
        if (token.tokens) {
          txt = token.tokens
            .map((t: InlineToken) => {
              if (t.type === 'link') {
                hasLink = true;
                return `${inlineText(t.tokens)} (${t.href ?? ''})`;
              }
              return t.raw ?? t.text ?? '';
            })
            .join('');
        } else {
          txt = token.text ?? '';
        }
        doc.font('Helvetica').fontSize(12).text(txt, { paragraphGap: 10 });
        if (hasLink) doc.moveDown(0.05);
        break;
      }
      case 'list': {
        const bullet = token.ordered ? null : '-';
        let idx = token.start ?? 1;
        for (const item of token.items ?? []) {
          const prefix = token.ordered ? `${idx++}.` : bullet;
          const txt = inlineText(item.tokens ?? [{ type: 'text', text: item.text ?? '' }]);
          doc.text(`${prefix ?? ''} ${txt}`.trim(), { indent: token.loose ? 0 : 8 });
          if (item.tokens) {
            const sublists = item.tokens.filter((t: InlineToken) => t.type === 'list');
            for (const sub of sublists) {
              let subIndex = sub.start ?? 1;
              for (const subItem of sub.items ?? []) {
                const subPrefix = sub.ordered ? `${subIndex++}.` : '--';
                const subText = inlineText(
                  subItem.tokens ?? [{ type: 'text', text: subItem.text ?? '' }],
                );
                doc.text(`   ${subPrefix} ${subText}`);
              }
            }
          }
        }
        doc.moveDown(0.3);
        break;
      }
      case 'code': {
        drawCodeBlock(doc, token.text ?? '');
        break;
      }
      case 'blockquote': {
        const txt = inlineText(token.tokens ?? []);
        drawBlockquote(doc, txt);
        break;
      }
      case 'hr': {
        drawHr(doc);
        break;
      }
      case 'table': {
        const header = (token.header ?? []).map((cell: InlineToken) =>
          inlineText(cell.tokens ?? [{ type: 'text', text: cell.text ?? '' }]),
        );
        const rows = (token.rows ?? []).map((row: InlineToken[]) =>
          row.map((cell) => inlineText(cell.tokens ?? [{ type: 'text', text: cell.text ?? '' }])),
        );
        drawTable(doc, header, rows);
        break;
      }
      case 'image': {
        await drawImage(doc, token.href ?? '', options?.baseDir);
        break;
      }
      default:
        break;
    }
  }

  doc.end();
  return pdfPromise;
}
