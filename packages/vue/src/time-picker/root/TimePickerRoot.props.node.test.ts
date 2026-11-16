/// <reference types="vite/client" />
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileScript, parse } from 'vue/compiler-sfc';

// Each glob lists the parts: a fixture of a test is not a part.
const sources = import.meta.glob<string>(['../*/*.vue', '!../**/*.test.vue', '!../**/*.spec.vue'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const components = import.meta.glob<{ props?: Record<string, unknown> }>(
  ['../*/*.vue', '!../**/*.test.vue', '!../**/*.spec.vue'],
  { import: 'default', eager: true },
);

const familyFolder = join(import.meta.dirname, '..');
const parts = Object.keys(sources).map((key) => {
  const filename = join(import.meta.dirname, key);
  return { name: relative(familyFolder, filename), key, filename };
});

// The API reference lists the props that the SFC compiler reads as props. A constant of `setup`
// with the name of a prop replaces that prop in the bindings of the compiler, so the reference
// leaves the prop out. The part still works, because Vue reads the props of the component.
describe('the props of the parts of the time picker', () => {
  it.each(parts)('$name has no constant of setup with the name of a prop', ({ key, filename }) => {
    const { descriptor } = parse(sources[key] ?? '', { filename });
    // The compiler resolves the types that a part imports from the file name.
    const { bindings } = compileScript(descriptor, { id: filename });

    const hidden = Object.keys(components[key]?.props ?? {}).filter(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- `vue/compiler-sfc` does not export the enum `BindingTypes`, so the code compares its value.
      (prop) => bindings?.[prop] !== 'props',
    );

    expect(hidden).toEqual([]);
  });
});
