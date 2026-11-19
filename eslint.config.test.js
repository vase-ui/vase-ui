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
const PORTAL_PART = 'packages/vue/src/popover/portal/PopoverPortal.vue';

const SCRIPT_ONLY_TEMPLATE = '\n<template>\n  <div />\n</template>\n';

const WAIT_HINT = '#test-utils';
const ABSENCE_HINT = 'before the element appears';
const WAIT_IMPORT =
  "import { expect } from 'vitest';\nimport { screen, waitFor, within } from '#test-utils';\n\n";
const WAIT_FILES = [
  ['a test file', `${SRC}/DialogRoot.test.tsx`],
  ['a shared suite', 'packages/vue/test/popupConformanceTests.tsx'],
];
const VNODE_HINT = 'mounts a vnode one time';
const VNODE_IMPORT = "import { describe, it } from 'vitest';\n\n";
const REF_HINT = 'before the element is in the document';
const RENDER_SLOT_HINT = 'usesRenderSlot()';
const RENDER_SLOT_REST = 'name="render" :props="elementProps()" :state="state" />';
const MODEL_PART = docsSfc("const open = defineModel<boolean>('open');", '<div>{{ open }}</div>');

const INPUT_SYNC_SAMPLES = [
  ['a native input write', '(event.target as HTMLInputElement).value = text;', 'Vue value binding'],
  [
    'a native textarea write',
    '(event.target as HTMLTextAreaElement).value = text;',
    'Vue value binding',
  ],
  [
    'a handled input value',
    'const handledHiddenValue = input.value; read(handledHiddenValue);',
    'second copy',
  ],
  ['a handled input text', 'const handledText = input.value; read(handledText);', 'second copy'],
];

