import { expect, it } from 'vitest';
import { REFACTORED_FOLDERS } from '../../test/refactoredFolders';

const modules = import.meta.glob<Record<string, unknown>>('../*/index.ts', { eager: true });
const sources = import.meta.glob<string>('../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// These families read no private field of a component instance, so they do not call the helper.
const refactored = new Set(REFACTORED_FOLDERS.map((folder) => `../${folder}/`));

it('each part with a covered prop calls the helper', () => {
  const checked = new Set<string>();
  for (const module of Object.values(modules)) {
    for (const value of Object.values(module)) {
      const part = value as
        | { props?: Record<string, { type?: unknown; default?: unknown } | null>; __file?: string }
        | undefined;
      if (!part || typeof part !== 'object' || !part.props || !part.__file) {
        continue;
      }
      const file = `../${part.__file.split('/src/')[1]}`;
      if (checked.has(file) || [...refactored].some((folder) => file.startsWith(folder))) {
        continue;
      }
      checked.add(file);
      const covered = Object.values(part.props).filter((option) => {
        if (!option || typeof option !== 'object') {
          return false;
        }
        const types = Array.isArray(option.type) ? option.type : [option.type];
        return (
          types.includes(Boolean) && Object.hasOwn(option, 'default') && option.default !== false
        );
      });
      const source = sources[file];
      expect(source, file).toBeDefined();
      const calls = source.match(/useCastBooleanWarning\('[^']+'\)/g) ?? [];
      expect(calls, file).toHaveLength(covered.length > 0 ? 1 : 0);
    }
  }
  expect(checked.size).toBeGreaterThan(20);
});
