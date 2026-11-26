import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../',import.meta.url));
const output = path.join(root,'public/review-report');
await mkdir(output,{recursive:true});
const result = await build({
  absWorkingDir:root, entryPoints:['src/lib/review-report-pdf.ts'],
  outfile:path.join(output,'export.mjs'), bundle:true, platform:'browser', format:'esm',
  target:'es2020', minify:true, legalComments:'eof', metafile:true,
  // The report uses jsPDF text and vector primitives. Its optional HTML/SVG plugins
  // are never invoked and need no browser dependencies in this entry point.
  external:['canvg','dompurify','html2canvas'],
});

const packageDirs = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
  const match = input.match(/^(.*\bnode_modules\/(?:@[^/]+\/)?[^/]+)\//u);
  if (match) packageDirs.add(match[1]);
}
const notices = [];
for (const dir of [...packageDirs].sort()) {
  const pkg = path.join(root,dir);
  const metadata = JSON.parse(await readFile(path.join(pkg,'package.json'),'utf8'));
  const license = (await readdir(pkg)).find(name=>/^licen[cs]e(?:\.[\w-]+)?$/iu.test(name));
  if (!license) throw new Error('Missing PDF dependency license: '+metadata.name);
  notices.push(metadata.name+' '+metadata.version+' ('+metadata.license+')\n\n'+(await readFile(path.join(pkg,license),'utf8')).trim());
}
await writeFile(path.join(output,'THIRD-PARTY.txt'),notices.join('\n\n------------------------------\n\n')+'\n');
