/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadPdfjs } from './pdfjs.js';

type TextItem = {
  str: string;
  fontName?: string;
  fontSize?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

function isBold(fontName?: string) {
  return !!fontName && /(Bold|Black|Semibold|Medium)/i.test(fontName);
}
function isItalic(fontName?: string) {
  return !!fontName && /(Italic|Oblique)/i.test(fontName);
}

function toPlainUint8(buffer: Buffer | Uint8Array): Uint8Array {
  if (!(buffer instanceof Buffer)) return buffer;
  const copy = new Uint8Array(buffer.length);
  copy.set(buffer);
  return copy;
}

export async function pdfToMarkdownRich(buffer: Buffer): Promise<string> {
  const pdfjsLib = await loadPdfjs();
  const data = toPlainUint8(buffer);
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = (await loadingTask.promise) as any;
  const pageCount = pdf.numPages;

  const mdParts: string[] = [];

  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });

    const content = await page.getTextContent({ includeMarkedContent: true });
    const items: TextItem[] = [];
    for (const it of content.items as any[]) {
      const trm = it.transform;
      items.push({
        str: it.str,
        fontName: (content.styles as any)[it.fontName]?.fontFamily || it.fontName,
        fontSize: Math.hypot(trm[0], trm[3]),
        x: trm[4],
        y: trm[5],
        width: it.width,
        height: it.height,
      });
    }

    items.sort((a, b) => (b.y ?? 0) - (a.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
    const lines: TextItem[][] = [];
    let current: TextItem[] = [];
    let lastY: number | null = null;
    const yThreshold = 3;

    for (const it of items) {
      const y = it.y ?? 0;
      if (lastY === null || Math.abs(y - lastY) <= yThreshold) {
        current.push(it);
        lastY = lastY === null ? y : (lastY + y) / 2;
      } else {
        current.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
        lines.push(current);
        current = [it];
        lastY = y;
      }
    }
    if (current.length) {
      current.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      lines.push(current);
    }

    const sizes = items.map((i) => i.fontSize || 12).sort((a, b) => a - b);
    const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 12;
    const h1 = median * 1.8;
    const h2 = median * 1.6;
    const h3 = median * 1.4;
    const h4 = median * 1.2;

    const annotations = await page.getAnnotations();
    const linkRects: { x: number; y: number; w: number; h: number; url: string }[] = [];
    for (const a of annotations as any[]) {
      if (a.subtype === 'Link' && a.url) {
        const r = a.rect;
        const ll = viewport.convertToViewportPoint(r[0], r[1]);
        const ur = viewport.convertToViewportPoint(r[2], r[3]);
        const x = Math.min(ll[0], ur[0]);
        const y = Math.min(ll[1], ur[1]);
        const w = Math.abs(ur[0] - ll[0]);
        const h = Math.abs(ur[1] - ll[1]);
        linkRects.push({ x, y: viewport.height - y - h, w, h, url: a.url });
      }
    }

    const linkAt = (x: number, y: number): string | null => {
      for (const rect of linkRects) {
        if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
          return rect.url;
        }
      }
      return null;
    };

    const imageLines = new Set<number>();
    try {
      const opList: any = await (page as any).getOperatorList();
      const OPS = (pdfjsLib as any).OPS || {};
      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        if (
          fn === OPS.paintImageXObject ||
          fn === OPS.paintInlineImageXObject ||
          fn === OPS.paintJpegXObject
        ) {
          imageLines.add(lines.length + imageLines.size + 1);
        }
      }
    } catch {
      // ignore
    }

    const md: string[] = [];
    for (const line of lines) {
      if (!line.length) continue;

      let textLine = '';
      let avgSize = 0;
      for (const w of line) {
        const b = isBold(w.fontName);
        const it = isItalic(w.fontName);
        let s = w.str;
        if (b && it) s = `***${s}***`;
        else if (b) s = `**${s}**`;
        else if (it) s = `*${s}*`;
        const url = linkAt(w.x ?? 0, w.y ?? 0);
        if (url) s = `[${s}](${url})`;
        textLine += s;
        avgSize += w.fontSize || median;
      }
      avgSize /= line.length;

      const trimmed = textLine.trim();
      if (/^([\u2022-\u2022\u25E6\u25AA]|\d+[.)])\s+/.test(trimmed)) {
        const normalized = trimmed
          .replace(/^([\u2022-\u2022\u25E6\u25AA])\s+/, '- ')
          .replace(/^(\d+)[.)]\s+/, (_, n: string) => `${n}. `);
        md.push(normalized);
        continue;
      }

      if (avgSize >= h1) md.push(`# ${trimmed}`);
      else if (avgSize >= h2) md.push(`## ${trimmed}`);
      else if (avgSize >= h3) md.push(`### ${trimmed}`);
      else if (avgSize >= h4) md.push(`#### ${trimmed}`);
      else md.push(trimmed);
    }

    if (imageLines.size) {
      md.push('', '![image]', '');
    }

    if (p < pageCount) {
      md.push('', '---', '');
    }
    mdParts.push(md.join('\n'));
  }

  return mdParts.join('\n');
}
