import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classRowOfBaseUi, classRowOfVue } from './demoClasses.ts';
import type { ClassRow, DemoFile } from './demoClasses.ts';

const baseUi = (...sources: string[]): ClassRow =>
  classRowOfBaseUi(sources.map((text, index) => ({ name: `file${index}.tsx`, text })));

const vue = (...files: DemoFile[]): ClassRow => classRowOfVue(files);

const BASE_UI_CASES: { name: string; source: string; expected: ClassRow }[] = [
  {
    name: 'a className attribute, with its white space collapsed and its element name as written',
    source: [
      '<Switch.Root className="grid  gap-2\n    p-1">',
      '  <Switch.Thumb className="a" />',
      '  <label className="b" title="no" />',
      '</Switch.Root>',
    ].join('\n'),
    expected: { 'Switch.Root': ['grid gap-2 p-1'], 'Switch.Thumb': ['a'], label: ['b'] },
  },
  {
    name: 'a string that two class attributes of one element name have, one time for each attribute',
    source: '<div className="a"><div className="a b" /><div className="a" /></div>',
    expected: { div: ['a', 'a', 'a b'] },
  },
  {
    name: 'a call of clsx',
    source: "<span className={clsx('border-t', 'border-r-0')} />",
    expected: { span: ['border-r-0', 'border-t'] },
  },
  {
    name: 'a template literal, with no empty string',
    source: "<span className={`w-full ${wide ? 'col-span-2' : ''} mt-1`} />",
    expected: { span: ['col-span-2', 'mt-1', 'w-full'] },
  },
  {
    name: 'a function of the state of the part',
    source: "<span className={(state) => (state.open ? 'rotate-180' : undefined)} />",
    expected: { span: ['rotate-180'] },
  },
  {
    name: 'a string that is no class: another attribute, a style and a class key',
    source: "<div title=\"no\" style={{ display: 'block' }} />;\nconst x = { class: 'no' };",
    expected: {},
  },
  {
    name: 'a class constant, one time for each element name whose class attribute names it',
    source: [
      "const itemClass = 'flex h-8';",
      '<div className={itemClass} />',
      "<div className={clsx(itemClass, 'a')} />",
      '<span className={`${itemClass} b`} />',
    ].join('\n'),
    expected: { div: ['a', 'flex h-8'], span: ['b', 'flex h-8'] },
  },
  {
    name: 'a class constant that another class constant names',
    source: [
      "const baseClass = 'flex';",
      'const itemClass = `${baseClass} h-8`;',
      '<div className={itemClass} />',
    ].join('\n'),
    expected: { div: ['flex', 'h-8'] },
  },
  {
    name: 'a class constant made with +, with no class attribute that names it',
    source: "const rowClassName = 'border ' + 'border-neutral-950';",
    expected: { rowClassName: ['border', 'border-neutral-950'] },
  },
  {
    name: 'class constants that no class attribute names, each with its own name',
    source: [
      "const itemClass = 'a';",
      "const triggerClassName = 'b';",
      "const stateClasses = ['c d'];",
      "const sizes = { small: 'no' };",
      '<div className="e" />',
    ].join('\n'),
    expected: { div: ['e'], itemClass: ['a'], triggerClassName: ['b'], stateClasses: ['c d'] },
  },
  {
    name: 'an import with another local name, as the exported name',
    source: [
      "import { Button as BaseButton } from '@base-ui/react/button';",
      "import { Menu as BaseMenu, Tooltip } from '@base-ui/react/menu';",
      '<BaseButton className="a" />',
      '<BaseMenu.Item className="b" />',
      '<Tooltip.Popup className="c" />',
    ].join('\n'),
    expected: { Button: ['a'], 'Menu.Item': ['b'], 'Tooltip.Popup': ['c'] },
  },
  {
    name: 'a component that the file makes from one element, as that element',
    source: [
      'function Link(props) {',
      '  return <NavigationMenu.Link render={<a />} {...props} />;',
      '}',
      'function PlusIcon(props) {',
      '  return <svg {...props} />;',
      '}',
      '<Link className="a" />',
      '<PlusIcon className="b" />',
    ].join('\n'),
    expected: { 'NavigationMenu.Link': ['a'], svg: ['b'] },
  },
];