const reported = [
  ...INPUT_SYNC_SAMPLES.map(([name, code, hint]) => ({
    name,
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc(code),
    ruleId: 'no-restricted-syntax',
    hint,
  })),
  ...[
    ['an optional release', 'let release: (() => void) | undefined;'],
    ['a void release', 'let release: (() => void) | void;'],
    ['a typed NOOP', 'let stop: () => void = NOOP;'],
    ['an inferred NOOP', 'let stop = NOOP;'],
    ['a release in a function', 'function listen() { let stop: () => void = start(); }'],
  ].map(([name, code]) => ({
    name,
    file: `${SRC}/useSample.ts`,
    code,
    ruleId: 'no-restricted-syntax',
    hint: 'onCleanup',
  })),
  {
    name: 'a release in a part',
    file: `${SRC}/Sample.vue`,
    code: docsSfc('let stop: (() => void) | null = null;'),
    ruleId: 'no-restricted-syntax',
    hint: 'onCleanup',
  },
  {
    name: 'a copy of the held state',
    file: `${SRC}/useSample.ts`,
    code: 'let held = isHeld.value;',
    ruleId: 'no-restricted-syntax',
    hint: 'as a source',
  },
  {
    name: 'a copy of the held state with a string key',
    file: `${SRC}/useSample.ts`,
    code: "let held = isHeld['value'];",
    ruleId: 'no-restricted-syntax',
    hint: 'as a source',
  },
  {
    name: 'a direct popup element write in a part',
    file: `${SRC}/DialogPopup.vue`,
    code: docsSfc("store.set('popupElement', element);"),
    ruleId: 'no-restricted-syntax',
    hint: 'createElementSetter',
  },
  {
    name: 'a direct list element write in a composable',
    file: `${SRC}/useList.ts`,
    code: "store.set('listElement', element);",
    ruleId: 'no-restricted-syntax',
    hint: 'createElementSetter',
  },
  {
    name: 'conditional part forms inside template v-if',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc(
      '',
      '<template v-if="shown"><slot v-if="usesRenderSlot()" name="render" :props="elementProps()" /><component :is="as" v-else v-bind="elementProps()" :ref="setRef" /></template>',
    ),
    ruleId: 'vue/no-restricted-syntax',
    hint: 'fragment',
  },
  {
    name: 'conditional part forms inside template v-else',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc(
      '',
      '<div v-if="other" /><template v-else><slot v-if="usesRenderSlot()" name="render" :props="elementProps()" /><component :is="as" v-else v-bind="elementProps()" :ref="setRef" /></template>',
    ),
    ruleId: 'vue/no-restricted-syntax',
    hint: 'fragment',
  },
  ...[
    ['a #render slot with $slots.render', `<slot v-if="$slots.render" ${RENDER_SLOT_REST}`],
    [
      'a #render slot with a condition and $slots.render',
      `<slot v-if="shouldRender && $slots.render" ${RENDER_SLOT_REST}`,
    ],
    [
      'a #render slot with a condition after usesRenderSlot()',
      `<slot v-if="usesRenderSlot() && shouldRender" ${RENDER_SLOT_REST}`,
    ],
    [
      'a #render slot with || after usesRenderSlot()',
      `<slot v-if="usesRenderSlot() || other" ${RENDER_SLOT_REST}`,
    ],
    [
      'a #render slot with usesRenderSlot and no call',
      `<slot v-if="$slots.render && usesRenderSlot" ${RENDER_SLOT_REST}`,
    ],
    ['a #render slot with elementProps() and no condition', `<slot ${RENDER_SLOT_REST}`],
    [
      'a #render slot in a template with $slots.render',
      `<template v-if="$slots.render"><Style /><slot ${RENDER_SLOT_REST}</template>`,
    ],
    [
      'a #render slot in a div inside a template with usesRenderSlot()',
      `<template v-if="usesRenderSlot()"><div><slot ${RENDER_SLOT_REST}</div></template>`,
    ],
    [
      'a #render slot with no condition in a Teleport with usesRenderSlot()',
      `<Teleport v-if="usesRenderSlot()" to="body"><slot ${RENDER_SLOT_REST}</Teleport>`,
    ],
    [
      'a #render slot with v-show="usesRenderSlot()"',
      `<slot v-show="usesRenderSlot()" ${RENDER_SLOT_REST}`,
    ],
    [
      'a #render slot with elementProps() in mergeProps and no usesRenderSlot()',
      '<slot v-if="shown" name="render" :props="mergeProps(elementProps(), other)" :state="state" />',
    ],
  ].map(([name, template]) => ({
    name,
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', template),
    ruleId: 'vue/no-restricted-syntax',
    hint: RENDER_SLOT_HINT,
  })),
  {
    name: 'a spread of elementProps() with no ref by name',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<component :is="as" v-bind="elementProps()"><slot /></component>'),
    ruleId: 'vue/no-restricted-syntax',
    hint: 'by name',
  },
  {
    name: 'a spread of elementProps() in a merge with no ref by name',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<div v-bind="mergeProps(elementProps(), { id })" />'),
    ruleId: 'vue/no-restricted-syntax',
    hint: 'by name',
  },
  {
    name: 'a spread of elementProps() beside a static ref',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<div ref="element" v-bind="elementProps()" />'),
    ruleId: 'vue/no-restricted-syntax',
    hint: 'by name',
  },
  {
    name: 'a spread on an input with no ref by name',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<input v-bind="inputProps()" />'),
    ruleId: 'vue/no-restricted-syntax',
    hint: 'Give the input a named ref',
  },
  {
    name: 'a spread on an input with an empty ref name',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<input v-bind="inputProps()" ref="" />'),
    ruleId: 'vue/no-restricted-syntax',
    hint: 'Give the input a named ref',
  },
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
  ...WAIT_FILES.flatMap(([place, file]) =>
    [
      [
        'a queryBy query of screen for an absence',
        "await waitFor(() => {\n  expect(screen.queryByRole('dialog')).toBe(null);\n});\n",
      ],
      [
        'a queryBy query of screen for a presence',
        "await waitFor(() => {\n  expect(screen.queryByRole('dialog')).not.toBe(null);\n});\n",
      ],
      [
        'a queryAllBy query of within',
        "await waitFor(() => expect(within(document.body).queryAllByRole('option')).toHaveLength(0));\n",
      ],
      [
        'a queryBy query of the result of render',
        "declare const queryByText: (text: string) => HTMLElement | null;\nawait waitFor(() => {\n  expect(queryByText('Open')).toBe(null);\n});\n",
      ],
    ].map(([name, code]) => ({
      name: `${name} in waitFor in ${place}`,
      file,
      code: `${WAIT_IMPORT}${code}`,
      ruleId: 'no-restricted-syntax',
      hint: ABSENCE_HINT,
    })),
  ),
  ...[
    [
      'a vnode in a row of it.each in a test file',
      `${SRC}/DialogRoot.test.tsx`,
      "it.each([{ name: 'a button', node: <button /> }])('renders $name', () => {});\n",
    ],
    [
      'a fragment in a row of it.each in a test file',
      `${SRC}/DialogRoot.test.tsx`,
      "it.each([{ name: 'a text', node: <>Open</> }])('renders $name', () => {});\n",
    ],
    [
      'a vnode in a row of describe.each in a test file',
      `${SRC}/DialogRoot.test.tsx`,
      "describe.each([['a button', <button />]])('%s', () => {});\n",
    ],
    [
      'a vnode in a row of it.skipIf().each in a test file',
      `${SRC}/DialogRoot.test.tsx`,
      "it.skipIf(false).each([{ name: 'a list', nodes: [<li key=\"a\" />] }])('renders $name', () => {});\n",
    ],
    [
      'a vnode of h in a row of it.for in a .test.ts file',
      `${SRC}/DialogRoot.test.ts`,
      "declare function h(type: string): unknown;\nit.for([{ name: 'a button', node: h('button') }])('renders $name', () => {});\n",
    ],
    [
      'a vnode in a constant of the module in a test file',
      `${SRC}/DialogRoot.test.tsx`,
      "const popup = <div />;\n\nit('renders', () => {\n  void popup;\n});\n",
    ],
    [
      'a vnode in a constant of a describe in a test file',
      `${SRC}/DialogRoot.test.tsx`,
      "describe('a root', () => {\n  const popup = <div />;\n\n  it('renders', () => {\n    void popup;\n  });\n});\n",
    ],
    [
      'a vnode in a constant of a describe.skipIf in a test file',
      `${SRC}/DialogRoot.test.tsx`,
      "describe.skipIf(false)('a root', () => {\n  const popup = <div />;\n\n  it('renders', () => {\n    void popup;\n  });\n});\n",
    ],
    [
      'a vnode in a row of it.each in a shared suite',
      'packages/vue/test/popupConformanceTests.tsx',
      "it.each([{ name: 'a button', node: <button /> }])('renders $name', () => {});\n",
    ],
  ].map(([name, file, code]) => ({
    name,
    file,
    code: `${VNODE_IMPORT}${code}`,
    ruleId: 'no-restricted-syntax',
    hint: VNODE_HINT,
  })),
  ...[
    [
      'a Base UI package',
      "import { ownerDocument } from '@base-ui/utils/owner';\n\nexport const owner = ownerDocument;\n",
      'does not depend on Base UI',
    ],
    [
      'a type of a Base UI package',
      "import type { Dialog } from '@base-ui/react/dialog';\n\nexport type Root = typeof Dialog;\n",
      'does not depend on Base UI',
    ],
    [
      'the common folder through the name of the package',
      "import { ownerDocument } from '@vase-ui/vue/common/owner';\n\nexport const owner = ownerDocument;\n",
      'not an entry point',
    ],
    [
      'the common folder with no file',
      "import { ownerDocument } from '@vase-ui/vue/common';\n\nexport const owner = ownerDocument;\n",
      'not an entry point',
    ],
    [
      'a prehydration script through its subpath',
      "import { script } from '#prehydration/tabs';\n\nexport const text = script;\n",
      './prehydrationScript.min',
    ],
    [
      'useFloating',
      "import { useFloating } from '@floating-ui/vue';\n\nexport const position = useFloating;\n",
      'usePopupPositioner',
    ],
    [
      'onActivated',
      "import { onActivated } from 'vue';\n\nexport const hook = onActivated;\n",
      'useKeepAliveState',
    ],
    [
      'onDeactivated',
      "import { onDeactivated } from 'vue';\n\nexport const hook = onDeactivated;\n",
      'useKeepAliveState',
    ],
    [
      'Transition',
      "import { Transition } from 'vue';\n\nexport const component = Transition;\n",
      'data-starting-style',
    ],
    [
      'TransitionGroup',
      "import { TransitionGroup } from 'vue';\n\nexport const component = TransitionGroup;\n",
      'data-starting-style',
    ],
  ].map(([name, code, hint]) => ({
    name: `an import of ${name}`,
    file: `${SRC}/useRoot.ts`,
    code,
    ruleId: 'no-restricted-imports',
    hint,
  })),
  ...['onActivated', 'onDeactivated'].flatMap((hook) => [
    {
      name: `an import of ${hook} in an SFC`,
      file: `${SRC}/DialogRoot.vue`,
      code: `<script setup lang="ts">\nimport { ${hook} } from 'vue';\n${hook}(() => {});\n</script>\n<template><div /></template>\n`,
      ruleId: 'no-restricted-imports',
      hint: 'useKeepAliveState',
    },
    {
      name: `an import of ${hook} in useAnchorPositioning.ts`,
      file: 'packages/vue/src/internals/useAnchorPositioning.ts',
      code: `import { ${hook} } from 'vue';\nexport const hook = ${hook};\n`,
      ruleId: 'no-restricted-imports',
      hint: 'useKeepAliveState',
    },
  ]),
  {
    name: 'an import of getCurrentInstance in useAnchorPositioning.ts',
    file: 'packages/vue/src/internals/useAnchorPositioning.ts',
    code: "import { getCurrentInstance } from 'vue';\n\nexport const instance = getCurrentInstance();\n",
    ruleId: 'no-restricted-imports',
    hint: 'provide',
  },
  {
    name: 'an import of a prehydration script through its subpath in useAnchorPositioning.ts',
    file: 'packages/vue/src/internals/useAnchorPositioning.ts',
    code: "import { script } from '#prehydration/tabs';\n\nexport const text = script;\n",
    ruleId: 'no-restricted-imports',
    hint: './prehydrationScript.min',
  },
  ...['Transition', 'transition', 'TransitionGroup', 'transition-group'].map((tag) => ({
    name: `the element ${tag} in a template`,
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts"></script>\n\n<template>\n  <${tag}><div /></${tag}>\n</template>\n`,
    ruleId: 'vue/no-restricted-syntax',
    hint: 'data-starting-style',
  })),
  {
    name: 'defineModel',
    file: `${SRC}/DialogRoot.vue`,
    code: MODEL_PART,
    ruleId: 'no-restricted-syntax',
    hint: 'with only the prop',
  },
  ...[
    ['an empty template', '<template />'],
    ['setup with no template or renderer', '<script setup lang="ts">useSubscription();</script>'],
    [
      'a null render in script setup options',
      '<script setup lang="ts">defineOptions({ render: () => null });</script>',
    ],
    [
      'setup with only type exports and no template',
      '<script lang="ts">export interface PartProps { open: boolean }</script>\n<script setup lang="ts">defineProps<PartProps>();</script>',
    ],
    [
      'script setup whose render option is hidden by inline compilation',
      '<script setup lang="ts">defineOptions({ render: () => h("span") });</script>',
    ],
    ['a null SFC function', '<script lang="ts">export default () => null;</script>'],
    ['a template with only a comment', '<template>\n  <!-- No content -->\n</template>'],
  ].map(([name, code]) => ({
    name,
    file: `${SRC}/DialogRoot.vue`,
    code,
    ruleId: 'vase-ui/no-empty-part',
    hint: 'composable',
  })),
  ...[
    ['a null render method', 'export default defineComponent({ render() { return null; } });'],
    [
      'a quoted null render method',
      "export default defineComponent({ 'render'() { return null; } });",
    ],
    ['a null render from setup', 'export default defineComponent({ setup: () => () => null });'],
    [
      'a render with two null returns',
      'export default defineComponent(() => () => { if (ready()) return null; record(); return null; });',
    ],
    ['a null functional component', 'export const Content: FunctionalComponent = () => null;'],
    [
      'a null render with a TypeScript annotation',
      'export const Content = (() => null as VNode | null) satisfies FunctionalComponent;',
    ],
    [
      'a named null renderer returned by setup',
      'export default defineComponent({ setup() { return render; } }); function render() { return null; }',
    ],
    [
      'a choice between two null renderers',
      'const empty = () => null; export default defineComponent(() => ready() ? empty : () => null);',
    ],
    [
      'a null render beside setup bindings',
      'export default defineComponent({ setup: () => ({}), render: () => null });',
    ],
  ].map(([name, code]) => ({
    name,
    file: `${SRC}/DialogContent.ts`,
    code,
    ruleId: 'vase-ui/no-empty-part',
    hint: 'composable',
  })),
  ...[
    [
      'Map.groupBy',
      'export const groups = (items: number[]) => Map.groupBy(items, (item) => item % 2);\n',
      'Group the items',
    ],
    [
      'Object.groupBy',
      'export const groups = (items: number[]) => Object.groupBy(items, (item) => item % 2);\n',
      'Group the items',
    ],
    [
      'Promise.withResolvers',
      'export const deferred = Promise.withResolvers<void>();\n',
      'new Promise',
    ],
    ['Symbol.dispose', 'export const resource = { [Symbol.dispose]() {} };\n', 'finally'],
    [
      'Symbol.asyncDispose',
      'export const resource = { async [Symbol.asyncDispose]() {} };\n',
      'finally',
    ],
    [
      'toLocaleString',
      'export const text = (value: number) => value.toLocaleString();\n',
      'formatter()',
    ],
  ].map(([name, code, hint]) => ({
    name: `a read of ${name}`,
    file: `${SRC}/useRoot.ts`,
    code,
    ruleId: 'no-restricted-properties',
    hint,
  })),
  ...[
    ['Object.groupBy', 'Object.groupBy(items, (item) => item % 2)', 'Group the items'],
    ['Symbol.dispose', 'items[Symbol.dispose]', 'finally'],
    ['Symbol.asyncDispose', 'items[Symbol.asyncDispose]', 'finally'],
    ['toLocaleString', 'items.length.toLocaleString()', 'formatter()'],
  ].map(([name, expression, hint]) => ({
    name: `a read of ${name} in a template`,
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts">\nconst items = [2, 1];\n</script>\n\n<template>\n  <div>{{ ${expression} }}</div>\n</template>\n`,
    ruleId: 'vue/no-restricted-syntax',
    hint,
  })),
  ...[
    [
      'a using declaration',
      'export function read(open: () => Disposable) {\n  using resource = open();\n  return resource;\n}\n',
      'finally',
    ],
    [
      'an await using declaration',
      'export async function read(open: () => AsyncDisposable) {\n  await using resource = open();\n  return resource;\n}\n',
      'finally',
    ],
    [
      'instanceof a Temporal class',
      'export const check = (value: unknown) => value instanceof Temporal.PlainDate;\n',
      'kindOf',
    ],
    [
      'instanceof a Temporal class through globalThis',
      'export const check = (value: unknown) => value instanceof globalThis.Temporal.PlainDate;\n',
      'kindOf',
    ],
    [
      'a style key that has the Webkit prefix',
      "export const style = { WebkitUserSelect: 'none' };\n",
      '-webkit-user-select',
    ],
    [
      'a style key in quotes that has the Moz prefix',
      "export const style = { 'MozUserSelect': 'none' };\n",
      '-webkit-user-select',
    ],
    [
      'a style key that has the ms prefix',
      "export const style = { msOverflowStyle: 'none' };\n",
      '-webkit-user-select',
    ],
    [
      'a style key that has the webkit prefix in lower case',
      "export const style = { webkitUserSelect: 'none' };\n",
      '-webkit-user-select',
    ],
    [
      'a style key in quotes that has the moz prefix in lower case',
      "export const style = { 'mozUserSelect': 'none' };\n",
      '-webkit-user-select',
    ],
    [
      'a write to a style member that has the Webkit prefix',
      "declare const style: Record<string, string>;\nstyle.WebkitUserSelect = 'none';\n",
      'setProperty',
    ],
    [
      'a write to a style member in brackets that has the webkit prefix in lower case',
      "declare const style: Record<string, string>;\nstyle['webkitUserSelect'] = 'none';\n",
      'setProperty',
    ],
    [
      'an attribute name of Base UI',
      "export const INERT = 'data-base-ui-inert';\n",
      'share a marker',
    ],
    [
      'an attribute name of Base UI with capitals',
      "export const INERT = 'data-Base-UI-inert';\n",
      'share a marker',
    ],
    [
      'an attribute name of Base UI in a template literal',
      'export const attribute = (name: string) => `data-base-ui-${name}`;\n',
      'share a marker',
    ],
    ['an event name of Base UI', "export const event = new Event('base-ui');\n", 'share a marker'],
  ].map(([name, code, hint]) => ({
    name,
    file: `${SRC}/useRoot.ts`,
    code,
    ruleId: 'no-restricted-syntax',
    hint,
  })),
  ...[
    [
      'a style key that has the Webkit prefix',
      `<div :style="{ WebkitUserSelect: 'none' }" />`,
      '-webkit-user-select',
    ],
    [
      'a write to a style member that has the Webkit prefix',
      `<button @click="style.WebkitUserSelect = 'none'" />`,
      'setProperty',
    ],
    ['an attribute name of Base UI', '<div data-base-ui-inert="" />', 'share a marker'],
    ['a bound attribute name of Base UI', `<div :data-base-ui-inert="''" />`, 'share a marker'],
    ['a class of Base UI', '<div class="base-ui-disable-scrollbar" />', 'share a marker'],
    [
      'an attribute name of Base UI in an expression',
      `<div v-bind="{ 'data-base-ui-inert': '' }" />`,
      'share a marker',
    ],
  ].map(([name, template, hint]) => ({
    name: `${name} in a template`,
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts"></script>\n\n<template>\n  ${template}\n</template>\n`,
    ruleId: 'vue/no-restricted-syntax',
    hint,
  })),
  ...[
    ['a focus call in a function ref of JSX', '<input ref={(element) => element?.focus()} />'],
    ['a click call in a function ref of JSX', '<input ref={(element) => element?.click()} />'],
    [
      'a select call in a block function ref of JSX',
      '<input\n  ref={(element) => {\n    if (element) {\n      element.select();\n    }\n  }}\n/>',
    ],
    ['a blur call in a function ref of JSX', '<input ref={(element) => element?.blur()} />'],
    [
      'a focus call with options in a function ref of JSX',
      '<input ref={(element) => element?.focus({ preventScroll: true })} />',
    ],
    [
      'a focus call in the ref key of h',
      "h('input', { ref: (element) => (element as HTMLInputElement | null)?.focus() })",
    ],
  ].flatMap(([name, code]) =>
    [
      ['a test file', `${SRC}/DialogRoot.test.tsx`],
      ['a shared suite', 'packages/vue/test/popupConformanceTests.tsx'],
    ].map(([place, file]) => ({
      name: `${name} in ${place}`,
      file,
      code: `import { h } from 'vue';\n\nexport const node = () => ${code};\n`,
      ruleId: 'no-restricted-syntax',
      hint: REF_HINT,
    })),
  ),
  {
    name: 'a focus call in a function ref of a bound ref in a test SFC',
    file: `${SRC}/DialogRootInTemplate.test.vue`,
    code: docsSfc(
      '',
      '<input :ref="(element) => (element as HTMLInputElement | null)?.focus()" />',
    ),
    ruleId: 'vue/no-restricted-syntax',
    hint: REF_HINT,
  },
  {
    name: 'a style block in a Tailwind demo',
    file: 'docs/demos/sample/hero/tailwind/index.vue',
    code: '<script setup lang="ts"></script>\n\n<template>\n  <div class="sample" />\n</template>\n\n<style>\n.sample {\n  color: red;\n}\n</style>\n',
    ruleId: 'vue/no-restricted-block',
    hint: 'class names',
  },
  {
    name: 'an if statement that sets a name when it is null or undefined',
    file: `${SRC}/useRoot.ts`,
    code: 'let cache: string | undefined;\n\nexport function read(make: () => string) {\n  if (cache == null) {\n    cache = make();\n  }\n  return cache;\n}\n',
    ruleId: 'logical-assignment-operators',
    hint: '??=',
  },
  {
    name: 'an if statement that sets a name when it is null or undefined in an SFC',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts">\nlet cache: string | undefined;\n\nfunction read(make: () => string) {\n  if (cache == null) {\n    cache = make();\n  }\n  return cache;\n}\nvoid read;\n</script>\n${SCRIPT_ONLY_TEMPLATE}`,
    ruleId: 'logical-assignment-operators',
    hint: '??=',
  },
  {
    name: 'an if statement that clears a member when it is set',
    file: `${SRC}/useRoot.ts`,
    code: 'export function close(state: { open: boolean }) {\n  if (state.open) {\n    state.open = false;\n  }\n}\n',
    ruleId: 'logical-assignment-operators',
    hint: '&&=',
  },
];

