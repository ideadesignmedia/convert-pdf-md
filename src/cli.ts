#!/usr/bin/env node
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { convertFile } from './index.js';

function printHelp() {
  console.log(`@ideadesignmedia/convert-pdf-md
Convert between PDF and Markdown (autodetects by extension).

Usage:
  npx @ideadesignmedia/convert-pdf-md <input> [--out <path>] [--stdout] [--force] [--engine <rich|core>]
  convert-pdf-md <input> [--out <path>] [--stdout] [--force] [--engine <rich|core>]

Options:
  -o, --out <path>     Write output to <path>. Defaults to swapping the extension.
      --stdout         Write the result to stdout instead of a file.
      --force          Overwrite output if it exists.
      --engine <name>  Conversion engine: "rich" (default) or "core".
  -h, --help           Show this help.
  -v, --version        Show version.
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }
  if (args.includes('-v') || args.includes('--version')) {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    console.log(pkg.version ?? '0.0.0');
    process.exit(0);
  }

  let out: string | undefined;
  let stdout = false;
  let force = false;
  let engine: 'rich' | 'core' = 'rich';
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-o' || a === '--out') {
      out = args[i + 1];
      i++;
    } else if (a === '--stdout') {
      stdout = true;
    } else if (a === '--force') {
      force = true;
    } else if (a === '--engine') {
      const val = args[i + 1];
      if (val !== 'rich' && val !== 'core') {
        console.error('Unknown engine: ' + val);
        process.exit(1);
      }
      engine = val;
      i++;
    } else if (a.startsWith('-')) {
      console.error(`Unknown option: ${a}`);
      printHelp();
      process.exit(1);
    } else {
      positional.push(a);
    }
  }

  if (positional.length !== 1) {
    console.error('Please provide exactly one input file.');
    printHelp();
    process.exit(1);
  }

  const input = positional[0];
  try {
    const outPath = await convertFile(input, {
      out,
      stdout,
      force,
      engine,
      baseDir: path.dirname(input),
    });
    if (!stdout && outPath) {
      console.log(`Wrote ${path.resolve(outPath)}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error:', message);
    process.exit(1);
  }
}

main();
