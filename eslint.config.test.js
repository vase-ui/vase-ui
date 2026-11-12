import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: dirname(fileURLToPath(import.meta.url)) });

async function lint(filePath, code) {
  const [{ messages }] = await eslint.lintText(code, { filePath });
  return messages.map(({ ruleId, message }) => ({ ruleId, message }));
}

const SRC = 'packages/vue/src/dialog';

const SCRIPT_ONLY_TEMPLATE = '\n<template>\n  <div />\n</template>\n';

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
    name: 'a style block in a demo',
    file: 'docs/demos/sample/hero/css-modules/index.vue',
    code: '<script setup lang="ts"></script>\n\n<template>\n  <div class="sample" />\n</template>\n\n<style>\n.sample {\n  color: red;\n}\n</style>\n',
    ruleId: 'vue/no-restricted-block',
    hint: 'copied style sheet',
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
