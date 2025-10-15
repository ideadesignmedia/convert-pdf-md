import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

export type FileKind = 'pdf' | 'md';

const MD_EXTS = new Set(['.md', '.markdown', '.mkd', '.mdown']);

export async function sniffFileKind(filePath: string): Promise<FileKind> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (MD_EXTS.has(ext)) return 'md';

  // Fallback: sniff magic number
  const fd = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(5);
    await fd.read(buf, 0, 5, 0);
    const magic = buf.toString('ascii');
    if (magic === '%PDF-') return 'pdf';
    return 'md';
  } finally {
    await fd.close();
  }
}

export function defaultOutPath(inputPath: string, kind: FileKind): string {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  return kind === 'md' ? path.join(dir, base + '.pdf') : path.join(dir, base + '.md');
}

export async function ensureDirFor(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
