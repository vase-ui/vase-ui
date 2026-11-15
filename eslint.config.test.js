import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

const ROOT = import.meta.dirname;

// The samples are not files, so no TypeScript project has them. The tests are for rules that read
// only the syntax. Many samples have one path. With `CI` set, typescript-eslint takes the second
// sample of a path for a step of a fix, and it gives that sample a program. A rule of the Vue
// plugin then reads types and fails.
const eslint = new ESLint({
  cwd: ROOT,
  overrideConfig: [
    tseslint.configs.disableTypeChecked,
    { languageOptions: { parserOptions: { disallowAutomaticSingleRunInference: true } } },
  ],
});

async function lint(filePath, code) {
  const [{ messages }] = await eslint.lintText(code, { filePath });
  return messages.map(({ ruleId, message }) => ({ ruleId, message }));
}

const DOCS_SFC = 'docs/.vitepress/components/Sample.vue';
const DOCS_MODULE = 'docs/.vitepress/components/sample.ts';
const PAGE = 'docs/sample.md';

const HTML_DECLARATIONS = 'declare const element: HTMLElement;\ndeclare const html: string;';
const HTML_HINT = 'text interpolation';

function docsSfc(script, template = '<div />') {
  return `<script setup lang="ts">\n${script}\n</script>\n\n<template>\n  ${template}\n</template>\n`;
}

// VitePress reads an include in this form. A region (`#name`) or a range (`{2,8}`) can end the
// path. A path that starts with `@` is in `docs`.
const INCLUDE = /<!--\s*@include:\s*(.*?)\s*-->/g;

