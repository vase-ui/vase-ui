import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

const SOURCE_FILES = ['packages/vue/src/**/*.{ts,vue}'];
const TEST_FILES = ['**/*.test.*', '**/*.spec.*'];

const MESSAGES = {
  getCurrentInstance:
    'The current instance is null in Vapor mode. Use `provide` and `inject`, a prop or an exposed value.',
  cloneVNode: 'Vapor mode cannot clone a vnode. Use the `as` prop or the `#render` slot.',
  slotCall: 'Vapor mode cannot call a slot in script. Render the slot in the template.',
  $el: 'A Vapor ref has no `$el`. Use `resolveElement` or the exposed `element`.',
  $parent: 'Vapor mode has no `$parent`. Use `provide` and `inject`.',
  customDirective: 'A custom directive has another signature in Vapor mode. Use a composable.',
  vMemo: 'Vapor mode has no `v-memo`. Remove it.',
  defineComponent:
    'Only a `<script setup>` SFC compiles to Vapor mode. Use `<script setup lang="ts">`.',
  domGlobal:
    'A server render has no DOM, and an element can live in an iframe. Use `ownerDocument(element)` and `ownerWindow(element)`.',
  domInstanceof:
    'Another realm has other classes. Check `nodeType`, or use the class of `ownerWindow(element)`.',
  tsx: 'A TSX component never compiles to Vapor mode. Write an SFC or a `.ts` composable.',
};

const RESTRICTED_IMPORTS = [
  { name: 'vue', importNames: ['getCurrentInstance'], message: MESSAGES.getCurrentInstance },
  { name: 'vue', importNames: ['cloneVNode'], message: MESSAGES.cloneVNode },
  {
    name: 'vue',
    importNames: ['withDirectives', 'resolveDirective'],
    message: MESSAGES.customDirective,
  },
  { name: 'vue', importNames: ['defineComponent'], message: MESSAGES.defineComponent },
];

const RESTRICTED_GLOBALS = {
  globals: ['document', 'window', 'navigator'].map((name) => ({
    name,
    message: MESSAGES.domGlobal,
  })),
  checkGlobalObject: true,
};

const RESTRICTED_PROPERTIES = [
  { property: '$el', message: MESSAGES.$el },
  { property: '$parent', message: MESSAGES.$parent },
];

const RESTRICTED_SYNTAX = [
  {
    selector: [
      "CallExpression[callee.type='MemberExpression'][callee.object.name=/^\\$?slots$/]",
      "CallExpression[callee.type='MemberExpression'][callee.object.property.name=/^\\$?slots$/]",
      "CallExpression[callee.type='MemberExpression'][callee.object.callee.name='useSlots']",
    ].join(', '),
    message: MESSAGES.slotCall,
  },
  {
    selector:
      "BinaryExpression[operator='instanceof'][right.name=/^(?:Node|Text|Comment|Document|DocumentFragment|ShadowRoot|Window|Range|Selection|[A-Za-z]*Element|[A-Za-z]*Event)$/]",
    message: MESSAGES.domInstanceof,
  },
];

const RESTRICTED_SYNTAX_IN_VUE_FILES = [
  ...RESTRICTED_SYNTAX,
  {
    selector: [
      'Program > VariableDeclaration > VariableDeclarator[id.name=/^v[A-Z]/]',
      'Program > FunctionDeclaration[id.name=/^v[A-Z]/]',
      'Program > ImportDeclaration > [local.name=/^v[A-Z]/]',
    ].join(', '),
    message: MESSAGES.customDirective,
  },
];

const BUILT_IN_DIRECTIVES =
  'if|else|else-if|for|show|bind|on|model|slot|text|html|cloak|pre|once|is';

const RESTRICTED_TEMPLATE_SYNTAX = [
  { selector: "VAttribute[directive=true][key.name.name='memo']", message: MESSAGES.vMemo },
  {
    selector: `VAttribute[directive=true]:not([key.name.name=/^(?:${BUILT_IN_DIRECTIVES}|memo)$/])`,
    message: MESSAGES.customDirective,
  },
  { selector: "Identifier[name='$el']", message: MESSAGES.$el },
  { selector: "Identifier[name='$parent']", message: MESSAGES.$parent },
];

export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/.package-check/',
    '**/node_modules/',
    // The build writes these barrels.
    'packages/vue/src/index.ts',
    'packages/vue/test/package-check/index.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/essential'],
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // vue-tsc reports undefined names, and the compiler macros are not globals.
    files: ['**/*.{ts,tsx,vue}'],
    rules: { 'no-undef': 'off' },
  },
  {
    rules: {
      // `Dialog.Root.Props` is a type-only namespace beside the part.
      '@typescript-eslint/no-namespace': 'off',
      // Part files keep the names of the Base UI files, such as `Separator.vue`.
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: SOURCE_FILES,
    ignores: TEST_FILES,
    rules: {
      'no-restricted-imports': ['error', { paths: RESTRICTED_IMPORTS }],
      'no-restricted-globals': ['error', RESTRICTED_GLOBALS],
      'no-restricted-properties': ['error', ...RESTRICTED_PROPERTIES],
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
      'vue/no-restricted-syntax': ['error', ...RESTRICTED_TEMPLATE_SYNTAX],
    },
  },
  {
    files: ['packages/vue/src/**/*.vue'],
    ignores: TEST_FILES,
    rules: { 'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX_IN_VUE_FILES] },
  },
  {
    files: ['packages/vue/src/**/*.tsx'],
    ignores: TEST_FILES,
    rules: { 'no-restricted-syntax': ['error', { selector: 'Program', message: MESSAGES.tsx }] },
  },
  {
    files: ['packages/vue/src/internals/resolveElement.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...RESTRICTED_PROPERTIES.filter(({ property }) => property !== '$el'),
      ],
    },
  },
  eslintConfigPrettier,
]);
