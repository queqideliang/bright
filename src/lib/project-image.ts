import type { Passage } from './project-documents';

function recognizeLocally(image: Blob, width: number, height: number, signal?: AbortSignal): Promise<Passage[]> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker('/cloud-model-viewer/project-ocr-worker.js');
    } catch {
      reject(new Error('云端识别暂时不可用，浏览器无法启动本机文字识别。请使用新版浏览器重试。'));
      return;
    }
    function cleanUp() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
    }
    function abort() {
      cleanUp();
      reject(signal?.reason);
    }
    const timer = setTimeout(() => {
      cleanUp();
      reject(new Error('本机图片识别超时，请按文字区域裁剪后重试。'));
    }, 120_000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => {
      cleanUp();
      reject(new Error('云端识别暂时不可用，本机文字识别引擎未能运行。请刷新页面或使用新版浏览器重试。'));
    };
    worker.onmessage = ({ data }: MessageEvent<{ passages?: Passage[]; error?: string }>) => {
      cleanUp();
      if (data.passages?.length) resolve(data.passages);
      else reject(new Error(data.error ?? '本机图片识别失败，请换用清晰图片。'));
    };
    try {
      worker.postMessage({ image, width, height });
    } catch {
      cleanUp();
      reject(new Error('浏览器无法将图片交给本机文字识别引擎。'));
    }
  });
}

export async function readProjectImage(file: File, signal?: AbortSignal): Promise<Passage[]> {
  signal?.throwIfAborted();
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('无法读取图片，请检查文件或重新导出。'); });
  let jpeg: Blob;
  let width: number;
  let height: number;
  try {
    const scale = Math.min(1, 3200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    width = canvas.width;
    height = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器无法读取图片。');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    jpeg = await new Promise<Blob>((resolve,reject) => canvas.toBlob(image => image ? resolve(image) : reject(new Error('图片转换失败。')), 'image/jpeg', 0.90));
  } finally { bitmap.close(); }
  if (jpeg.size > 3 * 1024 * 1024) throw new Error('图片过密，请按区域裁剪后再添加。');
  const timeout = AbortSignal.timeout(65_000);
  const local = () => recognizeLocally(jpeg, width, height, signal);
  let response: Response;
  try {
    response = await fetch('/api/workbench/extract-image', {
      method:'POST', credentials:'same-origin', cache:'no-store', redirect:'error',
      headers:{'Content-Type':'image/jpeg'}, body:jpeg, signal:signal ? AbortSignal.any([signal,timeout]) : timeout,
    });
  } catch {
    signal?.throwIfAborted();
    return local();
  }
  if ([429, 502, 503, 504].includes(response.status)) return local();
  let data;
  try {
    data = await response.json();
  } catch (error) {
    signal?.throwIfAborted();
    if (response.ok && (timeout.aborted || error instanceof TypeError)) return local();
    throw new Error('图片识别服务返回无效响应，请稍后重试。');
  }
  if (!response.ok || !Array.isArray(data?.passages)) throw new Error(typeof data?.error === 'string' ? data.error : '图片识别失败，请稍后重试。');
  return data.passages;
}
