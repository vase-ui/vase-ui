import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classStringsOfScript, classStringsOfTsx, classStringsOfVue } from './demoClasses.ts';

const TSX_CASES = [
  {
    name: 'a className attribute, with its white space collapsed',
    source: '<div className="grid  gap-2\n    p-1" title="no" />',
    expected: ['grid gap-2 p-1'],
  },
  {
    name: 'a constant whose name ends with Class, ClassName or Classes',
    source: [
      "const itemClass = 'a';",
      "const triggerClassName = 'b';",
      "const stateClasses = ['c d'];",
      "const sizes = { small: 'no' };",
    ].join('\n'),
    expected: ['a', 'b', 'c d'],
  },
  {
    name: 'a string made with +',
    source: "const rowClassName = 'border ' + 'border-neutral-950';",
    expected: ['border', 'border-neutral-950'],
  },
  {
    name: 'a call of clsx',
    source: "<span className={clsx(itemClass, 'border-r-0')} />",
    expected: ['border-r-0'],
  },
  {
    name: 'a template literal, with no empty string',
    source: "<span className={`${itemClass} w-full ${wide ? 'col-span-2' : ''} mt-1`} />",
    expected: ['w-full', 'col-span-2', 'mt-1'],
  },
  {
    name: 'a function of the state of the part',
    source: "<span className={(state) => (state.open ? 'rotate-180' : undefined)} />",
    expected: ['rotate-180'],
  },
  {
    name: 'a string that is no class: another attribute, a style and a class key',
    source: "<div title=\"no\" style={{ display: 'block' }} />;\nconst x = { class: 'no' };",
    expected: [],
  },
];

for (const { name, source, expected } of TSX_CASES) {
  test(`the reader of Base UI files gives the class strings of ${name}`, () => {
    assert.deepEqual(classStringsOfTsx(source).toSorted(), expected.toSorted());
  });
}

const VUE_CASES = [
  {
    name: 'a class attribute, with its white space collapsed',
    source: '<template><div class="grid  gap-2" title="no" /></template>',
    expected: ['grid gap-2'],
  },
  {
    name: 'an array in :class, with a constant, a string and a condition',
    source: [
      '<script setup lang="ts">',
      "const itemClass = 'flex h-8';",
      '</script>',
      '<template>',
      "  <span :class=\"[itemClass, 'border-r-0', wide ? 'col-span-2' : '', 'mt-1']\" />",
      '</template>',
    ].join('\n'),
    expected: ['flex h-8', 'border-r-0', 'col-span-2', 'mt-1'],
  },
  {
    name: 'a component in a slot',
    source: '<template><Root><template #item><Item class="a b" /></template></Root></template>',
    expected: ['a b'],
  },
  {
    name: 'a script block and a setup block',
    source: [
      '<script lang="ts">',
      "const rowClass = 'a';",
      '</script>',
      '<script setup lang="ts">',
      "const Icon = () => h('svg', { class: 'b' });",
      '</script>',
      '<template><div /></template>',
    ].join('\n'),
    expected: ['a', 'b'],
  },
  {
    name: 'a string that is no class: another attribute and another constant',
    source: [
      '<script setup lang="ts">',
      "const sizes = { small: 'no' };",
      '</script>',
      '<template><div title="no" :style="{ display: \'block\' }" /></template>',
    ].join('\n'),
    expected: [],
  },
];

for (const { name, source, expected } of VUE_CASES) {
  test(`the reader of Vue files gives the class strings of ${name}`, () => {
    assert.deepEqual(classStringsOfVue(source).toSorted(), expected.toSorted());
  });
}

test('the reader of scripts gives the strings of a constant and of the class key of an h() call', () => {
  const source = [
    'export const Root: FunctionalComponent = (_, { attrs, slots }) =>',
    "  h('div', { ...attrs, class: 'flex w-full flex-col' }, slots);",
    "export const labelClass = 'text-sm font-bold';",
    "const sizes = { small: 'no' };",
  ].join('\n');
  assert.deepEqual(classStringsOfScript(source).toSorted(), [
    'flex w-full flex-col',
    'text-sm font-bold',
  ]);
});

test('a Vue demo with the class strings of a Base UI demo gives the same strings', () => {
  const tsx = [
    "const itemClass = 'flex  h-8 px-3';",
    '<div className="grid gap-2">',
    "  <span className={clsx(itemClass, 'border-r-0')} />",
    "  <span className={`${itemClass} w-full ${wide ? 'col-span-2' : ''} mt-1`} />",
    '</div>',
  ].join('\n');
  const vue = [
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
  assert.deepEqual(classStringsOfVue(vue).toSorted(), classStringsOfTsx(tsx).toSorted());
});
