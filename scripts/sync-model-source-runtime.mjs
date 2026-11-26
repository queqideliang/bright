// Build the server readers from the same sources as the local viewer. Normal website builds use the checked-in modules.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const viewer = path.resolve(process.argv[2] || path.join(root, '../tools/bim-viewer'));
const dest = path.join(root, 'src/lib/model-sources/runtime');
await mkdir(dest, { recursive: true });
const modules = {
  'evidence.mjs': [
    "export { ModelArchive } from './import/zip.ts';",
    "export { jsonRecords } from './import/json-stream.ts';",
    "export { parseQuantitySnapshot } from './quantities.ts';",
    "export { buildModelQaDocument } from './project-qa-model.ts';",
  ].join('\n'),
  'ifc.mjs': "export { parseIfc } from './import/ifc.ts';",
};
for (const [file, contents] of Object.entries(modules)) {
  const result = await build({
    absWorkingDir: viewer, stdin: { contents, resolveDir: path.join(viewer, 'src'), loader: 'ts' },
    bundle: true, treeShaking: true, format: 'esm', platform: 'node', target: 'node22', legalComments: 'inline',
    // The IFC importer only imports Matrix4. Resolve the same implementation without the rendering library's entrypoint.
    alias: { three: path.join(viewer, 'node_modules/three/src/math/Matrix4.js') },
    external: ['fflate', 'web-ifc'], outfile: path.join(dest, file), write: false,
    banner: { js: '/* eslint-disable -- Generated from tools/bim-viewer by scripts/sync-model-source-runtime.mjs. */' },
  });
  let source = result.outputFiles[0].text;
  if (file === 'ifc.mjs') {
    // esbuild retains indented three.js JSDoc. Normalize mixed indentation and blank lines only inside those comments.
    source = source.replace(/^ *\/\*\*\n[\s\S]*?^[ \t]*\*\//gm, comment =>
      comment.replace(/^( +)\t+(?= \*)/gm, '$1').replace(/^[ \t]+$/gm, ''));
  }
  await writeFile(path.join(dest, file), source);
}
