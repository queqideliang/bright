import { createClient } from '@/lib/supabase/server';
import { requireWorkbenchOrigin, checkRate } from '../ask/access.ts';
import { AskError } from '../ask/contract.ts';
import { completeTask } from '../ask/provider.ts';

const maxImageBytes = 3 * 1024 * 1024;
const headers = { 'Cache-Control': 'private, no-store' };

async function readJpeg(request: Request) {
  const tooLarge = () => new AskError(413, '图片较大，请按区域裁剪后再识别。');
  if (Number(request.headers.get('content-length')) > maxImageBytes) throw tooLarge();
  if (!request.body) throw new AskError(400, '缺少图片。');
  const reader = request.body.getReader();
  const pieces: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maxImageBytes) { await reader.cancel(); throw tooLarge(); }
      pieces.push(value);
    }
  } finally { reader.releaseLock(); }
  const jpeg = Buffer.concat(pieces, bytes);
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[2] !== 0xff) throw new AskError(415, '图片数据无效。');
  return jpeg;
}

export async function POST(request: Request) {
  try {
    requireWorkbenchOrigin(request);
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new AskError(401, '请登录后识别图片。');
    if (request.headers.get('content-type') !== 'image/jpeg') throw new AskError(415, '请选择支持的图片。');
    const jpeg = await readJpeg(request);
    checkRate(user.id);
    const raw = await completeTask({mode:'image', jpeg});
    let result;
    try { result = JSON.parse(raw); } catch { throw new AskError(502, '识别结果不完整，请裁剪后重试。'); }
    if (!Array.isArray(result?.passages) || !result.passages.length) throw new AskError(422,'没有识别出可引用的内容，请选择清晰图片。');
    const passages: {location:string; text:string}[] = [];
    for (const part of result.passages) {
      if (!part || typeof part.location !== 'string' || typeof part.text !== 'string' || !part.text.trim()) throw new AskError(502,'图片识别结果不完整，请重试。');
      for (let index = 0; index < part.text.length; index += 1000) {
        passages.push({location:'图片识别 · ' + part.location.slice(0,125), text:part.text.slice(index,index+1000)});
      }
    }
    return Response.json({passages}, {headers});
  } catch (error) {
    const known = error instanceof AskError;
    return Response.json({error:known ? error.message : '图片识别暂时不可用。'}, {status:known ? error.status : 500, headers});
  }
}