for (const { name, source, expected } of BASE_UI_CASES) {
  test(`the reader of Base UI files gives the class strings by element name of ${name}`, () => {
    assert.deepEqual(baseUi(source), expected);
  });
}

test('the reader of Base UI files finds a class constant in another file of the folder', () => {
  const row = baseUi("export const rowClass = 'a b';", '<li className={rowClass} />');
  assert.deepEqual(row, { li: ['a b'] });
});

test('the reader of Base UI files gives a class attribute the class constant of its own file', () => {
  const row = baseUi(
    "const itemClass = 'a';\n<div className={itemClass} />",
    "const itemClass = 'b';\n<span className={itemClass} />",
  );
  assert.deepEqual(row, { div: ['a'], span: ['b'] });
});

test('the reader of Base UI files gives each string in the sequence of the code units, with its repeats', () => {
  const row = baseUi(
    '<p className="b" /><p className="B" /><p className="a" /><p className="a" />',
  );
  assert.deepEqual(row, { p: ['B', 'a', 'a', 'b'] });
});

const VUE_CASES: { name: string; files: DemoFile[]; expected: ClassRow }[] = [
  {
    name: 'a class attribute, with its white space collapsed and its element name as written',
    files: [
      {
        name: 'index.vue',
        text: '<template><Switch.Root class="grid  gap-2" title="no"><label class="a" /></Switch.Root></template>',
      },
    ],
    expected: { 'Switch.Root': ['grid gap-2'], label: ['a'] },
  },
  {
    name: 'an array in :class, with a constant, a string and a condition',
    files: [
      {
        name: 'index.vue',
        text: [
          '<script setup lang="ts">',
          "const itemClass = 'flex h-8';",
          '</script>',
          '<template>',
          "  <span :class=\"[itemClass, 'border-r-0', wide ? 'col-span-2' : '', 'mt-1']\" />",
          '</template>',
        ].join('\n'),
      },
    ],
    expected: { span: ['border-r-0', 'col-span-2', 'flex h-8', 'mt-1'] },
  },
  {
    name: 'a component in a slot',
    files: [
      {
        name: 'index.vue',
        text: '<template><Root><template #item><Item class="a b" /></template></Root></template>',
      },
    ],
    expected: { Item: ['a b'] },
  },
  {
    name: 'a class constant of a script block, one time for each element name whose class names it',
    files: [
      {
        name: 'index.vue',
        text: [
          '<script lang="ts">',
          "const baseClass = 'a';",
          '</script>',
          '<script setup lang="ts">',
          'const itemClass = `${baseClass} b`;',
          '</script>',
          '<template><div :class="itemClass" /><div :class="[itemClass]" /><p :class="baseClass" /></template>',
        ].join('\n'),
      },
    ],
    expected: { div: ['a', 'b'], p: ['a'] },
  },
  {
    name: 'a class constant of a .ts file of the folder',
    files: [
      { name: 'classes.ts', text: "export const rowClass = 'a';" },
      { name: 'index.vue', text: '<template><li :class="rowClass" /></template>' },
    ],
    expected: { li: ['a'] },
  },
  {
    name: 'a class constant that no class attribute names, with its own name',
    files: [
      {
        name: 'index.vue',
        text: "<script setup lang=\"ts\">\nconst rowClass = 'a';\nconst sizes = { small: 'no' };\n</script>\n<template><div /></template>",
      },
    ],
    expected: { rowClass: ['a'] },
  },
  {
    name: 'an import with another local name, as the exported name',
    files: [
      {
        name: 'index.vue',
        text: [
          '<script setup lang="ts">',
          "import { Button as VaseButton, Menu as VaseMenu } from '@vase-ui/vue';",
          '</script>',
          '<template><VaseButton class="a" /><VaseMenu.Item class="b" /></template>',
        ].join('\n'),
      },
    ],
    expected: { Button: ['a'], 'Menu.Item': ['b'] },
  },
  {
    name: 'a component that the file makes from one element with h(), as that element',
    files: [
      {
        name: 'index.vue',
        text: [
          '<script setup lang="ts">',
          "const PlusIcon: FunctionalComponent = (_, { attrs }) => h('svg', { ...attrs, viewBox: '0 0 12 12' });",
          '</script>',
          '<template><PlusIcon class="a" /></template>',
        ].join('\n'),
      },
    ],
    expected: { svg: ['a'] },
  },
  {
    name: 'the class key of an object in an h() call, as the first argument of the call',
    files: [
      {
        name: 'index.vue',
        text: [
          '<script setup lang="ts">',
          "const Icon = () => h('svg', { class: 'a' }, slots);",
          '</script>',
          '<template><div /></template>',
        ].join('\n'),
      },
    ],
    expected: { svg: ['a'] },
  },
  {
    name: 'the class key of an object that a call around it gives to another call',
    files: [
      {
        name: 'Clear.ts',
        text: "export const Clear = (_, { attrs, slots }) =>\n  h(Combobox.Clear, mergeProps({ class: 'a' }, attrs), slots);",
      },
    ],
    expected: { 'Combobox.Clear': ['a'] },
  },
  {
    name: 'the class key of an object that a wrapper call has as a later argument',
    files: [
      { name: 'Input.ts', text: "export const Input = withProps(Combobox.Input, { class: 'a' });" },
    ],
    expected: { 'Combobox.Input': ['a'] },
  },
  {
    name: 'the class key of an object that no call has',
    files: [{ name: 'props.ts', text: "export const props = { class: 'a' };" }],
    expected: { '(no element)': ['a'] },
  },
  {
    name: 'a string that is no class: another attribute and another constant',
    files: [
      {
        name: 'index.vue',
        text: [
          '<script setup lang="ts">',
          "const sizes = { small: 'no' };",
          '</script>',
          '<template><div title="no" :style="{ display: \'block\' }" /></template>',
        ].join('\n'),
      },
    ],
    expected: {},
  },
];

