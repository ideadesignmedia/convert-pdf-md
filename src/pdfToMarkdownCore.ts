/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadPdfjs } from './pdfjs.js';

function toPlainUint8(buffer: Buffer | Uint8Array): Uint8Array {
  if (!(buffer instanceof Buffer)) return buffer;
  const copy = new Uint8Array(buffer.length);
  copy.set(buffer);
  return copy;
}

export async function pdfToMarkdown(buffer: Buffer): Promise<string> {
  const pdfjsLib = await loadPdfjs();
  const data = toPlainUint8(buffer);
  const pdf = (await pdfjsLib.getDocument({ data }).promise) as any;

  const parts: string[] = [];
  for (let page = 1; page <= pdf.numPages; page++) {
    const pageObj = await pdf.getPage(page);
    const content = await pageObj.getTextContent();
    const lineParts: string[] = [];
    for (const item of content.items as any[]) {
      lineParts.push(item.str);
    }
    const text = lineParts.join('').trim();
    if (text) parts.push(text);
  }

  return parts.join('\n\n');
}