function includedFile(page, include) {
  const path = include.replace(/\{\d*,\d*\}$/, '').replace(/#[^\s{]+$/, '');
  return path.startsWith('@') ? join('docs', path.slice(1)) : join(dirname(page), path);
}

// The body is on line 13 of the page.
function page(body) {
  return `---\norder: 1\n---\n\n<script setup lang="ts">\nimport { data } from './parity.data.ts';\n</script>\n\n# Sample\n\n{{ data.title }}\n\n${body}\n`;
}

const SRC = 'packages/vue/src/dialog';

const SCRIPT_ONLY_TEMPLATE = '\n<template>\n  <div />\n</template>\n';

const WAIT_HINT = '#test-utils';
const WAIT_FILES = [
  ['a test file', `${SRC}/DialogRoot.test.tsx`],
  ['a shared suite', 'packages/vue/test/popupConformanceTests.tsx'],
];

const reported = [
  {
    name: 'an import of getCurrentInstance',
    file: `${SRC}/useRoot.ts`,
    code: "import { getCurrentInstance } from 'vue';\n\nexport const instance = getCurrentInstance();\n",
    ruleId: 'no-restricted-imports',
    hint: 'provide',
  },
  {
    name: 'an import of cloneVNode',
    file: `${SRC}/useRoot.ts`,
    code: "import { cloneVNode } from 'vue';\n\nexport const clone = cloneVNode;\n",
    ruleId: 'no-restricted-imports',
    hint: '#render',
  },
  {
    name: 'an import of withDirectives',
    file: `${SRC}/useRoot.ts`,
    code: "import { withDirectives } from 'vue';\n\nexport const apply = withDirectives;\n",
    ruleId: 'no-restricted-imports',
    hint: 'composable',
  },
  {
    name: 'an import of resolveDirective',
    file: `${SRC}/useRoot.ts`,
    code: "import { resolveDirective } from 'vue';\n\nexport const resolve = resolveDirective;\n",
    ruleId: 'no-restricted-imports',
    hint: 'composable',
  },
  {
    name: 'an import of defineComponent',
    file: `${SRC}/useRoot.ts`,
    code: "import { defineComponent } from 'vue';\n\nexport const define = defineComponent;\n",
    ruleId: 'no-restricted-imports',
    hint: '<script setup lang="ts">',
  },
  {
    name: 'a call of a slot through a variable',
    file: `${SRC}/useRoot.ts`,
    code: "import { useSlots } from 'vue';\n\nconst slots = useSlots();\n\nexport const content = slots.default?.();\n",
    ruleId: 'no-restricted-syntax',
    hint: 'template',
  },
  {
    name: 'a call of a slot through useSlots',
    file: `${SRC}/useRoot.ts`,
    code: "import { useSlots } from 'vue';\n\nexport const content = useSlots().default?.();\n",
    ruleId: 'no-restricted-syntax',
    hint: 'template',
  },
  {
    name: 'a call of a slot through $slots',
    file: `${SRC}/useRoot.ts`,
    code: 'export const read = (instance: { $slots: Record<string, () => unknown> }) =>\n  instance.$slots.default();\n',
    ruleId: 'no-restricted-syntax',
    hint: 'template',
  },
  {
    name: 'a read of $el',
    file: `${SRC}/useRoot.ts`,
    code: 'export const read = (instance: { $el: unknown }) => instance.$el;\n',
    ruleId: 'no-restricted-properties',
    hint: 'resolveElement',
  },
  {
    name: 'a read of $parent',
    file: `${SRC}/useRoot.ts`,
    code: 'export const read = (instance: { $parent: unknown }) => instance.$parent;\n',
    ruleId: 'no-restricted-properties',
    hint: 'provide',
  },
  ...['toSorted', 'toReversed', 'toSpliced'].map((method) => ({
    name: `a call of ${method}`,
    file: `${SRC}/useRoot.ts`,
    code: `export const copy = (items: number[]) => items.${method}();\n`,
    ruleId: 'no-restricted-properties',
    hint: 'Firefox 114',
  })),
  {
    name: 'a read of $parent in resolveElement.ts',
    file: 'packages/vue/src/internals/resolveElement.ts',
    code: 'export const read = (instance: { $parent: unknown }) => instance.$parent;\n',
    ruleId: 'no-restricted-properties',
    hint: 'provide',
  },
  {
    name: 'a read of $el in a template',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts"></script>\n\n<template>\n  <div>{{ $el }}</div>\n</template>\n`,
    ruleId: 'vue/no-restricted-syntax',
    hint: 'resolveElement',
  },
  {
    name: 'a read of $parent in a template',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts"></script>\n\n<template>\n  <div>{{ $parent }}</div>\n</template>\n`,
    ruleId: 'vue/no-restricted-syntax',
    hint: 'provide',
  },
  ...['toSorted', 'toReversed', 'toSpliced'].map((method) => ({
    name: `a call of ${method} in a template`,
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts">\nconst items = [2, 1];\n</script>\n\n<template>\n  <div>{{ items.${method}() }}</div>\n</template>\n`,
    ruleId: 'vue/no-restricted-syntax',
    hint: 'Firefox 114',
  })),
  {
    name: 'a directive variable in script setup',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts">\nconst vFocus = {};\n</script>\n${SCRIPT_ONLY_TEMPLATE}`,
    ruleId: 'no-restricted-syntax',
    hint: 'composable',
  },
  {
    name: 'a directive function in script setup',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts">\nfunction vFocus() {}\n</script>\n${SCRIPT_ONLY_TEMPLATE}`,
    ruleId: 'no-restricted-syntax',
    hint: 'composable',
  },
  {
    name: 'a directive import in script setup',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts">\nimport vFocus from './focus';\n</script>\n${SCRIPT_ONLY_TEMPLATE}`,
    ruleId: 'no-restricted-syntax',
    hint: 'composable',
  },
  {
    name: 'a custom directive in a template',
    file: `${SRC}/DialogRoot.vue`,
    code: '<script setup lang="ts"></script>\n\n<template>\n  <div v-focus />\n</template>\n',
    ruleId: 'vue/no-restricted-syntax',
    hint: 'composable',
  },
  {
    name: 'a custom directive named generic in a template',
    file: `${SRC}/DialogRoot.vue`,
    code: '<script setup lang="ts"></script>\n\n<template>\n  <div v-generic />\n</template>\n',
    ruleId: 'vue/no-restricted-syntax',
    hint: 'composable',
  },
  {
    name: 'v-memo',
    file: `${SRC}/DialogRoot.vue`,
    code: '<script setup lang="ts"></script>\n\n<template>\n  <div v-memo="[1]" />\n</template>\n',
    ruleId: 'vue/no-restricted-syntax',
    hint: 'Remove it',
  },
  {
    name: 'the Options API',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script lang="ts">\nexport default {\n  data() {\n    return { open: false };\n  },\n};\n</script>\n${SCRIPT_ONLY_TEMPLATE}`,
    ruleId: 'vue/component-api-style',
    hint: '<script setup>',
  },
  {
    name: 'a script block with no lang',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup>\nconst open = true;\n</script>\n\n<template>\n  <div>{{ open }}</div>\n</template>\n`,
    ruleId: 'vue/block-lang',
    hint: 'lang',
  },
  ...['document', 'window', 'navigator'].map((name) => ({
    name: `the global ${name}`,
    file: `${SRC}/useRoot.ts`,
    code: `export const value = ${name};\n`,
    ruleId: 'no-restricted-globals',
    hint: 'ownerDocument',
  })),
  {
    name: 'a DOM global through globalThis',
    file: `${SRC}/useRoot.ts`,
    code: 'export const value = globalThis.document;\n',
    ruleId: 'no-restricted-globals',
    hint: 'ownerDocument',
  },
  ...['HTMLElement', 'Element', 'Node', 'Event', 'ShadowRoot'].map((className) => ({
    name: `instanceof ${className}`,
    file: `${SRC}/useRoot.ts`,
    code: `export const check = (value: unknown) => value instanceof ${className};\n`,
    ruleId: 'no-restricted-syntax',
    hint: 'nodeType',
  })),
  {
    name: 'a private field',
    file: `${SRC}/store.ts`,
    code: 'export class Store {\n  private readonly items: string[] = [];\n\n  get size() {\n    return this.items.length;\n  }\n}\n',
    ruleId: 'no-restricted-syntax',
    hint: '#name',
  },
  {
    name: 'a private method',
    file: `${SRC}/store.ts`,
    code: 'export class Store {\n  private clear() {}\n\n  reset() {\n    this.clear();\n  }\n}\n',
    ruleId: 'no-restricted-syntax',
    hint: '#name',
  },
  {
    name: 'a private get accessor',
    file: `${SRC}/store.ts`,
    code: 'export class Store {\n  private get size() {\n    return 0;\n  }\n\n  read() {\n    return this.size;\n  }\n}\n',
    ruleId: 'no-restricted-syntax',
    hint: '#name',
  },
  {
    name: 'a private member of a class expression in script setup',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts">\nconst Store = class {\n  private static count = 0;\n\n  static next() {\n    Store.count += 1;\n    return Store.count;\n  }\n};\nconst count = Store.next();\n</script>\n\n<template>\n  <div>{{ count }}</div>\n</template>\n`,
    ruleId: 'no-restricted-syntax',
    hint: '#name',
  },
  {
    name: 'a public member',
    file: `${SRC}/store.ts`,
    code: 'export class Store {\n  public clear() {}\n}\n',
    ruleId: '@typescript-eslint/explicit-member-accessibility',
    hint: 'Public accessibility modifier',
  },
  {
    name: 'a TSX file',
    file: `${SRC}/DialogRoot.tsx`,
    code: 'export const value = 1;\n',
    ruleId: 'no-restricted-syntax',
    hint: 'SFC',
  },
  {
    name: 'a React event key in an object',
    file: `${SRC}/useRoot.ts`,
    code: 'export const props = { onKeyDown() {} };\n',
    ruleId: 'no-restricted-syntax',
    hint: 'onKeydown',
  },
  {
    name: 'a read of a React event key',
    file: `${SRC}/useRoot.ts`,
    code: 'export const read = (props: Record<string, unknown>) => props.onPointerDown;\n',
    ruleId: 'no-restricted-syntax',
    hint: 'onPointerdown',
  },
  {
    name: 'a React event key with the Capture suffix',
    file: `${SRC}/useRoot.ts`,
    code: 'export const props = { onMouseDownCapture() {} };\n',
    ruleId: 'no-restricted-syntax',
    hint: 'onMousedownCapture',
  },
  {
    name: 'a React event key in script setup',
    file: `${SRC}/DialogRoot.vue`,
    code: '<script setup lang="ts">\nconst props = { onMouseMove() {} };\n</script>\n\n<template>\n  <div v-bind="props" />\n</template>\n',
    ruleId: 'no-restricted-syntax',
    hint: 'onMousemove',
  },
  {
    name: 'a React event prop in a TSX test',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: 'export const element = <button onDoubleClick={() => {}} />;\n',
    ruleId: 'no-restricted-syntax',
    hint: 'onDblclick',
  },
  {
    name: 'a React event key in a test helper',
    file: 'packages/vue/test/describeConformance.tsx',
    code: 'export const props = { onMouseEnter() {} };\n',
    ruleId: 'no-restricted-syntax',
    hint: 'onMouseenter',
  },
  {
    name: 'v-html in a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\nconst html = "";\n</script>\n\n<template>\n  <div v-html="html" />\n</template>\n',
    ruleId: 'vue/no-v-html',
    hint: 'XSS',
  },
  {
    name: ':innerHTML in a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\nconst html = "";\n</script>\n\n<template>\n  <div :innerHTML="html" />\n</template>\n',
    ruleId: 'vue/no-restricted-syntax',
    hint: 'text interpolation',
  },
  {
    name: 'v-bind:innerHTML in a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\nconst html = "";\n</script>\n\n<template>\n  <div v-bind:innerHTML="html" />\n</template>\n',
    ruleId: 'vue/no-restricted-syntax',
    hint: 'text interpolation',
  },
  {
    name: '.innerHTML in a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\nconst html = "";\n</script>\n\n<template>\n  <div .innerHTML="html" />\n</template>\n',
    ruleId: 'vue/no-restricted-syntax',
    hint: 'text interpolation',
  },
  {
    name: 'an innerHTML key in a v-bind object in a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\nconst html = "";\n</script>\n\n<template>\n  <div v-bind="{ innerHTML: html }" />\n</template>\n',
    ruleId: 'vue/no-restricted-syntax',
    hint: 'text interpolation',
  },
  {
    name: 'an innerHTML key in script setup of a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\nconst html = "";\nconst attrs = { innerHTML: html };\n</script>\n\n<template>\n  <div v-bind="attrs" />\n</template>\n',
    ruleId: 'no-restricted-syntax',
    hint: 'text interpolation',
  },
  {
    name: ':inner-h-t-m-l.camel in a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\nconst html = "";\n</script>\n\n<template>\n  <div :inner-h-t-m-l.camel="html" />\n</template>\n',
    ruleId: 'vue/no-restricted-syntax',
    hint: 'text interpolation',
  },
  {
    name: ':outerHTML in a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\nconst html = "";\n</script>\n\n<template>\n  <div :outerHTML="html" />\n</template>\n',
    ruleId: 'vue/no-restricted-syntax',
    hint: 'text interpolation',
  },
  {
    name: 'an innerHTML assignment in script setup of a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\ndeclare const element: HTMLElement;\nconst html = "";\nelement.innerHTML = html;\n</script>\n\n<template>\n  <div />\n</template>\n',
    ruleId: 'no-restricted-syntax',
    hint: 'text interpolation',
  },
  {
    name: 'insertAdjacentHTML in script setup of a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\ndeclare const element: HTMLElement;\nconst html = "";\nelement.insertAdjacentHTML("beforeend", html);\n</script>\n\n<template>\n  <div />\n</template>\n',
    ruleId: 'no-restricted-syntax',
    hint: 'text interpolation',
  },
  ...[
    [':srcdoc', '<iframe :srcdoc="html" />'],
    [':srcDoc', '<iframe :srcDoc="html" />'],
    [':src-doc.camel', '<iframe :src-doc.camel="html" />'],
  ].map(([name, template]) => ({
    name: `${name} in a documentation component`,
    file: DOCS_SFC,
    code: docsSfc(HTML_DECLARATIONS, template),
    ruleId: 'vue/no-restricted-syntax',
    hint: HTML_HINT,
  })),
  {
    name: 'a dynamic argument of v-bind in a documentation component',
    file: DOCS_SFC,
    code: docsSfc("const name = 'title';\ndeclare const html: string;", '<div :[name]="html" />'),
    ruleId: 'vue/no-restricted-syntax',
    hint: 'name of the attribute',
  },
  ...[
    ['an innerHTML key in quotes', 'const attrs = { "innerHTML": html };'],
    ['an outerHTML key in a template literal', 'const attrs = { [`outerHTML`]: html };'],
    ['a srcdoc key', 'const attrs = { srcdoc: html };'],
    ['a srcDoc key', 'const attrs = { srcDoc: html };'],
  ].map(([name, script]) => ({
    name: `${name} in script setup of a documentation component`,
    file: DOCS_SFC,
    code: docsSfc(`${HTML_DECLARATIONS}\n${script}`, '<div v-bind="attrs" />'),
    ruleId: 'no-restricted-syntax',
    hint: HTML_HINT,
  })),
  ...[
    ['an assignment to a computed innerHTML member', 'element["innerHTML"] = html;'],
    ['an assignment to an innerHTML member in a template literal', 'element[`innerHTML`] = html;'],
    ['an assignment to srcdoc', 'declare const frame: HTMLIFrameElement;\nframe.srcdoc = html;'],
    ['an innerHTML target of a destructuring assignment', '[element.innerHTML] = [html];'],
    ['an innerHTML target with a non-null assertion', 'element.innerHTML! = html;'],
    ['a read of an innerHTML member', 'void element.innerHTML;'],
    ['setAttribute with srcdoc', 'element.setAttribute("srcdoc", html);'],
    ['setAttributeNS with srcdoc', 'element.setAttributeNS(null, "srcdoc", html);'],
    ['setHTML', 'element.setHTML(html);'],
    ['setHTMLUnsafe', 'element.setHTMLUnsafe(html);'],
    ['parseHTML', 'void Document.parseHTML(html);'],
    ['parseHTMLUnsafe', 'void Document.parseHTMLUnsafe(html);'],
    ['createContextualFragment', 'void document.createRange().createContextualFragment(html);'],
    ['parseFromString', 'void new DOMParser().parseFromString(html, "text/html");'],
    ['execCommand', 'document.execCommand("insertHTML", false, html);'],
    ['writeln', 'document.writeln(html);'],
    ['write on document', 'document.write(html);'],
    ['write on an owner document', 'element.ownerDocument.write(html);'],
    [
      'write on the result of ownerDocument',
      'declare function ownerDocument(node: Node): Document;\nownerDocument(element).write(html);',
    ],
  ].map(([name, script]) => ({
    name: `${name} in script setup of a documentation component`,
    file: DOCS_SFC,
    code: docsSfc(`${HTML_DECLARATIONS}\n${script}`),
    ruleId: 'no-restricted-syntax',
    hint: HTML_HINT,
  })),
  ...['createStaticVNode', 'Static'].map((name) => ({
    name: `an import of ${name} in a documentation component`,
    file: DOCS_SFC,
    code: docsSfc(`import { ${name} } from 'vue';\n\nvoid ${name};`),
    ruleId: 'no-restricted-imports',
    hint: HTML_HINT,
  })),
  {
    name: 'an innerHTML key in a module of the documentation components',
    file: DOCS_MODULE,
    code: `${HTML_DECLARATIONS}\nexport const attrs = { innerHTML: html };\n`,
    ruleId: 'no-restricted-syntax',
    hint: HTML_HINT,
  },
  ...[
    ['v-html on an element', '<div v-html="data.text"></div>', 'vue/no-v-html', 'XSS'],
    [
      'v-html in the attributes of a heading',
      '## Title {v-html="data.text"}',
      'vue/no-v-html',
      'XSS',
    ],
    [
      'an innerHTML assignment in a fence that Vue reads',
      '```js-vue\n{{ data.element.innerHTML = data.text }}\n```',
      'vue/no-restricted-syntax',
      HTML_HINT,
    ],
    [
      'an innerHTML assignment in a fence that Vue reads and that has an option',
      '```js-vue{1}\n{{ data.element.innerHTML = data.text }}\n```',
      'vue/no-restricted-syntax',
      HTML_HINT,
    ],
    [
      'an innerHTML assignment in a fence that Vue reads and that has capital letters',
      '```JS-VUE\n{{ data.element.innerHTML = data.text }}\n```',
      'vue/no-restricted-syntax',
      HTML_HINT,
    ],
    [
      'an innerHTML assignment in a fence that Vue reads and whose language starts with a sign',
      '```+js-vue\n{{ data.element.innerHTML = data.text }}\n```',
      'vue/no-restricted-syntax',
      HTML_HINT,
    ],
  ].map(([name, body, ruleId, hint]) => ({
    name: `${name} in a page`,
    file: PAGE,
    code: page(body),
    ruleId,
    hint,
  })),
  {
    name: 'an innerHTML assignment in the script of a page',
    file: PAGE,
    code: `<script setup lang="ts">\n${HTML_DECLARATIONS}\nelement.innerHTML = html;\n</script>\n\n# Sample\n`,
    ruleId: 'no-restricted-syntax',
    hint: HTML_HINT,
  },
  {
    name: 'v-html in a file that a page includes',
    file: 'README.md',
    code: '# Sample\n\n<div v-html="$frontmatter.text"></div>\n',
    ruleId: 'vue/no-v-html',
    hint: 'XSS',
  },
  {
    name: 'a style block in a CSS-module demo',
    file: 'docs/demos/sample/hero/css-modules/index.vue',
    code: '<script setup lang="ts"></script>\n\n<template>\n  <div class="sample" />\n</template>\n\n<style>\n.sample {\n  color: red;\n}\n</style>\n',
    ruleId: 'vue/no-restricted-block',
    hint: 'copied style sheet',
  },
  ...WAIT_FILES.flatMap(([place, file]) => [
    ...[
      'waitFor',
      'waitForElementToBeRemoved',
      'findByRole',
      'findAllByText',
      'screen',
      'within',
      'queries',
      'getQueriesForElement',
    ].map((name) => ({
      name: `an import of ${name} from Testing Library in ${place}`,
      file,
      code: `import { ${name} } from '@testing-library/dom';\n\nexport const used = ${name};\n`,
      ruleId: 'no-restricted-imports',
      hint: WAIT_HINT,
    })),
    ...[
      ['vi.waitFor', "import { vi } from 'vitest';\n\nexport const wait = vi.waitFor(() => 1);\n"],
      [
        'vi.waitUntil',
        "import { vi } from 'vitest';\n\nexport const wait = vi.waitUntil(() => true);\n",
      ],
      [
        'expect.poll',
        "import { expect } from 'vitest';\n\nexport const poll = expect.poll(() => 1);\n",
      ],
      [
        'expect.element',
        "import { expect } from 'vitest';\n\ndeclare const locator: unknown;\nexport const read = expect.element(locator);\n",
      ],
    ].map(([name, code]) => ({
      name: `${name} in ${place}`,
      file,
      code,
      ruleId: 'no-restricted-properties',
      hint: WAIT_HINT,
    })),
  ]),
  {
    name: 'a style block in a Tailwind demo',
    file: 'docs/demos/sample/hero/tailwind/index.vue',
    code: '<script setup lang="ts"></script>\n\n<template>\n  <div class="sample" />\n</template>\n\n<style>\n.sample {\n  color: red;\n}\n</style>\n',
    ruleId: 'vue/no-restricted-block',
    hint: 'class names',
  },
];

const passed = [
  {
    name: 'a DOM global in a test file',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: "export const element = document.createElement('div');\n",
  },
  {
    name: 'a DOM global in a .test.ts file',
    file: `${SRC}/DialogRoot.test.ts`,
    code: "export const element = document.createElement('div');\n",
  },
  {
    name: 'a DOM global in a .spec.ts file',
    file: `${SRC}/DialogRoot.spec.ts`,
    code: "export const element = document.createElement('div');\n",
  },
  {
    name: 'a TSX test file',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: 'export const element = <div />;\n',
  },
  {
    name: 'a read of $el in resolveElement.ts',
    file: 'packages/vue/src/internals/resolveElement.ts',
    code: 'export const read = (instance: { $el: unknown }) => instance.$el;\n',
  },
  {
    name: 'instanceof the class of ownerWindow',
    file: `${SRC}/useRoot.ts`,
    code: 'declare function ownerWindow(element: Element): Window & typeof globalThis;\n\nexport const check = (value: unknown, element: Element) =>\n  value instanceof ownerWindow(element).HTMLElement;\n',
  },
  {
    name: 'an ECMAScript private member and a protected member',
    file: `${SRC}/store.ts`,
    code: 'export class Store {\n  readonly #items: string[] = [];\n\n  protected readonly name = "store";\n\n  get size() {\n    return this.#items.length;\n  }\n}\n',
  },
  {
    name: 'a private field that has the declare keyword',
    file: `${SRC}/handle.ts`,
    code: 'export class Handle {\n  declare private readonly __handleBrand: never;\n}\n',
  },
  {
    name: 'a private member of a declare class',
    file: `${SRC}/itemCollection.ts`,
    code: 'export declare class ItemCollection<Item> {\n  private constructor();\n  private readonly __itemCollectionBrand: (item: Item) => void;\n}\n',
  },
  {
    name: 'defineOptions in script setup',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts">\ndefineOptions({ inheritAttrs: false });\n</script>\n${SCRIPT_ONLY_TEMPLATE}`,
  },
  {
    name: 'a generic part',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script lang="ts">\nexport interface DialogRootProps<Payload = unknown> {\n  payload?: Payload | undefined;\n}\n</script>\n\n<script setup lang="ts" generic="Payload">\ndefineProps<DialogRootProps<Payload>>();\n</script>\n${SCRIPT_ONLY_TEMPLATE}`,
  },
  {
    name: 'any in a source file',
    file: `${SRC}/useRoot.ts`,
    code: 'export const value: any = 1;\n',
  },
  {
    name: 'any in a test file',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: 'export const value: any = 1;\n',
  },
  {
    name: 'an empty object type in a source file',
    file: `${SRC}/useRoot.ts`,
    code: 'export type Empty = {};\n',
  },
  {
    name: 'an unused argument, variable and caught error that start with an underscore',
    file: `${SRC}/useRoot.ts`,
    code: 'export function read(_value: unknown) {\n  const _unused = 1;\n  try {\n    return 1;\n  } catch (_error) {\n    return 2;\n  }\n}\n',
  },
  {
    name: 'an unused sibling of a rest property',
    file: `${SRC}/useRoot.ts`,
    code: 'export const omit = ({ render, ...rest }: { render: unknown; id: string }) => rest;\n',
  },
  {
    name: 'an unused declaration and an expression statement in a spec file',
    file: `${SRC}/DialogRoot.spec.ts`,
    code: 'declare const names: string[];\n\nconst unused = names;\nnames.length;\n',
  },
  {
    name: 'Vue event keys and component event keys in a source file',
    file: `${SRC}/useRoot.ts`,
    code: 'export const props = {\n  onKeydown() {},\n  onClickCapture() {},\n  onFocusin() {},\n  onDblclick() {},\n  onOpenChange() {},\n  onValueChange() {},\n};\n',
  },
  {
    name: 'Vue event props and a component event prop in a TSX test',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: 'export const element = (\n  <button onClickCapture={() => {}} onKeydown={() => {}} onOpenChange={() => {}} />\n);\n',
  },
  {
    name: 'a local function that has a React name',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: "const onKeyDown = () => {};\n\ndocument.addEventListener('keydown', onKeyDown);\n",
  },
  {
    name: 'a scoped style block in a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts"></script>\n\n<template>\n  <div class="sample" />\n</template>\n\n<style scoped>\n.sample {\n  color: red;\n}\n</style>\n',
  },
  {
    name: 'a read of innerHTML through destructuring in a documentation component',
    file: 'docs/.vitepress/components/Sample.vue',
    code: '<script setup lang="ts">\ndeclare const element: HTMLElement;\nconst { innerHTML } = element;\nconst length = innerHTML.length;\n</script>\n\n<template>\n  <div>{{ length }}</div>\n</template>\n',
  },
  {
    name: 'a dynamic argument of an event and of a slot in a documentation component',
    file: DOCS_SFC,
    code: docsSfc(
      "import Frame from './Frame.vue';\n\nconst name = 'click';\nfunction handle() {}",
      '<Frame @[name]="handle"><template #[name]>{{ name }}</template></Frame>',
    ),
  },
  {
    name: 'a bound attribute that has a static name in a documentation component',
    file: DOCS_SFC,
    code: docsSfc('const title = "a";', '<div :title="title" />'),
  },
  {
    name: 'setAttribute with srcdoc as the value in a documentation component',
    file: DOCS_SFC,
    code: docsSfc(`${HTML_DECLARATIONS}\nelement.setAttribute("title", "srcdoc");\nvoid html;`),
  },
  {
    name: 'a write to the clipboard and to a stream in a module of the documentation components',
    file: DOCS_MODULE,
    code: 'declare const stream: { write(text: string): void };\nstream.write("text");\nvoid navigator.clipboard.write([]);\n',
  },
  {
    name: 'text interpolation in a page',
    file: PAGE,
    code: page('Text {{ data.text }} and <span>{{ data.text }}</span>.'),
  },
  {
    name: 'the braces of JSX in a fence of a page',
    file: PAGE,
    code: page(
      '```tsx\n<div style={{ color: "red" }} dangerouslySetInnerHTML={{ __html: html }} />\n```',
    ),
  },
  {
    name: 'a code file that a page shows',
    file: PAGE,
    code: page('<<< ./examples/quick-start/ButtonExample.vue'),
  },
  {
    name: 'a page that has no text',
    file: PAGE,
    code: '---\norder: 1\n---\n',
  },
  {
    name: 'an import of waitFor, screen and within from #test-utils in a test file',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: "import { screen, waitFor, within } from '#test-utils';\n\nexport const used = [screen, waitFor, within];\n",
  },
  {
    name: 'an import of fireEvent, createEvent and isInaccessible from Testing Library in a shared suite',
    file: 'packages/vue/test/popupConformanceTests.tsx',
    code: "import { createEvent, fireEvent, isInaccessible } from '@testing-library/dom';\n\nexport const used = [createEvent, fireEvent, isInaccessible];\n",
  },
  {
    name: 'an import of the queries of Testing Library in test/queries.ts',
    file: 'packages/vue/test/queries.ts',
    code: "import { getQueriesForElement, queries } from '@testing-library/dom';\n\nexport const used = [getQueriesForElement, queries];\n",
  },
  {
    name: 'expect.poll in a test of the Nuxt fixture',
    file: 'fixtures/nuxt/test/pages.test.ts',
    code: "import { expect } from 'vitest';\n\nexport const poll = expect.poll(() => 1);\n",
  },
];

for (const { name, file, code, ruleId, hint } of reported) {
  test(`reports ${name}`, async () => {
    const messages = await lint(file, code);
    const message = messages.find((candidate) => candidate.ruleId === ruleId);
    assert.ok(message, `Expected ${ruleId}. Got ${JSON.stringify(messages)}.`);
    assert.ok(message.message.includes(hint), `Message "${message.message}" lacks "${hint}".`);
  });
}

for (const { name, file, code } of passed) {
  test(`accepts ${name}`, async () => {
    assert.deepEqual(await lint(file, code), []);
  });
}

test('does not lint a file that has a test name and is not a script', async () => {
  assert.equal(await eslint.calculateConfigForFile('packages/vue/tsconfig.test.json'), undefined);
});

test('reports a form of a page at the line of the form', async () => {
  for (const [body, column] of [
    ['<div v-html="data.text"></div>', 6],
    ['## Title {v-html="data.text"}', 11],
  ]) {
    const [{ messages }] = await eslint.lintText(page(body), { filePath: PAGE });
    assert.deepEqual(
      messages
        .filter(({ ruleId }) => ruleId === 'vue/no-v-html')
        .map(({ line, column, endLine, endColumn }) => ({ line, column, endLine, endColumn })),
      [{ line: 13, column, endLine: undefined, endColumn: undefined }],
      body,
    );
  }
});

test('reports a form that the page does not hold at line 1', async () => {
  // `v-html` on a heading replaces the link that VitePress adds to the heading. The page has no
  // text for the report of `vue/no-child-content` about that link.
  const [{ messages }] = await eslint.lintText(page('## Title {v-html="data.text"}'), {
    filePath: PAGE,
  });
  const { line, column } = messages.find(({ ruleId }) => ruleId === 'vue/no-child-content');
  assert.deepEqual({ line, column }, { line: 1, column: 1 });
});

test('does not write a fix into a page', async () => {
  const fixer = new ESLint({ cwd: ROOT, fix: true });
  const code = `<script setup lang="ts">\nimport { type Ref } from 'vue';\n\ndeclare const value: Ref<string>;\n</script>\n\n# Sample\n\n{{ value }}\n`;
  const [{ output, messages }] = await fixer.lintText(code, { filePath: PAGE });
  assert.equal(output, undefined);
  assert.ok(
    messages.some(({ ruleId }) => ruleId === '@typescript-eslint/no-import-type-side-effects'),
  );
});

test('reads each file that a page includes', async () => {
  const files = globSync('docs/**/*.md', { cwd: ROOT, exclude: ['**/node_modules/**'] });
  const included = new Set();
  // An included file can include a file too, so the loop also reads each file that it adds.
  for (const file of files) {
    for (const [, include] of readFileSync(join(ROOT, file), 'utf8').matchAll(INCLUDE)) {
      const path = includedFile(file, include);
      if (!included.has(path)) {
        included.add(path);
        files.push(path);
      }
    }
  }
  assert.notEqual(included.size, 0);
  for (const file of included) {
    const messages = await lint(file, '<div v-html="$frontmatter.text"></div>\n');
    assert.deepEqual(
      messages.map(({ ruleId }) => ruleId),
      ['vue/no-v-html'],
      file,
    );
  }
});
