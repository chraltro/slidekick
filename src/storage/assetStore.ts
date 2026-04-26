import { dbGet, dbSet, assetsStore } from './db';

export interface AssetRecord {
  hash: string;
  type: string;
  bytes: ArrayBuffer;
  createdAt: number;
}

const urlCache = new Map<string, string>();

async function sha1(bytes: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16); // truncated for brevity in markdown source
}

export async function putAsset(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const hash = await sha1(bytes);
  const existing = await dbGet<AssetRecord>(hash, assetsStore);
  if (!existing) {
    const rec: AssetRecord = {
      hash,
      type: blob.type || 'application/octet-stream',
      bytes,
      createdAt: Date.now(),
    };
    await dbSet(hash, rec, assetsStore);
  }
  return hash;
}

export async function getAssetUrl(hash: string): Promise<string | undefined> {
  const cached = urlCache.get(hash);
  if (cached) return cached;
  const rec = await dbGet<AssetRecord>(hash, assetsStore);
  if (!rec) return undefined;
  const blob = new Blob([rec.bytes], { type: rec.type });
  const url = URL.createObjectURL(blob);
  urlCache.set(hash, url);
  return url;
}

export async function getAssetDataUri(hash: string): Promise<string | undefined> {
  const rec = await dbGet<AssetRecord>(hash, assetsStore);
  if (!rec) return undefined;
  const bytes = new Uint8Array(rec.bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  return `data:${rec.type};base64,${b64}`;
}

/** Walk a DOM element and rewrite any <img src="asset:HASH"> to a blob URL. */
export async function resolveAssetUrls(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') ?? '';
      const m = src.match(/^asset:([a-f0-9]+)$/);
      if (!m) return;
      const url = await getAssetUrl(m[1]);
      if (url) img.setAttribute('src', url);
    }),
  );
}
