import { getAssetDataUri } from '@/storage/assetStore';

/**
 * Walk an HTML string and rewrite `asset:HASH` image URLs to data: URIs.
 * Returns the rewritten HTML.
 */
export async function inlineAssetUrls(html: string): Promise<string> {
  const matches = Array.from(html.matchAll(/asset:([a-f0-9]+)/g));
  if (matches.length === 0) return html;
  const replacements = new Map<string, string>();
  await Promise.all(
    matches.map(async (m) => {
      const hash = m[1];
      if (replacements.has(hash)) return;
      const dataUri = await getAssetDataUri(hash);
      if (dataUri) replacements.set(hash, dataUri);
    }),
  );
  return html.replace(/asset:([a-f0-9]+)/g, (_full, hash) => replacements.get(hash) ?? `asset:${hash}`);
}
