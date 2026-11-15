import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DemoFile } from './demoClasses.ts';
import { baseUiVariantsDiffer, compareVueVariants } from './demoVariants.ts';

const file = (name: string, text: string): DemoFile => ({ name, text });

const BASE_UI_EQUAL_CASES: { name: string; cssModules: string; tailwind: string }[] = [
  {
    name: 'a className attribute',
    cssModules: '<div className={styles.Box} />',
    tailwind: '<div className="flex" />',
  },
  {
    name: 'a class constant',
    cssModules: '<div />',
    tailwind: "const boxClass = 'flex';\n<div />",
  },
  {
    name: 'an import of a style sheet',
    cssModules: "import styles from './index.module.css';\n<div />",
    tailwind: '<div />',
  },
  {
    name: 'an import of clsx',
    cssModules: '<div />',
    tailwind: "import clsx from 'clsx';\n<div />",
  },
  {
    name: 'the text of an element',
    cssModules: '<p>Playback speed</p>',
    tailwind: '<p>Font weight</p>',
  },
  {
    name: 'the value of an attribute that is text',
    cssModules: '<input aria-label="Name" placeholder="Jane" title="a" alt="b" />',
    tailwind: '<input aria-label="Other" placeholder="John" title="c" alt="d" />',
  },
  {
    name: 'the parentheses around JSX',
    cssModules: 'function A() {\n  return (\n    <div>\n      <p />\n    </div>\n  );\n}',
    tailwind: 'function A() {\n  return <div><p /></div>;\n}',
  },
];

for (const { name, cssModules, tailwind } of BASE_UI_EQUAL_CASES) {
  test(`two variants of a demo of Base UI that differ only in ${name} do not differ`, () => {
    assert.equal(
      baseUiVariantsDiffer([file('index.tsx', cssModules)], [file('index.tsx', tailwind)]),
      false,
    );
  });
}

const BASE_UI_DIFFERENT_CASES: { name: string; cssModules: DemoFile[]; tailwind: DemoFile[] }[] = [
  {
    name: 'an element',
    cssModules: [file('index.tsx', '<div />')],
    tailwind: [file('index.tsx', '<span />')],
  },
  {
    name: 'the name of an attribute that is text',
    cssModules: [file('index.tsx', '<input aria-label="a" />')],
    tailwind: [file('index.tsx', '<input aria-labelledby="a" />')],
  },
  {
    name: 'the value of an attribute that is not text',
    cssModules: [file('index.tsx', '<button type="button" />')],
    tailwind: [file('index.tsx', '<button type="submit" />')],
  },
  {
    name: 'an attribute that only one variant has',
    cssModules: [file('index.tsx', '<div data-color="red" />')],
    tailwind: [file('index.tsx', '<div />')],
  },
  {
    name: 'a file that only one variant has',
    cssModules: [file('index.tsx', '<div />')],
    tailwind: [file('index.tsx', '<div />'), file('classes.ts', "export const a = 'b';")],
  },
  {
    name: 'the code of a file that both variants have',
    cssModules: [file('index.tsx', '<div />'), file('data.ts', 'export const a = 1;')],
    tailwind: [file('index.tsx', '<div />'), file('data.ts', 'export const a = 2;')],
  },
];

for (const { name, cssModules, tailwind } of BASE_UI_DIFFERENT_CASES) {
  test(`two variants of a demo of Base UI that differ in ${name} differ`, () => {
    assert.equal(baseUiVariantsDiffer(cssModules, tailwind), true);
  });
}

test('the files of a variant of Base UI are compared by name, in any sequence', () => {
  const index = file('index.tsx', '<div />');
  const data = file('data.ts', 'export const a = 1;');
  assert.equal(baseUiVariantsDiffer([index, data], [data, index]), false);
});

const vueFile = (template: string, script = ''): DemoFile =>
  file(
    'index.vue',
    `${script === '' ? '' : `<script setup lang="ts">\n${script}\n</script>\n`}<template>${template}</template>`,
  );

