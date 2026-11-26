import type { Passage } from './project-documents';

export async function readProjectImage(file: File, signal?: AbortSignal): Promise<Passage[]> {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('无法读取图片，请检查文件或重新导出。'); });
  let jpeg: Blob;
  try {
    const scale = Math.min(1, 3200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器无法读取图片。');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    jpeg = await new Promise<Blob>((resolve,reject) => canvas.toBlob(image => image ? resolve(image) : reject(new Error('图片转换失败。')), 'image/jpeg', 0.90));
  } finally { bitmap.close(); }
  if (jpeg.size > 3 * 1024 * 1024) throw new Error('图片过密，请按区域裁剪后再添加。');
  const timeout = AbortSignal.timeout(65_000);
  const response = await fetch('/api/workbench/extract-image', {
    method:'POST', credentials:'same-origin', cache:'no-store', redirect:'error',
    headers:{'Content-Type':'image/jpeg'}, body:jpeg, signal:signal ? AbortSignal.any([signal,timeout]) : timeout,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.passages)) throw new Error(typeof data.error === 'string' ? data.error : '图片识别失败，请稍后重试。');
  return data.passages;
}
