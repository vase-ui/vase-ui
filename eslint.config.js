import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

const SOURCE_FILES = ['packages/vue/src/**/*.{ts,vue}'];
const TEST_FILES = ['**/*.test.*', '**/*.spec.*'];
const TEST_SCRIPT_FILES = TEST_FILES.map((testFiles) => [testFiles, '**/*.{js,mjs,ts,tsx,vue}']);

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
  innerHTML: 'A bound `innerHTML` renders data as HTML. Use text interpolation.',
  reactEventProp: (reactKey, vueKey) =>
    `Vue makes the event name from the key, so \`${reactKey}\` listens to an event that no browser sends. Use \`${vueKey}\`.`,
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

// The rule uses a fixed list of names. A pattern for a second capital also matches a
// component event, such as `onOpenChange`.
const VUE_KEY_OF_REACT_EVENT_PROP = {
  onAnimationEnd: 'onAnimationend',
  onAnimationIteration: 'onAnimationiteration',
  onAnimationStart: 'onAnimationstart',
  onAuxClick: 'onAuxclick',
  onBeforeInput: 'onBeforeinput',
  onBeforeToggle: 'onBeforetoggle',
  onCanPlay: 'onCanplay',
  onCanPlayThrough: 'onCanplaythrough',
  onCompositionEnd: 'onCompositionend',
  onCompositionStart: 'onCompositionstart',
  onCompositionUpdate: 'onCompositionupdate',
  onContextMenu: 'onContextmenu',
  onDoubleClick: 'onDblclick',
  onDragEnd: 'onDragend',
  onDragEnter: 'onDragenter',
  onDragExit: 'onDragexit',
  onDragLeave: 'onDragleave',
  onDragOver: 'onDragover',
  onDragStart: 'onDragstart',
  onDurationChange: 'onDurationchange',
  onGotPointerCapture: 'onGotpointercapture',
  onKeyDown: 'onKeydown',
  onKeyPress: 'onKeypress',
  onKeyUp: 'onKeyup',
  onLoadStart: 'onLoadstart',
  onLoadedData: 'onLoadeddata',
  onLoadedMetadata: 'onLoadedmetadata',
  onLostPointerCapture: 'onLostpointercapture',
  onMouseDown: 'onMousedown',
  onMouseEnter: 'onMouseenter',
  onMouseLeave: 'onMouseleave',
  onMouseMove: 'onMousemove',
  onMouseOut: 'onMouseout',
  onMouseOver: 'onMouseover',
  onMouseUp: 'onMouseup',
  onPointerCancel: 'onPointercancel',
  onPointerDown: 'onPointerdown',
  onPointerEnter: 'onPointerenter',
  onPointerLeave: 'onPointerleave',
  onPointerMove: 'onPointermove',
  onPointerOut: 'onPointerout',
  onPointerOver: 'onPointerover',
  onPointerUp: 'onPointerup',
  onRateChange: 'onRatechange',
  onScrollEnd: 'onScrollend',
  onTimeUpdate: 'onTimeupdate',
  onTouchCancel: 'onTouchcancel',
  onTouchEnd: 'onTouchend',
  onTouchMove: 'onTouchmove',
  onTouchStart: 'onTouchstart',
  onTransitionCancel: 'onTransitioncancel',
  onTransitionEnd: 'onTransitionend',
  onTransitionRun: 'onTransitionrun',
  onTransitionStart: 'onTransitionstart',
  onVolumeChange: 'onVolumechange',
};

const RESTRICTED_REACT_EVENT_PROP_SYNTAX = Object.entries(VUE_KEY_OF_REACT_EVENT_PROP).flatMap(
  ([reactKey, vueKey]) =>
    ['', 'Capture'].map((suffix) => ({
      selector: [
        `Property[key.name='${reactKey}${suffix}']`,
        `MemberExpression[computed=false][property.name='${reactKey}${suffix}']`,
        `JSXAttribute[name.name='${reactKey}${suffix}']`,
      ].join(', '),
      message: MESSAGES.reactEventProp(`${reactKey}${suffix}`, `${vueKey}${suffix}`),
    })),
);

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
  ...RESTRICTED_REACT_EVENT_PROP_SYNTAX,
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
    // vue-eslint-parser reads the `generic` attribute of `<script setup>` as a directive.
    selector: `VElement:not([name='script']) > VStartTag > VAttribute[directive=true]:not([key.name.name=/^(?:${BUILT_IN_DIRECTIVES}|memo)$/])`,
    message: MESSAGES.customDirective,
  },
  { selector: "Identifier[name='$el']", message: MESSAGES.$el },
  { selector: "Identifier[name='$parent']", message: MESSAGES.$parent },
];

const RESTRICTED_INNER_HTML_SYNTAX = [
  {
    // `:innerHTML`, `v-bind:innerHTML` and `.innerHTML`. The parser writes the argument in lower
    // case in `name`, so the selector reads `rawName`.
    selector: "VAttribute[directive=true][key.name.name='bind'][key.argument.rawName='innerHTML']",
    message: MESSAGES.innerHTML,
  },
  { selector: "Property[key.name='innerHTML']", message: MESSAGES.innerHTML },
];

export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/.package-check/',
    '**/.vitepress/cache/',
    '**/node_modules/',
    // Scripts write these barrels.
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
      // The port keeps the shape of the Base UI code, which uses `any`.
      '@typescript-eslint/no-explicit-any': 'off',
      // The port keeps the shape of the Base UI code, which uses `{}` as a type.
      '@typescript-eslint/no-empty-object-type': 'off',
      // The port keeps the shape of the Base UI code, which has unused `_` names and rest siblings.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // A type test declares values and reads them only to check their types.
    files: ['**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
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
    files: [...TEST_SCRIPT_FILES, 'packages/vue/test/**/*.{ts,tsx,vue}'],
    rules: { 'no-restricted-syntax': ['error', ...RESTRICTED_REACT_EVENT_PROP_SYNTAX] },
  },
  {
    // Text from parity/ and from Base UI commits is data. A page must not render it as HTML, with
    // `v-html` or with `innerHTML` as a prop or as an object key, in the template or in a script.
    files: ['docs/**/*.vue'],
    rules: {
      'vue/no-v-html': 'error',
      'vue/no-restricted-syntax': ['error', ...RESTRICTED_INNER_HTML_SYNTAX],
      'no-restricted-syntax': ['error', ...RESTRICTED_INNER_HTML_SYNTAX],
    },
  },
  {
    // The style sheet of a demo is a byte copy of the Base UI file. The copy shows that the data
    // attributes and CSS variables of Vase UI are those of Base UI. A demo has no style of its own.
    files: ['docs/demos/**/*.vue'],
    rules: {
      'vue/no-restricted-block': [
        'error',
        {
          element: 'style',
          message:
            'The styles of a demo come from the copied style sheet of Base UI. Remove the style block.',
        },
      ],
    },
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
