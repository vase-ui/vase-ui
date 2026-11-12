import { readdirSync } from 'node:fs';
import { expect, describe, it } from 'vitest';

const folder = new URL('.', import.meta.url);

describe('positioning on a server', () => {
  it('loads each module with no DOM', async () => {
    expect(typeof document).toBe('undefined');

    const modules = readdirSync(folder, { recursive: true, encoding: 'utf8' }).filter(
      (path) => path.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(path),
    );
    expect(modules).not.toHaveLength(0);

    // The modules import only types from `@floating-ui/vue`, so the loop below does not load it.
    await import('@floating-ui/vue');
    for (const path of modules) {
      await import(new URL(path, folder).href);
    }
  });
});
