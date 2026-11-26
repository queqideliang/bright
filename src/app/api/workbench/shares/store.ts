import { randomBytes } from 'node:crypto';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { AskError } from '../ask/contract.ts';

export const shareByteLimit = 1024 * 1024;
const maxShares = 64;
const maxPassages = 1200;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tokenPattern = /^[A-Za-z0-9_-]{24}$/;
type Passage = { location: string; text: string };
type Document = { title: string; passages: Passage[] };
export type ShareContent = { title: string; documents: Document[] };
type Summary = { id: string; title: string; createdAt: string; documentCount: number; passageCount: number };
type Row = { name: string; created_at?: string | null };
const unavailable = () => new AskError(503, '共享资料存储暂时不可用。');
const missing = () => new AskError(404, '这份共享资料不存在或已撤销。');

function bucket() { return createAdminClient().storage.from('bv-workbench-shares'); }
function folder(owner: string) { return 'v1/' + owner; }
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max && value.trim().length > 0;
}

export async function shareAccount() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || !uuid.test(user.id)) throw new AskError(401, '请登录后使用团队共享资料。');
  return user.id;
}

function parseId(id: string) {
  const [owner, token, ...extra] = id.split('.');
  if (!uuid.test(owner) || !tokenPattern.test(token ?? '') || extra.length) throw missing();
  return { owner, token };
}

function validateContent(input: unknown): ShareContent {
  if (!record(input) || !text(input.title, 100) || !Array.isArray(input.documents) ||
      input.documents.length < 1 || input.documents.length > 16) {
    throw new AskError(400, '请输入共享标题并选择 1 到 16 份资料。');
  }
  let count = 0;
  const documents = input.documents.map((doc: unknown) => {
    if (!record(doc) || !text(doc.title, 210) || !Array.isArray(doc.passages) || !doc.passages.length) {
      throw new AskError(400, '共享文件名称或内容无效。');
    }
    count += doc.passages.length;
    if (count > maxPassages) throw new AskError(413, '一次共享最多包含 1200 个文本片段。');
    const passages = doc.passages.map((p: unknown) => {
      if (!record(p) || !text(p.location, 220) || !text(p.text, 3500)) throw new AskError(400, '共享片段的来源或正文无效。');
      return { location: p.location, text: p.text };
    });
    return { title: doc.title.trim(), passages };
  });
  return { title: input.title.trim(), documents };
}

function summaryFromRow(owner: string, row: Row): Summary | null {
  const [token, title64, documentCount, passageCount, ext, ...extra] = row.name.split('.');
  if (!tokenPattern.test(token) || !/^[a-zA-Z0-9_-]{1,540}$/.test(title64 ?? '') || ext !== 'json' || extra.length) return null;
  const title = Buffer.from(title64, 'base64url').toString('utf8');
  if (!text(title, 100) || !/^\d{1,2}$/.test(documentCount) || !/^\d{1,4}$/.test(passageCount)) return null;
  return { id: owner + '.' + token, title, createdAt: row.created_at ?? '', documentCount: Number(documentCount), passageCount: Number(passageCount) };
}

export async function listShares(owner: string, offset: number) {
  const { data, error } = await bucket().list(folder(owner), { limit: maxShares + 1, offset, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw unavailable();
  return { shares: data.slice(0, maxShares).map(row => summaryFromRow(owner, row)).filter(row => row !== null),
    nextOffset: data.length > maxShares ? offset + maxShares : null };
}

export async function createShare(owner: string, input: unknown) {
  if (!record(input) || input.owner !== owner) throw new AskError(403, '当前登录账号已变化，请重新选择资料。');
  const content = validateContent(input);
  const { shares } = await listShares(owner, 0);
  if (shares.length >= maxShares) throw new AskError(409, '共享数量已达上限，请先撤销不再使用的链接。');
  const token = randomBytes(18).toString('base64url');
  const createdAt = new Date().toISOString();
  const documentCount = content.documents.length;
  const passageCount = content.documents.reduce((sum, doc) => sum + doc.passages.length, 0);
  const name = [token, Buffer.from(content.title).toString('base64url'), documentCount, passageCount, 'json'].join('.');
  const payload = Buffer.from(JSON.stringify(content));
  if (payload.byteLength > shareByteLimit) throw new AskError(413, '共享资料过大，最多 1 MiB。');
  const { error } = await bucket().upload(folder(owner) + '/' + name, payload, { contentType: 'application/json', cacheControl: '0', upsert: false });
  if (error) throw unavailable();
  return { id: owner + '.' + token, title: content.title, createdAt, documentCount, passageCount };
}

async function findShare(id: string) {
  const { owner, token } = parseId(id);
  const store = bucket();
  const { data, error } = await store.list(folder(owner), { search: token + '.', limit: 2 });
  if (error) throw unavailable();
  const row = data.find(row => row.name.startsWith(token + '.'));
  const summary = row ? summaryFromRow(owner, row) : null;
  if (!row || !summary) throw missing();
  return { store, key: folder(owner) + '/' + row.name, summary, owner };
}

export async function readShare(viewer: string, id: string) {
  const entry = await findShare(id);
  const { data, error } = await entry.store.download(entry.key);
  if (error || !data) {
    await findShare(id); // A concurrent revocation should return the same status as other revoked links.
    throw unavailable();
  }
  if (data.size > shareByteLimit) throw unavailable();
  const { documents } = validateContent(JSON.parse(await data.text()));
  return { ...entry.summary, documents, ownedByMe: viewer === entry.owner };
}

export async function revokeShare(actor: string, id: string) {
  if (parseId(id).owner !== actor) throw new AskError(403, '只有创建人可以撤销共享。');
  const entry = await findShare(id);
  const { error } = await entry.store.remove([entry.key]);
  if (error) throw unavailable();
}
