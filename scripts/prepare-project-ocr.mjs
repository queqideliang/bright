import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const web = fileURLToPath(new URL('../', import.meta.url));
const modules = path.join(web, 'node_modules');
const output = path.join(web, 'public/cloud-model-viewer/vendor/ocr-7');
await mkdir(output, { recursive: true });

// Ship one portable LSTM core. The browser only loads these assets on fallback.
for (const name of ['tesseract-core-lstm.js', 'tesseract-core-lstm.wasm', 'LICENSE']) {
  await copyFile(path.join(modules, 'tesseract.js-core', name), path.join(output, name));
}
for (const language of ['chi_sim', 'eng']) {
  const name = language + '.traineddata.gz';
  await copyFile(path.join(modules, '@tesseract.js-data', language, '4.0.0_best_int', name), path.join(output, name));
}
await writeFile(path.join(output, 'NOTICE.txt'), [
  'Tesseract.js-core 7.0.0 (Apache-2.0): https://github.com/naptha/tesseract.js-core',
  'Simplified Chinese and English integer LSTM data from naptha/tessdata (Apache-2.0): https://github.com/naptha/tessdata',
  'Distributed via @tesseract.js-data/chi_sim and @tesseract.js-data/eng 1.0.0 (npm packaging: MIT).',
  'See the adjacent LICENSE for Apache-2.0.',
].join('\n') + '\n');
