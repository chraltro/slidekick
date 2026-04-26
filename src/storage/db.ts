import { createStore, get, set, del, keys, values } from 'idb-keyval';

export const decksStore = createStore('md-presentations', 'decks');
export const assetsStore = createStore('md-presentations', 'assets');
export const settingsStore = createStore('md-presentations', 'settings');

export const dbGet = get;
export const dbSet = set;
export const dbDel = del;
export const dbKeys = keys;
export const dbValues = values;
