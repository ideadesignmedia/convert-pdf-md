import path from 'node:path';

type PdfJsModule = {
  getDocument: (params: { data: Uint8Array }) => { promise: Promise<unknown> };
  OPS?: Record<string, number>;
  GlobalWorkerOptions?: {
    disableWorker?: boolean;
    standardFontDataUrl?: string;
  };
};

let pdfjsModulePromise: Promise<PdfJsModule> | undefined;

export async function loadPdfjs(): Promise<PdfJsModule> {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = Function('return import("pdfjs-dist/legacy/build/pdf.mjs")')().then(
      (mod: PdfJsModule) => {
        if (mod.GlobalWorkerOptions) {
          mod.GlobalWorkerOptions.disableWorker = true;
          if (!mod.GlobalWorkerOptions.standardFontDataUrl) {
            const fontsDir = path.join(
              path.dirname(require.resolve('pdfjs-dist/package.json')),
              'standard_fonts',
            );
            mod.GlobalWorkerOptions.standardFontDataUrl = fontsDir.endsWith(path.sep)
              ? fontsDir
              : `${fontsDir}${path.sep}`;
          }
        }
        return mod;
      },
    );
  }
  return pdfjsModulePromise as Promise<PdfJsModule>;
}
