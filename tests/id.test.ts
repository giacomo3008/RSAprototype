import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId } from '../src/lib/id';
afterEach(() => vi.unstubAllGlobals());
describe('IDs in browser contexts without randomUUID', () => {
  it('uses native randomUUID when available', () => {
    const native = vi.fn(() => 'native-id');
    vi.stubGlobal('crypto', { randomUUID: native });
    expect(createId()).toBe('native-id');
    expect(native).toHaveBeenCalledOnce();
  });
  it('creates distinct RFC 4122 v4 IDs using getRandomValues without randomUUID', () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    vi.stubGlobal('crypto', { getRandomValues });
    const ids = Array.from({ length: 100 }, () => createId());
    expect(new Set(ids).size).toBe(100);
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
