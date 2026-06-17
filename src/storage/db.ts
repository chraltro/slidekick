import { createStore, get, set, del, keys, values } from 'idb-keyval';

// IMPORTANT: idb-keyval's createStore(dbName, storeName) opens the database
// WITHOUT a version and creates only `storeName` in onupgradeneeded. Multiple
// stores sharing one database name therefore do NOT work — whichever store is
// touched first creates the DB at v1 with just its own object store, and the
// others then fail with "object store not found". So each store gets its own
// database. (Historically all three shared 'md-presentations'; that only
// appeared to work because `decks` happened to be accessed first. The decks DB
// keeps that original name so existing saved decks are not orphaned.)
export const decksStore = createStore('md-presentations', 'decks');
export const assetsStore = createStore('md-presentations-assets', 'assets');
export const settingsStore = createStore('md-presentations-settings', 'settings');

export const dbGet = get;
export const dbSet = set;
export const dbDel = del;
export const dbKeys = keys;
export const dbValues = values;
