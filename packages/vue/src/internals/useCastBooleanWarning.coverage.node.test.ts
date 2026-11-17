import { expect, it } from 'vitest';

const modules = import.meta.glob<Record<string, unknown>>('../*/index.ts', { eager: true });
const sources = import.meta.glob<string>('../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const exceptions: Record<string, { props: string[]; reason: string }> = {
  '../field/root/FieldRoot.vue': { props: ['invalid'], reason: 'The part reads invalid === true.' },
  '../field/error/FieldError.vue': {
    props: ['match'],
    reason: 'Only true or a string selects an error.',
  },
};

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
      if (checked.has(file)) {
        continue;
      }
      checked.add(file);
      const covered = Object.entries(part.props).filter(([name, option]) => {
        if (!option || typeof option !== 'object' || exceptions[file]?.props.includes(name)) {
          return false;
        }
        const types = Array.isArray(option.type) ? option.type : [option.type];
        return (
          types.includes(Boolean) && Object.hasOwn(option, 'default') && option.default !== false
        );
      });
      const source = sources[file];
      expect(source, file).toBeDefined();
      const calls = source.match(/useCastBooleanWarning\('[^']+'(?:,\s*\[[^\]]*\])?\)/g) ?? [];
      expect(calls, file).toHaveLength(covered.length > 0 ? 1 : 0);
      if (covered.length > 0 && exceptions[file]) {
        expect(calls[0], exceptions[file].reason).toContain(
          JSON.stringify(exceptions[file].props).replaceAll('"', "'"),
        );
      }
    }
  }
  expect(checked.size).toBeGreaterThan(85);
  for (const file of Object.keys(exceptions)) {
    expect(checked.has(file), file).toBe(true);
  }
});