const passed = [
  {
    name: 'a post effect that owns an observer',
    file: `${SRC}/useSize.ts`,
    code: `import { watchPostEffect } from 'vue';
import type { Ref } from 'vue';
export function useSize(element: Readonly<Ref<Element | null>>, resize: ResizeObserverCallback) {
  watchPostEffect((onCleanup) => {
    if (!element.value) return;
    const observer = new ResizeObserver(resize);
    observer.observe(element.value);
    onCleanup(() => observer.disconnect());
  });
}`,
  },
  {
    name: 'defineModel in a demo',
    file: 'docs/demos/dialog/basic/tailwind/Demo.vue',
    code: MODEL_PART,
  },
  {
    name: 'a template that renders a nonbreaking space',
    file: `${SRC}/DialogContent.vue`,
    code: '<template>&nbsp;</template>',
  },
  {
    name: 'a compiled template that supplies the render option',
    file: `${SRC}/DialogContent.vue`,
    code: docsSfc('defineOptions({ render: () => null });'),
  },
  {
    name: 'a renderer supplied by the SFC default export',
    file: `${SRC}/DialogContent.vue`,
    code: '<script lang="ts">export { default } from "./Root.vue";</script>',
  },
  {
    name: 'component options changed before use',
    file: `${SRC}/DialogContent.ts`,
    code: "const options = { render: () => null }; options.render = () => h('span'); export default defineComponent(options);",
  },
  {
    name: 'a null renderer replaced by setup',
    file: `${SRC}/DialogContent.ts`,
    code: "export default defineComponent({ render: () => null, setup: () => () => h('span') });",
  },
  {
    name: 'a setup that can fall through to a visible render option',
    file: `${SRC}/DialogContent.ts`,
    code: `export default defineComponent({
  setup() { if (hidden()) return () => null; },
  render: () => h('span'),
});`,
  },
  {
    name: 'component options with a later spread',
    file: `${SRC}/DialogContent.ts`,
    code: 'export default defineComponent({ render: () => null, ...options });',
  },
  {
    name: 'a template with a conditional node',
    file: `${SRC}/DialogContent.vue`,
    code: docsSfc('const { open } = defineProps<{ open: boolean }>();', '<div v-if="open" />'),
  },
  {
    name: 'an external template',
    file: `${SRC}/DialogContent.vue`,
    code: '<template src="./content.html" />',
  },
  {
    name: 'a render that can return a node',
    file: `${SRC}/DialogContent.ts`,
    code: `export const Content = defineComponent({
  setup() {
    return () => {
      if (ready()) return null;
      return h('span', { onClick: () => null });
    };
  },
});`,
  },
  {
    name: 'a computed method beside a visible renderer',
    file: `${SRC}/DialogContent.ts`,
    code: `const render = 'placeholder';
export default defineComponent({ [render]() { return null; }, render: () => h('span') });`,
  },
  {
    name: 'a setup that can return a visible renderer',
    file: `${SRC}/DialogContent.ts`,
    code: `export default defineComponent(() => {
  if (ready()) return () => null;
  return () => h('span');
});`,
  },
  {
    name: 'a getter that always returns null',
    file: `${SRC}/useContent.ts`,
    code: 'export function useContent() { return () => null; }',
  },
  ...INPUT_SYNC_SAMPLES.map(([name, code]) => ({
    name: `${name} in a test`,
    file: `${SRC}/DialogRoot.test.tsx`,
    code,
  })),
  ...[
    ['a constant release', 'export const release: () => void = start();'],
    ['a function with a result', 'export let read: (() => string) | null = null;\nread = getText;'],
    [
      'an array of callbacks',
      'export let callbacks: (() => void)[] | null = null;\ncallbacks = [];',
    ],
    [
      'a value other than the held state',
      'export let latestValues = values.value;\nlatestValues = [];',
    ],
    ['a dynamic key on the held ref', 'export let entry = isHeld[value];\nentry = next;'],
  ].map(([name, code]) => ({ name, file: `${SRC}/useSample.ts`, code: `${code}\n` })),
  {
    name: 'a release in a test',
    file: `${SRC}/useSample.test.ts`,
    code: 'export let release: (() => void) | undefined;\n',
  },
  {
    name: 'a popup element write in the shared setter',
    file: 'packages/vue/src/utils/popups/createElementSetter.ts',
    code: "store.set('popupElement', element);",
  },
  {
    name: 'a different store key and a list element in a map',
    file: `${SRC}/useList.ts`,
    code: "store.set('listElementId', id); map.set('listElement', element);",
  },
  {
    name: 'a root node read at the event',
    file: `${SRC}/useRoot.ts`,
    code: "declare const element: Element;\n\nelement.addEventListener('click', () => element.getRootNode());\n",
  },
  {
    name: 'filtered attributes on a portal part',
    file: PORTAL_PART,
    code: docsSfc('', '<PopupPortal v-bind="{ ...withoutPropsOf($attrs, PopupPortal), as }" />'),
  },
  {
    name: 'filtered attributes on the input part',
    file: 'packages/vue/src/input/Input.vue',
    code: docsSfc(
      '',
      '<FieldControl v-bind="{ ...withoutPropsOf($attrs, FieldControl), ...props }" />',
    ),
  },
  {
    name: 'filtered attributes in the props of a picker field',
    file: 'packages/vue/src/date-picker/field/DatePickerField.vue',
    code: docsSfc(
      '',
      '<DateFieldRoot v-bind="fieldProps(withoutPropsOf($attrs, DateFieldRoot))" />',
    ),
  },
  {
    name: 'unfiltered attributes on a native backdrop element',
    file: 'packages/vue/src/utils/popups/InternalBackdrop.vue',
    code: docsSfc('', '<div v-bind="{ ...$attrs, style }" />'),
  },
  {
    name: 'conditional part forms at the root',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc(
      '',
      '<slot v-if="shown && usesRenderSlot()" name="render" :props="elementProps()" /><component :is="as" v-else-if="shown" v-bind="elementProps()" :ref="setRef" />',
    ),
  },
  {
    name: 'conditional part forms with a style before the render slot',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc(
      '',
      '<template v-if="usesRenderSlot()"><Style /><slot name="render" :props="elementProps()" /></template><component :is="as" v-else v-bind="elementProps()" :ref="setRef" />',
    ),
  },
  {
    name: 'conditional part forms inside a Teleport',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc(
      '',
      '<Teleport v-if="shown" to="body"><slot v-if="usesRenderSlot()" name="render" :props="elementProps()" /><component :is="as" v-else v-bind="elementProps()" :ref="setRef" /></Teleport>',
    ),
  },
  {
    name: 'conditional part forms inside a template in a test SFC',
    file: `${SRC}/DialogPart.test.vue`,
    code: docsSfc(
      '',
      '<template v-if="shown"><slot v-if="$slots.render" name="render" :props="elementProps()" /><component :is="as" v-else v-bind="elementProps()" :ref="setRef" /></template>',
    ),
  },
  {
    name: 'a spread of elementProps() with the ref by name',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc(
      '',
      '<component :is="as" v-bind="elementProps()" :ref="setRef"><slot /></component>',
    ),
  },
  {
    name: 'elementProps() as the props of the #render slot',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<slot v-if="usesRenderSlot()" name="render" :props="elementProps()" />'),
  },
  ...[
    [
      'a #render slot with (keepMounted || mounted) && usesRenderSlot()',
      `<slot v-if="(keepMounted || mounted) && usesRenderSlot()" ${RENDER_SLOT_REST}`,
    ],
    [
      'a #render slot with two && conditions and usesRenderSlot()',
      `<slot v-if="a && b && usesRenderSlot()" ${RENDER_SLOT_REST}`,
    ],
    [
      'a #render slot with v-else-if="usesRenderSlot()"',
      `<div v-if="other" /><slot v-else-if="usesRenderSlot()" ${RENDER_SLOT_REST}`,
    ],
    [
      'a #render slot in a template with value != null && usesRenderSlot()',
      `<template v-if="value != null && usesRenderSlot()"><slot ${RENDER_SLOT_REST}<Style /></template>`,
    ],
    [
      'a #render slot with empty props and $slots.render',
      '<slot v-if="$slots.render" name="render" :props="{} as HTMLProps" :state="state" />',
    ],
    [
      'a #render slot forwarded with v-bind="slotProps"',
      '<Part><template #render="slotProps"><slot name="render" v-bind="slotProps" /></template></Part>',
    ],
  ].map(([name, template]) => ({
    name,
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', template),
  })),
  {
    name: 'a #render slot with $slots.render and elementProps() in a test SFC',
    file: `${SRC}/DialogPart.test.vue`,
    code: docsSfc('', `<slot v-if="$slots.render" ${RENDER_SLOT_REST}`),
  },
  {
    name: 'a spread of elementProps() with no ref by name in a test SFC',
    file: `${SRC}/DialogPart.test.vue`,
    code: docsSfc('', '<component :is="as" v-bind="elementProps()"><slot /></component>'),
  },
  {
    name: 'a spread on an input with the ref by name',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<input v-bind="inputProps()" :ref="setInputElement" />'),
  },
  {
    name: 'a spread on an input beside a static ref',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<input ref="input" v-bind="inputProps" />'),
  },
  {
    name: 'a spread on an input with a static template ref',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<input v-bind="inputProps()" ref="input" />'),
  },
  {
    name: 'an input with no spread and no ref',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<input type="hidden" :name="name" :value="value" />'),
  },
  {
    name: 'a spread with no ref on an element that is not an input',
    file: `${SRC}/DialogRoot.vue`,
    code: docsSfc('', '<div v-bind="attributes" />'),
  },
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
    name: 'a queryBy query for an absence after a wait on an element that the test holds',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: `${WAIT_IMPORT}const dialog = screen.getByRole('dialog');\nawait waitFor(() => {\n  expect(dialog).not.toBeInTheDocument();\n});\nexpect(screen.queryByRole('dialog')).toBe(null);\nexpect(within(document.body).queryAllByRole('option')).toHaveLength(0);\n`,
  },
  {
    name: 'a focus call in onMounted and a ref that stores the element',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: "import { defineComponent, onMounted, shallowRef } from 'vue';\n\nexport const Focused = defineComponent(() => {\n  const input = shallowRef<HTMLInputElement | null>(null);\n  onMounted(() => input.value?.focus());\n  return () => <input ref={input} />;\n});\n",
  },
  {
    name: 'a focus call in onVnodeMounted in a slot function',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: "import { h } from 'vue';\n\nexport const render = ({ props }: { props: Record<string, unknown> }) =>\n  h('input', { ...props, onVnodeMounted: ({ el }) => (el as HTMLElement).focus() });\n",
  },
  {
    name: 'a call of select with an argument in a function ref',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: "declare const store: { select: (key: string) => unknown };\n\nexport const node = () => <input ref={() => store.select('open')} />;\n",
  },
  {
    name: 'a focus call in a function ref in a source file',
    file: `${SRC}/DialogRoot.ts`,
    code: "import { h } from 'vue';\n\nexport const node = () => h('input', { ref: (element) => (element as HTMLElement | null)?.focus() });\n",
  },
  {
    name: 'a getBy query in waitFor in a shared suite',
    file: 'packages/vue/test/popupConformanceTests.tsx',
    code: `${WAIT_IMPORT}await waitFor(() => {\n  expect(screen.getByRole('dialog')).toHaveFocus();\n});\nawait waitFor(() => expect(within(document.body).getAllByRole('option')).toHaveLength(2));\n`,
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
    name: 'a function that returns a vnode in a row of it.each and in a constant of the module',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: `import { it } from 'vitest';\n\nconst popup = () => <div />;\n\nit.each([{ name: 'a button', node: () => <button>{popup()}</button> }])(\n  'renders $name',\n  ({ node }) => {\n    void node();\n  },\n);\n`,
  },
  {
    name: 'a vnode in a case and as the argument of a shared suite',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: `${VNODE_IMPORT}declare function describeConformance(element: unknown): void;\n\ndescribe('a root', () => {\n  describeConformance(<div />);\n\n  it('renders', () => {\n    const node = <div />;\n    void node;\n  });\n});\n`,
  },
  {
    name: 'a vnode in a constant of the module in a type test',
    file: `${SRC}/DialogRoot.spec.tsx`,
    code: 'const element = <div />;\n',
  },
  {
    name: 'a vnode in a constant of a type test of a template',
    file: `${SRC}/DialogRootInTemplate.spec.vue`,
    code: `<script setup lang="ts">\nimport { h } from 'vue';\n\nconst element = h('div');\n</script>\n\n<template>\n  <component :is="element" />\n</template>\n`,
  },
  {
    name: 'a vnode in a constant of the script setup of a test SFC',
    file: `${SRC}/DialogRootInTemplate.test.vue`,
    code: `<script setup lang="ts">\nimport { h } from 'vue';\n\nconst element = h('span');\n</script>\n\n<template>\n  <component :is="element" />\n</template>\n`,
  },
  {
    name: 'an import of onActivated and onDeactivated in useKeepAliveState.ts',
    file: 'packages/vue/src/internals/useKeepAliveState.ts',
    code: "import { onActivated, onDeactivated } from 'vue';\n\nexport const hooks = [onActivated, onDeactivated];\n",
  },
  {
    name: 'imports of both KeepAlive hooks in a test file',
    file: `${SRC}/DialogRoot.test.tsx`,
    code: "import { onActivated, onDeactivated } from 'vue';\n\nexport const hooks = [onActivated, onDeactivated];\n",
  },
  {
    name: 'an import of useFloating in useAnchorPositioning.ts',
    file: 'packages/vue/src/internals/useAnchorPositioning.ts',
    code: "import { useFloating } from '@floating-ui/vue';\n\nexport const position = useFloating;\n",
  },
  {
    name: 'an import of a middleware and a type of Floating UI, and of watch',
    file: `${SRC}/useRoot.ts`,
    code: "import { offset } from '@floating-ui/vue';\nimport type { Placement } from '@floating-ui/vue';\nimport { watch } from 'vue';\n\nexport const used = [offset, watch];\nexport type Side = Placement;\n",
  },
  {
    name: 'relative imports of a common file, a prehydration script and useVaseUiId',
    file: `${SRC}/useRoot.ts`,
    code: "import { ownerDocument } from '../common/owner';\nimport { useVaseUiId } from '../internals/useVaseUiId';\nimport { script } from './prehydrationScript.min';\n\nexport const used = [ownerDocument, useVaseUiId, script];\n",
  },
  {
    name: 'the names of Vase UI and a link to Base UI in a comment',
    file: `${SRC}/useRoot.ts`,
    code: "// https://github.com/mui/base-ui/issues/979\nexport const INERT = 'data-vase-ui-inert';\nexport const attribute = (name: string) => `data-vase-ui-${name}`;\nexport const event = new Event('vase-ui');\n",
  },
  {
    name: 'an attribute name of Vase UI and a component whose name starts with Transition in a template',
    file: `${SRC}/DialogRoot.vue`,
    code: `<script setup lang="ts">\nimport TransitionStatusProbe from './TransitionStatusProbe.vue';\n</script>\n\n<template>\n  <TransitionStatusProbe data-vase-ui-inert="" class="vase-ui-disable-scrollbar" />\n</template>\n`,
  },
  {
    name: 'a style key that has a vendor prefix in its CSS form',
    file: `${SRC}/useRoot.ts`,
    code: "export const style = { 'user-select': 'none', '-webkit-user-select': 'none' };\n",
  },
  {
    name: 'a key that has ms inside it and a key that has no capital after a vendor prefix',
    file: `${SRC}/useRoot.ts`,
    code: "export const labels = { itemsPerPage: 1, msg: 'a', Mozilla: 'b', webkit: true, moz: false };\n",
  },
  {
    name: 'a read of a member and of an object pattern that have a vendor prefix, and a key from a variable',
    file: `${SRC}/useRoot.ts`,
    code: "declare const event: { webkitForce: number; mozInputSource: number };\ndeclare const style: Record<string, string>;\ndeclare const msKey: string;\n\nconst { webkitForce, 'mozInputSource': source } = event;\nexport const select = style.webkitUserSelect;\nexport const used = [webkitForce, source, { [msKey]: 1 }];\nstyle[msKey] = select;\nstyle.userSelect = style.webkitUserSelect;\n",
  },
  {
    name: 'a method of Temporal and a constant that has the name using',
    file: `${SRC}/useRoot.ts`,
    code: 'export const order = (a: Temporal.PlainTime, b: Temporal.PlainTime) =>\n  Temporal.PlainTime.compare(a, b);\nexport const using = 1;\n',
  },
  {
    name: 'a groupBy method of another object',
    file: `${SRC}/useRoot.ts`,
    code: 'export const groups = (collection: { groupBy(): unknown }) => collection.groupBy();\n',
  },
  {
    name: 'a groupBy method and a dispose method of another object in a template',
    file: `${SRC}/DialogRoot.vue`,
    code: '<script setup lang="ts">\nconst collection = { groupBy: () => 1, dispose: () => 2 };\n</script>\n\n<template>\n  <div>{{ collection.groupBy() }} {{ collection.dispose() }}</div>\n</template>\n',
  },
  {
    name: 'a dispose method of another object',
    file: `${SRC}/useRoot.ts`,
    code: 'export const stop = (resource: { dispose(): void; asyncDispose(): void }) => {\n  resource.dispose();\n  resource.asyncDispose();\n};\n',
  },
  {
    name: 'expect.poll in a test of the Nuxt fixture',
    file: 'fixtures/nuxt/test/pages.test.ts',
    code: "import { expect } from 'vitest';\n\nexport const poll = expect.poll(() => 1);\n",
  },
];

