import assert from 'node:assert/strict';
import { cp, copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const modules = path.join(root, 'node_modules');
const target = path.join(root, 'public/cloud-model-viewer/vendor');
await mkdir(target, { recursive: true });
const pdf = path.join(target, 'pdf');
await mkdir(pdf, { recursive: true });
await copyFile(path.join(modules, 'pdfjs-dist/build/pdf.worker.min.mjs'), path.join(pdf, 'pdf.worker.min.mjs'));
await copyFile(path.join(modules, 'pdfjs-dist/LICENSE'), path.join(pdf, 'LICENSE'));
await cp(path.join(modules, 'pdfjs-dist/cmaps'), path.join(pdf, 'cmaps'), { recursive: true });
await mkdir(path.join(target, 'occt'), { recursive: true });
// Build the pinned engine with local decoders. A real worker URL lets the CAD
// bindings have their own script policy without relaxing the viewer document.
await build({
  stdin: {
    contents: "export { EmbeddedViewer, RGBAColor, RGBColor } from './online-3d-viewer/source/engine/main.js';",
    resolveDir: modules,
  },
  outfile: path.join(target, 'o3dv.js'),
  bundle: true, format: 'iife', globalName: 'OV', minify: true,
  plugins: [{
    name: 'private-model-viewer',
    setup(builder) {
      builder.onLoad({ filter: /[\\/]importerutils\.js$/ }, async ({ path: filename }) => {
        const source = await readFile(filename, 'utf8');
        const start = source.indexOf('let occtWorkerUrl = null;');
        const end = source.indexOf('export function LoadExternalLibrary (');
        const draco = 'https://cdn.jsdelivr.net/npm/draco3d@1.5.7/draco_decoder_nodejs.min.js';
        assert(start >= 0 && end > start && source.includes(draco), 'Check the pinned CAD and Draco loaders');
        const factory = "export async function CreateOcctWorker () { return new Worker('/cloud-model-viewer/cad-worker.js'); }\n";
        const contents = (source.slice(0, start) + factory + source.slice(end))
          .replace(draco, '/cloud-model-viewer/vendor/draco_decoder_nodejs.js');
        return { contents, resolveDir: path.dirname(filename) };
      });
      builder.onLoad({ filter: /[\\/]embeddedviewer\.js$/ }, async ({ path: filename }) => {
        const source = await readFile(filename, 'utf8');
        const old = 'this.progressDiv.innerHTML';
        assert(source.includes(old), 'Check the pinned viewer progress messages');
        return { contents: source.replaceAll(old, 'this.progressDiv.textContent'), resolveDir: path.dirname(filename) };
      });
      // Some FBX exporters omit the index array for an optional color layer.
      // Three.js can still render the geometry and its material in that case.
      builder.onLoad({ filter: /[\\/]FBXLoader\.js$/ }, async ({ path: filename }) => {
        const source = await readFile(filename, 'utf8');
        const old = 'if ( geoNode.LayerElementColor ) {';
        assert(source.includes(old), 'Check the pinned FBX vertex color loader');
        const guard = "const layer = geoNode.LayerElementColor?.[0];\n" +
          "if (layer?.Colors?.a && (layer.ReferenceInformationType !== 'IndexToDirect' || layer.ColorIndex?.a)) {";
        return { contents: source.replace(old, guard), resolveDir: path.dirname(filename) };
      });
    },
  }],
});
for (const name of ['occt-import-js.js','occt-import-js.wasm','license.occt.txt','license.occt-import-js.txt'])
  await copyFile(path.join(modules, 'occt-import-js/dist', name), path.join(target, 'occt', name));
for (const name of ['draco_decoder_nodejs.js','draco_decoder.wasm'])
  await copyFile(path.join(modules, 'draco3d', name), path.join(target, name));
for (const [source, name] of [
  ['online-3d-viewer/LICENSE.md', 'online-3d-viewer-license.txt'],
  ['three/LICENSE', 'three-license.txt'], ['fflate/LICENSE', 'fflate-license.txt'],
]) await copyFile(path.join(modules, source), path.join(target, name));
