import { createHash } from 'node:crypto';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { libraryExtensions, libraryIdPattern, libraryMaxBytes, libraryPageSize, modelExtension, type LibraryItem } from './formats';

class LibraryError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export function libraryResponse(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
}

export function libraryFailure(error: unknown) {
  if (error instanceof LibraryError) return libraryResponse({ error: error.message }, error.status);
  return libraryResponse({ error: '模型库暂时无法连接，请重试。' }, 503);
}

export async function accountStorage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) throw new LibraryError('请登录后进入自己的模型库。', 401);
  return storageForAccount(user.id);
}

export function storageForAccount(owner: string) {
  return { owner, bucket: createAdminClient().storage.from('bim-models') };
}

type AccountStorage = Awaited<ReturnType<typeof accountStorage>>;
type StoredItem = LibraryItem & { key: string; sha256: string };
type ObjectRow = { name: string; created_at?: string | null; metadata?: Record<string, unknown> | null };
const digestPattern = /^[a-f0-9]{64}$/;

function decodeEntry(owner: string, row: ObjectRow): StoredItem | null {
  const [id, sha256, encoded, ...extra] = row.name.split('.');
  if (extra.length || !libraryIdPattern.test(id) || !digestPattern.test(sha256) || !/^[a-zA-Z0-9_-]{1,720}$/.test(encoded)) return null;
  const name = Buffer.from(encoded, 'base64url').toString('utf8');
  const size = Number(row.metadata?.size);
  if (!libraryExtensions.includes(modelExtension(name)) || !Number.isSafeInteger(size) || size <= 0 || size > libraryMaxBytes) return null;
  return { id, name, size, sha256, createdAt: row.created_at ?? '', key: owner + '/library/' + row.name };
}

export async function findLibraryItem({ owner, bucket }: AccountStorage, id: string): Promise<StoredItem | null> {
  if (!libraryIdPattern.test(id)) return null;
  const { data, error } = await bucket.list(owner + '/library', { search: id + '.', limit: 2 });
  if (error) throw new LibraryError('无法读取模型记录，请稍后重试。', 503);
  const row = data.find(entry => entry.name.startsWith(id + '.'));
  return row ? decodeEntry(owner, row) : null;
}

export async function listLibrary({ owner, bucket }: AccountStorage, offset: number) {
  const { data, error } = await bucket.list(owner + '/library', {
    offset, limit: libraryPageSize + 1, sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw new LibraryError('无法读取已保存的模型。', 503);
  const items: LibraryItem[] = [];
  for (const row of data.slice(0, libraryPageSize)) {
    const entry = decodeEntry(owner, row);
    if (entry) items.push({ id: entry.id, name: entry.name, size: entry.size, createdAt: entry.createdAt });
  }
  return { items, nextOffset: data.length > libraryPageSize ? offset + libraryPageSize : null };
}

export async function beginUpload(store: AccountStorage, input: { name?: unknown; size?: unknown; sha256?: unknown } | null) {
  const { name, size, sha256 } = input ?? {};
  if (typeof name !== 'string' || !name.trim() || /[\\/\u0000-\u001f\u007f]/u.test(name) || name.length > 255 || Buffer.byteLength(name) > 540)
    throw new LibraryError('文件名无效或过长。', 400);
  if (!libraryExtensions.includes(modelExtension(name))) throw new LibraryError('此格式尚未接入在线查看。', 415);
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0 || size > libraryMaxBytes)
    throw new LibraryError('请选择非空且不超过 50 MiB 的文件。', 413);
  if (typeof sha256 !== 'string' || !digestPattern.test(sha256)) throw new LibraryError('缺少文件校验值，请重新选择文件。', 400);

  // One immutable object is also the catalog entry. A completed PUT becomes
  // visible atomically. The same account, filename and bytes reuse the same key.
  const digest = createHash('sha256').update(store.owner).update('\0').update(name).update('\0').update(sha256).digest();
  digest[6] = (digest[6] & 15) | 128;
  digest[8] = (digest[8] & 63) | 128;
  const hex = digest.subarray(0, 16).toString('hex');
  const id = [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  const existing = await findLibraryItem(store, id);
  if (existing && existing.size === size) return { id, saved: true };
  if (existing) throw new LibraryError('已有同名校验记录的文件大小不同。', 409);
  const key = store.owner + '/library/' + id + '.' + sha256 + '.' + Buffer.from(name).toString('base64url');
  const { data, error } = await store.bucket.createSignedUploadUrl(key, { upsert: false });
  if (error || !data) throw new LibraryError('云存储未能签发上传地址。', 503);
  return { id, saved: false, signedUrl: data.signedUrl };
}

export async function libraryGrant(store: AccountStorage, item: StoredItem) {
  const { data, error } = await store.bucket.createSignedUrl(item.key, 60);
  if (error || !data) throw new LibraryError('文件暂时无法下载。', 503);
  const target = new URL(data.signedUrl);
  const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  if (target.origin !== origin || target.pathname !== '/storage/v1/object/sign/bim-models/' + item.key)
    throw new LibraryError('存储返回的地址与模型不匹配。', 502);
  return { url: data.signedUrl, expiresIn: 60 };
}
