import { CHANNEL_NAME, STORAGE_KEY, type SyncMessage } from './messages';

type Listener = (msg: SyncMessage) => void;

interface Transport {
  post(msg: SyncMessage): void;
  subscribe(fn: Listener): () => void;
  close(): void;
}

class BroadcastTransport implements Transport {
  private bc: BroadcastChannel;
  private listeners = new Set<Listener>();
  constructor() {
    this.bc = new BroadcastChannel(CHANNEL_NAME);
    this.bc.onmessage = (ev) => {
      for (const fn of this.listeners) fn(ev.data as SyncMessage);
    };
  }
  post(msg: SyncMessage) {
    try {
      this.bc.postMessage(msg);
    } catch (e) {
      // Some payloads (huge slide arrays) may exceed structured-clone limits.
      // Fall back: drop oversized STATE_DIFF or STATE — caller should chunk.
      console.warn('BroadcastChannel postMessage failed', e);
    }
  }
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  close() {
    this.bc.close();
    this.listeners.clear();
  }
}

class StorageTransport implements Transport {
  private listeners = new Set<Listener>();
  private handler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as { msg: SyncMessage; n: number };
      for (const fn of this.listeners) fn(parsed.msg);
    } catch {
      /* noop */
    }
  };
  private counter = 0;
  constructor() {
    window.addEventListener('storage', this.handler);
  }
  post(msg: SyncMessage) {
    try {
      this.counter++;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ msg, n: this.counter }));
    } catch (e) {
      console.warn('localStorage sync write failed (quota?)', e);
    }
  }
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  close() {
    window.removeEventListener('storage', this.handler);
    this.listeners.clear();
  }
}

let singleton: Transport | null = null;

export function getChannel(): Transport {
  if (singleton) return singleton;
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    singleton = new BroadcastTransport();
  } else {
    singleton = new StorageTransport();
  }
  return singleton;
}

export function resetChannelForTest() {
  if (singleton) singleton.close();
  singleton = null;
}