const compare = (cssModules: DemoFile[], tailwind: DemoFile[]) =>
  compareVueVariants(cssModules, tailwind);

const VUE_EQUAL_CASES: { name: string; cssModules: DemoFile[]; tailwind: DemoFile[] }[] = [
  {
    name: 'a class attribute and a class binding',
    cssModules: [vueFile('<div :class="styles.Box"><p class="a" /></div>')],
    tailwind: [vueFile('<div class="flex"><p :class="[b, \'c\']" /></div>')],
  },
  {
    name: 'a class constant and an import of a style sheet in the script',
    cssModules: [vueFile('<div />', "import styles from './index.module.css';")],
    tailwind: [vueFile('<div />', "const boxClass = 'flex';")],
  },
  {
    name: 'the class key of an object in an h() call',
    cssModules: [vueFile('<Icon />', "const Icon = () => h('svg', { class: styles.Icon });")],
    tailwind: [vueFile('<Icon />', "const Icon = () => h('svg', { class: 'size-3' });")],
  },
  {
    name: 'a file that gives no token, such as a file of class constants',
    cssModules: [vueFile('<div />')],
    tailwind: [vueFile('<div />'), file('classes.ts', "export const boxClass = 'flex';")],
  },
  {
    name: 'the white space of a text and of an expression',
    cssModules: [vueFile('<p>Open  the\n menu {{ a  +  b }}</p>')],
    tailwind: [vueFile('<p>Open the menu {{ a + b }}</p>')],
  },
];

for (const { name, cssModules, tailwind } of VUE_EQUAL_CASES) {
  test(`two Vue variants that differ only in ${name} have no difference of form`, () => {
    assert.equal(compare(cssModules, tailwind).form, undefined);
  });
}

const VUE_FORM_CASES: {
  name: string;
  cssModules: DemoFile[];
  tailwind: DemoFile[];
  expected: string;
}[] = [
  {
    name: 'an element',
    cssModules: [vueFile('<div><span /></div>')],
    tailwind: [vueFile('<div><p /></div>')],
    expected: 'css-modules/index.vue has <span> where tailwind/index.vue has <p>',
  },
  {
    name: 'a text',
    cssModules: [vueFile('<Slider.Label>Font weight</Slider.Label>')],
    tailwind: [vueFile('<Slider.Label>Playback speed</Slider.Label>')],
    expected:
      'css-modules/index.vue has "Font weight" where tailwind/index.vue has "Playback speed"',
  },
  {
    name: 'an interpolation',
    cssModules: [vueFile('<p>{{ a }}</p>')],
    tailwind: [vueFile('<p>{{ b }}</p>')],
    expected: 'css-modules/index.vue has {{ a }} where tailwind/index.vue has {{ b }}',
  },
  {
    name: 'the value of an attribute that is not a class',
    cssModules: [vueFile('<label for="name" />')],
    tailwind: [vueFile('<label for="name-tw" />')],
    expected:
      'css-modules/index.vue has <label for="name"> where tailwind/index.vue has <label for="name-tw">',
  },
  {
    name: 'a directive',
    cssModules: [vueFile('<div v-if="open" />')],
    tailwind: [vueFile('<div v-if="shown" />')],
    expected:
      'css-modules/index.vue has <div v-if="open"> where tailwind/index.vue has <div v-if="shown">',
  },
  {
    name: 'an attribute that only one variant has',
    cssModules: [vueFile('<div style="display: flex" />')],
    tailwind: [vueFile('<div />')],
    expected:
      'css-modules/index.vue has <div style="display: flex"> where tailwind/index.vue has <div>',
  },
  {
    name: 'an element that only one variant has',
    cssModules: [vueFile('<div><p /></div>')],
    tailwind: [vueFile('<div />')],
    expected: 'css-modules/index.vue has <p> where tailwind/index.vue has nothing',
  },
  {
    name: 'a token of the script',
    cssModules: [vueFile('<div />', 'const a = 1;')],
    tailwind: [vueFile('<div />', 'const a = 2;')],
    expected: 'css-modules/index.vue has 1 where tailwind/index.vue has 2',
  },
  {
    name: 'a file that only one variant has',
    cssModules: [vueFile('<div />'), file('List.vue', '<template><ul /></template>')],
    tailwind: [vueFile('<div />')],
    expected: 'css-modules has List.vue, index.vue where tailwind has index.vue',
  },
  {
    name: 'the code of a .ts file',
    cssModules: [vueFile('<div />'), file('data.ts', 'export const a = 1;')],
    tailwind: [vueFile('<div />'), file('data.ts', 'export const a = 2;')],
    expected: 'css-modules/data.ts has 1 where tailwind/data.ts has 2',
  },
];