for (const { name, files, expected } of VUE_CASES) {
  test(`the reader of Vue files gives the class strings by element name of ${name}`, () => {
    assert.deepEqual(vue(...files), expected);
  });
}

test('a Vue demo with the class strings of a Base UI demo gives the same row', () => {
  const tsx = [
    "const itemClass = 'flex  h-8 px-3';",
    '<div className="grid gap-2">',
    "  <span className={clsx(itemClass, 'border-r-0')} />",
    "  <span className={`${itemClass} w-full ${wide ? 'col-span-2' : ''} mt-1`} />",
    '</div>',
  ].join('\n');
  const text = [
    '<script setup lang="ts">',
    "const itemClass = 'flex  h-8 px-3';",
    '</script>',
    '<template>',
    '  <div class="grid gap-2">',
    '    <span :class="[itemClass, \'border-r-0\']" />',
    "    <span :class=\"[itemClass, 'w-full', wide ? 'col-span-2' : '', 'mt-1']\" />",
    '  </div>',
    '</template>',
  ].join('\n');
  assert.deepEqual(vue({ name: 'index.vue', text }), baseUi(tsx));
});

test('class strings that change places between two elements with other names give another row', () => {
  const make = (first: string, second: string): ClassRow =>
    vue({
      name: 'index.vue',
      text: `<template><Switch.Root class="${first}"><Switch.Thumb class="${second}" /></Switch.Root></template>`,
    });
  assert.notDeepEqual(make('a', 'b'), make('b', 'a'));
});
