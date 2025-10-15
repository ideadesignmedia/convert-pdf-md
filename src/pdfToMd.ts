import { readFile, writeFile } from 'node:fs/promises';
import { pdfToMarkdown as convertBuffer } from './pdfToMarkdownCore.js';

export async function pdfToMarkdown(buffer: Buffer): Promise<string> {
  return convertBuffer(buffer);
}

export async function pdfToMd(inputPath: string, outputPath: string): Promise<void> {
  const data = await readFile(inputPath);
  const markdown = await convertBuffer(data);
  await writeFile(outputPath, markdown, 'utf8');
}