for (const { name, cssModules, tailwind, expected } of VUE_FORM_CASES) {
  test(`two Vue variants that differ in ${name} give the first difference of form`, () => {
    assert.equal(compare(cssModules, tailwind).form, expected);
  });
}

const VUE_TEXT_CASES: {
  name: string;
  cssModules: DemoFile[];
  tailwind: DemoFile[];
  expected: string | undefined;
}[] = [
  {
    name: 'a static attribute that is text',
    cssModules: [vueFile('<button aria-label="Trigger 1" /><img alt="a" />')],
    tailwind: [vueFile('<button aria-label="Controlled tooltip" /><img alt="a" />')],
    expected:
      'css-modules/index.vue has aria-label="Trigger 1" where tailwind/index.vue has aria-label="Controlled tooltip"',
  },
  {
    name: 'a bound attribute that is text',
    cssModules: [vueFile('<input :placeholder="first" />')],
    tailwind: [vueFile('<input v-bind:placeholder="second" />')],
    expected:
      'css-modules/index.vue has :placeholder="first" where tailwind/index.vue has :placeholder="second"',
  },
  {
    name: 'a text node',
    cssModules: [vueFile('<p>Open</p><p>Close</p>')],
    tailwind: [vueFile('<p>Open</p><p>Shut</p>')],
    expected: 'css-modules/index.vue has "Close" where tailwind/index.vue has "Shut"',
  },
  {
    name: 'a text in another file',
    cssModules: [vueFile('<List />'), file('List.vue', '<template><li>a</li></template>')],
    tailwind: [vueFile('<List />'), file('List.vue', '<template><li>b</li></template>')],
    expected: 'css-modules/List.vue has "a" where tailwind/List.vue has "b"',
  },
  {
    name: 'an attribute that is not text',
    cssModules: [vueFile('<a href="a" id="a">Open</a>')],
    tailwind: [vueFile('<a href="b" id="b">Open</a>')],
    expected: undefined,
  },
  {
    name: 'another number of texts, so that the elements differ',
    cssModules: [vueFile('<ul><li>a</li><li>b</li></ul>')],
    tailwind: [vueFile('<ul><li>x</li><li>a</li><li>b</li></ul>')],
    expected: undefined,
  },
];

for (const { name, cssModules, tailwind, expected } of VUE_TEXT_CASES) {
  test(`two Vue variants that differ in ${name} give ${expected === undefined ? 'no difference of text' : 'the first difference of text'}`, () => {
    assert.equal(compare(cssModules, tailwind).text, expected);
  });
}

test('two Vue variants with the same texts and other elements give no difference of text', () => {
  const cssModules = [vueFile('<div><p aria-label="a">Open</p></div>')];
  const tailwind = [vueFile('<section><p aria-label="a">Open</p></section>')];
  assert.deepEqual(compare(cssModules, tailwind), {
    form: 'css-modules/index.vue has <div> where tailwind/index.vue has <section>',
    text: undefined,
  });
});
