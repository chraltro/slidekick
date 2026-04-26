import { dbGet, dbSet, dbDel, dbValues, decksStore } from './db';

export interface DeckRecord {
  id: string;
  title: string;
  source: string;
  createdAt: number;
  updatedAt: number;
}

export async function getDeck(id: string): Promise<DeckRecord | undefined> {
  return dbGet(id, decksStore);
}

export async function saveDeck(rec: DeckRecord): Promise<void> {
  await dbSet(rec.id, rec, decksStore);
}

export async function deleteDeck(id: string): Promise<void> {
  await dbDel(id, decksStore);
}

export async function listDecks(): Promise<DeckRecord[]> {
  const list = (await dbValues(decksStore)) as DeckRecord[];
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function newDeckId(): string {
  return `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
