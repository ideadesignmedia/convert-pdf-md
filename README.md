# @ideadesignmedia/convert-pdf-md

A tiny TypeScript CLI that converts **Markdown <-> PDF** with zero browser/runtime baggage. It includes a rich renderer/extractor for best-effort formatting plus a lean core fallback for quick text-only conversion.

## Features

- Autodetects input (`.md`, `.markdown`, `.pdf`) and infers output paths.
- CLI supports `--out`, `--stdout`, `--force`, and `--engine` to swap between rich/core modes.
- Markdown -> PDF powered by `pdfkit` (headings, lists, code fences, blockquotes, tables, basic image handling).
- PDF -> Markdown powered by `pdfjs-dist` with heuristics (headings from font size, bold/italic, bullets, links, placeholders for images).
- Ships compiled CommonJS (`dist/`) only; `.npmignore` keeps sources and tooling out of the package.
- Tooling: ESLint, Prettier, Vitest with end-to-end style tests against the built bundle.

> WARNING: PDF -> Markdown uses text extraction and heuristics. Layout, custom fonts, and complex graphics cannot be fully preserved.

## Install (local dev)

```bash
yarn install
yarn build
```

Node.js 18+ is required.

## CLI usage

Once published:

```bash
npx @ideadesignmedia/convert-pdf-md <input> [--out path] [--stdout] [--force] [--engine rich|core]
```

Local development (after `yarn build`):

```bash
node dist/cli.js sample/sample.md -o sample/out.pdf
node dist/cli.js sample/sample.pdf -o sample/out.md
```

## Engines

- **rich** (default)
  - Markdown -> PDF: styled output via `pdfkit` (bold/italic, headings, numbered/bullet lists, code blocks with shading, blockquotes, tables, links, image embedding).
  - PDF -> Markdown: structure-aware extraction using `pdfjs-dist` (font-size based heading detection, bold/italic, bullet inference, link recovery, image placeholders).
- **core**
  - Markdown -> PDF: same renderer as rich but without image lookups.
  - PDF -> Markdown: quick text extraction via `pdfjs-dist` without layout heuristics.

Switch engines on demand:

```bash
npx @ideadesignmedia/convert-pdf-md input.pdf --engine core
npx @ideadesignmedia/convert-pdf-md input.md --engine rich
```

### Programmatic usage

```ts
import {
  convertFile,
  convertMarkdownToPdf,
  convertPdfToMarkdown,
  mdToPdf,
  pdfToMd,
} from '@ideadesignmedia/convert-pdf-md';

// Auto-detect by extension / magic
await convertFile('path/to/input.md');
await convertFile('path/to/input.pdf', { out: 'output.md', engine: 'core' });

// Direct helpers
const pdfBuffer = await convertMarkdownToPdf('# Hello', { engine: 'rich' });
const markdown = await convertPdfToMarkdown(pdfBuffer);
await mdToPdf('input.md', 'output.pdf', { margin: 48 });
await pdfToMd('input.pdf', 'output.md');
```

## Repository

https://github.com/ideadesignmedia/convert-pdf-md.git

## Development workflow

```bash
yarn lint
yarn build
yarn test
```

Vitest runs against the compiled output in `dist/` to mirror the published package.

## License

MIT � Idea Design Media
