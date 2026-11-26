/* global importScripts, TesseractCore */
'use strict';

const assets = new URL('vendor/ocr-7/', self.location.href);
const lstmOnly = 1;
const sparseText = 11;

async function loadLanguage(core, language) {
  const response = await fetch(new URL(language + '.traineddata.gz', assets), {
    mode: 'same-origin', redirect: 'error', cache: 'force-cache',
  });
  if (!response.ok) throw new Error('模型下载失败');
  let bytes = new Uint8Array(await response.arrayBuffer());
  // Some static hosts have already decoded the gzip content-encoding.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  core.FS.writeFile(language + '.traineddata', bytes);
}

self.onmessage = async ({ data: { image, width, height } }) => {
  let phase = '云端识别暂时不可用，本机文字识别引擎或语言包加载失败。请检查网络连接并使用新版浏览器重试。';
  try {
    importScripts(new URL('tesseract-core-lstm.js', assets).href);
    const core = await TesseractCore({ locateFile: name => new URL(name, assets).href, TesseractProgress() {} });
    await Promise.all(['chi_sim', 'eng'].map(lang => loadLanguage(core, lang)));
    const api = new core.TessBaseAPI();
    if (api.Init(null, 'chi_sim+eng', lstmOnly) !== 0) throw new Error('模型初始化失败');
    phase = '云端识别暂时不可用，本机文字识别失败。请裁剪文字区域或重新导出清晰图片。';
    core.FS.writeFile('/input', new Uint8Array(await image.arrayBuffer()));
    if (api.SetImageFile(1, 0) !== 0) throw new Error('图片解码失败');
    api.SetPageSegMode(sparseText);
    if (api.Recognize(null) !== 0) throw new Error('图片识别失败');
    const blocks = JSON.parse(api.GetJSONText()).blocks ?? [];
    const passages = [];
    let length = 0;
    for (const block of blocks) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          // The Chinese model can insert spaces between adjacent Chinese characters.
          const text = line.text.trim().replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, '');
          if (!text) continue;
          length += text.length;
          if (length > 100_000 || passages.length >= 1200 || text.length > 3500) {
            self.postMessage({ error: '本机识别出的文字过多，请按区域裁剪图片后分别添加。' });
            return;
          }
          const { x0, y0, x1, y1 } = line.bbox;
          const percent = (value, size) => Math.round(100 * value / size) + '%';
          const location = '图片识别 · 本机第 ' + (passages.length + 1) + ' 行'
            + '（距左 ' + percent(x0, width) + '–' + percent(x1, width)
            + '，距顶 ' + percent(y0, height) + '–' + percent(y1, height) + '）';
          passages.push({ location, text });
        }
      }
    }
    if (!passages.length) {
      self.postMessage({ error: '云端识别暂时不可用，本机未识别到印刷文字。请提供更清晰的中文或英文图片。' });
      return;
    }
    self.postMessage({ passages });
  } catch {
    self.postMessage({ error: phase });
  }
  // The caller terminates this one-shot worker, releasing WASM memory and image data.
};