for (const [name, fallback, override, empty] of [
  ['a visible render option that replaces a null default', 'null', "h('span')", false],
  ['a null render option that replaces a visible default', "h('span')", 'null', true],
]) {
  test(`checks ${name}`, async () => {
    const code = `<script lang="ts">
import { h } from 'vue';
export default { render() { return ${fallback}; } };
</script>
<script setup lang="ts">
defineOptions({ render: () => ${override} });
</script>`;
    const messages = await lint(`${SRC}/DialogContent.vue`, code);
    assert.deepEqual(
      messages.map(({ ruleId }) => ruleId).filter((id) => id !== 'vue/component-api-style'),
      empty ? ['vase-ui/no-empty-part'] : [],
    );
  });
}

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

for (const { name, code } of [
  {
    name: 'a `watch` callback',
    code: "import { watch } from 'vue';\n\ndeclare const element: Element;\nwatch(() => element, () => element.getRootNode());\n",
  },
  {
    name: 'a `watchPostEffect` callback',
    code: "import { watchPostEffect } from 'vue';\n\ndeclare const element: Element;\nwatchPostEffect(() => element.getRootNode());\n",
  },
  {
    name: 'a `useDomEffect` effect',
    code: "import { useDomEffect } from '../utils/popups/useDomEffect';\n\ndeclare const element: Element;\nuseDomEffect([], () => {\n  element.getRootNode();\n});\n",
  },
]) {
  test(`reports a root node read in ${name} one time`, async () => {
    const messages = await lint(`${SRC}/useRoot.ts`, code);
    assert.deepEqual(
      messages.map(({ ruleId }) => ruleId),
      ['no-restricted-syntax'],
    );
    assert.match(messages[0].message, /followRootNode/);
  });
}

