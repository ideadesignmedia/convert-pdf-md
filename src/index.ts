import path from 'node:path';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { markdownToPdf, mdToPdf } from './mdToPdf.js';
import { pdfToMarkdown, pdfToMd } from './pdfToMd.js';
import { markdownToPdfRich } from './markdownToPdfRich.js';
import { pdfToMarkdownRich } from './pdfToMarkdownRich.js';

export type Engine = 'core' | 'rich';

export type ConvertOptions = {
  out?: string;
  stdout?: boolean;
  force?: boolean;
  engine?: Engine;
  baseDir?: string; // For MD->PDF image resolution
};

export async function convertPdfToMarkdown(
  input: Buffer,
  engine: Engine = 'rich',
): Promise<string> {
  if (engine === 'rich') {
    try {
      return await pdfToMarkdownRich(input);
    } catch (e) {
      // Fallback to core on failure
      return pdfToMarkdown(input);
    }
  }
  return pdfToMarkdown(input);
}

export async function convertMarkdownToPdf(
  input: string,
  opts?: { engine?: Engine; baseDir?: string },
): Promise<Buffer> {
  const engine = opts?.engine ?? 'rich';
  if (engine === 'rich') {
    try {
      return await markdownToPdfRich(input, { baseDir: opts?.baseDir });
    } catch (e) {
      return markdownToPdf(input);
    }
  }
  return markdownToPdf(input);
}

export async function convertFile(
  inputPath: string,
  opts: ConvertOptions = {},
): Promise<string | undefined> {
  const ext = path.extname(inputPath).toLowerCase();
  if (!ext) throw new Error('Input path must have an extension (.pdf or .md)');
  if (ext !== '.pdf' && ext !== '.md' && ext !== '.markdown') {
    throw new Error('Unsupported input type. Supported: .pdf, .md, .markdown');
  }

  const engine = opts.engine ?? 'rich';

  if (ext === '.pdf') {
    const input = await readFile(inputPath);
    const md = await convertPdfToMarkdown(input, engine);
    if (opts.stdout) {
      process.stdout.write(md);
      return;
    }
    const outPath = opts.out ?? inputPath.replace(/\.(pdf)$/i, '.md');
    await ensureDir(path.dirname(outPath));
    await writeTextFile(outPath, md, { force: opts.force });
    return outPath;
  } else {
    const md = await readFile(inputPath, 'utf8');
    const baseDir = opts.baseDir ?? path.dirname(inputPath);
    const pdfBuffer = await convertMarkdownToPdf(md.toString(), { engine, baseDir });
    if (opts.stdout) {
      process.stdout.write(pdfBuffer);
      return;
    }
    const outPath = opts.out ?? inputPath.replace(/\.(md|markdown)$/i, '.pdf');
    await ensureDir(path.dirname(outPath));
    await writeBinaryFile(outPath, pdfBuffer, { force: opts.force });
    return outPath;
  }
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function writeBinaryFile(file: string, data: Buffer, { force = false } = {}) {
  if (!force && (await exists(file))) {
    throw new Error(`Refusing to overwrite existing file without --force: ${file}`);
  }
  await writeFile(file, data);
}

async function writeTextFile(file: string, data: string, { force = false } = {}) {
  if (!force && (await exists(file))) {
    throw new Error(`Refusing to overwrite existing file without --force: ${file}`);
  }
  await writeFile(file, data, 'utf8');
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

export { mdToPdf, pdfToMd, markdownToPdf, pdfToMarkdown };

export default {
  convertFile,
  convertPdfToMarkdown,
  convertMarkdownToPdf,
  mdToPdf,
  pdfToMd,
  markdownToPdf,
  pdfToMarkdown,
};
