import { openDB } from 'idb';
import { seed } from '../domain/seed';
import type { State } from '../domain/types';
export interface Repository {
  read(): Promise<State>;
  mutate<T>(fn: (s: State) => T): Promise<T>;
  reset(): Promise<void>;
}
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ras-demo-updates') : null;
export const subscribe = (fn: () => void) => {
  const listener = () => fn();
  channel?.addEventListener('message', listener);
  window.addEventListener('ras-change', listener);
  return () => {
    channel?.removeEventListener('message', listener);
    window.removeEventListener('ras-change', listener);
  };
};
const notify = () => {
  channel?.postMessage('changed');
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ras-change'));
};
export class IndexedRepository implements Repository {
  private db = openDB('ras-agentica-v1', 1, {
    upgrade(db) {
      db.createObjectStore('state');
    },
  });
  async read() {
    const db = await this.db;
    const tx = db.transaction('state', 'readwrite');
    let s = (await tx.store.get('demo')) as State | undefined;
    if (!s) {
      s = seed();
      await tx.store.put(s, 'demo');
    }
    await tx.done;
    return s;
  }
  async mutate<T>(fn: (s: State) => T): Promise<T> {
    const db = await this.db;
    const tx = db.transaction('state', 'readwrite');
    try {
      const s = ((await tx.store.get('demo')) as State | undefined) || seed();
      const result = fn(s);
      s.revision++;
      await tx.store.put(s, 'demo');
      await tx.done;
      notify();
      return result;
    } catch (e) {
      tx.abort();
      await tx.done.catch(() => {});
      throw e;
    }
  }
  async reset() {
    const db = await this.db;
    await db.put('state', seed(), 'demo');
    notify();
  }
}
export class MemoryRepository implements Repository {
  constructor(public state = seed()) {}
  async read() {
    return structuredClone(this.state);
  }
  async mutate<T>(fn: (s: State) => T) {
    const copy = structuredClone(this.state);
    const result = fn(copy);
    copy.revision++;
    this.state = copy;
    return structuredClone(result);
  }
  async reset() {
    this.state = seed();
  }
}