for (const { part, file, tag, binding } of [
  { part: 'a portal part', file: PORTAL_PART, tag: 'PopupPortal', binding: '{ ...$attrs, as }' },
  { part: 'a portal part', file: PORTAL_PART, tag: 'PopupPortal', binding: '$attrs' },
  {
    part: 'the input part',
    file: 'packages/vue/src/input/Input.vue',
    tag: 'FieldControl',
    binding: '{ ...$attrs, ...props }',
  },
]) {
  test(`reports v-bind="${binding}" on ${part} one time`, async () => {
    const messages = await lint(file, docsSfc('', `<${tag} v-bind="${binding}" />`));
    assert.deepEqual(
      messages.map(({ ruleId }) => ruleId),
      ['vue/no-restricted-syntax'],
    );
    assert.match(messages[0].message, /withoutPropsOf/);
  });
}

test('reports a row that has a vnode in a vnode one time', async () => {
  const messages = await lint(
    `${SRC}/DialogRoot.test.tsx`,
    `import { it } from 'vitest';\n\nit.each([\n  {\n    name: 'a list',\n    node: (\n      <ul>\n        <li />\n      </ul>\n    ),\n  },\n])('renders $name', () => {});\n`,
  );
  assert.deepEqual(
    messages.map(({ ruleId }) => ruleId),
    ['no-restricted-syntax'],
  );
});

test('reports an import of a Base UI package one time', async () => {
  const messages = await lint(
    `${SRC}/useRoot.ts`,
    "import { ownerDocument } from '@base-ui/utils/owner';\n\nexport { ownerWindow } from '@base-ui/utils/owner';\nexport * from '@base-ui/utils/owner';\nexport const owner = ownerDocument;\n",
  );
  assert.deepEqual(
    messages.map(({ ruleId }) => ruleId),
    ['no-restricted-imports', 'no-restricted-imports', 'no-restricted-imports'],
  );
});

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

test('renders a page with the Markdown rules of the site', async () => {
  const { default: config } = await import('./eslint.config.js');
  const { processor } = config.find((entry) => entry.processor?.meta?.name === 'vase-ui/page');
  const [{ text }] = processor.preprocess('### Filtering [Preview]\n', join(ROOT, PAGE));
  assert.match(text, /<span class="heading-badge ignore-header">Preview<\/span>/);
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
