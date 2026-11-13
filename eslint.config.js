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
  html: '`innerHTML`, `outerHTML` and `insertAdjacentHTML` render data as HTML. Use text interpolation.',
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

const RESTRICTED_HTML_SYNTAX = [
  {
    // `:innerHTML`, `v-bind:innerHTML`, `.innerHTML` and `:inner-h-t-m-l.camel`. The `camel`
    // modifier turns the last one into `innerHTML`. The parser writes the argument in lower case in
    // `name`, so the selector reads `rawName`.
    selector:
      "VAttribute[directive=true][key.name.name='bind'][key.argument.rawName=/^(inner|outer)(-?H|-h)(-?T|-t)(-?M|-m)(-?L|-l)$/]",
    message: MESSAGES.html,
  },
  {
    selector: [
      // An object pattern has `Property` nodes too, and it reads the property.
      'ObjectExpression > Property[key.name=/^(inner|outer)HTML$/]',
      'AssignmentExpression > MemberExpression.left[property.name=/^(inner|outer)HTML$/]',
      "CallExpression[callee.property.name='insertAdjacentHTML']",
    ].join(', '),
    message: MESSAGES.html,
  },
];

export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/.nuxt/',
    '**/.output/',
    '**/.package-check/',
    '**/.vitepress/cache/',
    '**/node_modules/',
    // Scripts write these barrels.
    'packages/vue/src/index.ts',
    'packages/vue/test/package-check/index.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
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
      // `Dialog.Root.Props` is a namespace of types beside the part. `erasableSyntaxOnly` refuses
      // a namespace that has a value.
      '@typescript-eslint/no-namespace': 'off',
      // Part files keep the names of the Base UI files, such as `Separator.vue`.
      'vue/multi-word-component-names': 'off',
      // Base UI has `any` in public types, which `pnpm parity:check` compares.
      '@typescript-eslint/no-explicit-any': 'off',
      // Each report is a public type of Base UI: an empty `State`, or `{}` as the default of a
      // type parameter.
      '@typescript-eslint/no-empty-object-type': 'off',
      // typescript-eslint cannot read an SFC, so a value from a `.vue` import has no type. These
      // rules report each use of such a value.
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      // The DOM types say that each API exists, so the rule reports the feature checks.
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // An interface has no implicit index signature, so the fix can break an assignment to a
      // `Record`.
      '@typescript-eslint/consistent-type-definitions': 'off',
      // The fix writes the `!` that `no-non-null-assertion` refuses.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      // `void source.value` registers a dependency of a `computed` or a watcher.
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      // A function that does nothing is a value here, such as `NOOP`. The fix is a comment that
      // repeats the code.
      '@typescript-eslint/no-empty-function': 'off',
      // The records of Base UI are plain objects.
      '@typescript-eslint/no-dynamic-delete': 'off',
      // The rule reports the helper that compares two types, and public signatures of Base UI.
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      // The fix changes the text of two types in the declarations of `mergeProps`.
      '@typescript-eslint/consistent-indexed-object-style': 'off',
      // A callback of the consumer can return nothing, so Base UI has `void` in a union.
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      // `||` and `??` give different results for `''`, `0` and `false`.
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { bigint: true, boolean: true, number: true, string: true } },
      ],
      // `test` of `node:test` returns a promise that the runner handles.
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            { from: 'package', name: ['describe', 'it', 'test'], package: 'node:test' },
          ],
        },
      ],
      // With `verbatimModuleSyntax`, `import { type A }` stays as an import of the module.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'prefer-object-has-own': 'error',
      'logical-assignment-operators': 'error',
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
      // A type test gives a constant a wider type than its value.
      '@typescript-eslint/no-inferrable-types': 'off',
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
    // Text from parity/ and from Base UI commits is data. A page must not render it as HTML.
    // The rules read the template and the script. They refuse `v-html`, `insertAdjacentHTML`, and
    // `innerHTML` and `outerHTML` as a prop, an object key or an assignment target.
    files: ['docs/**/*.vue'],
    rules: {
      'vue/no-v-html': 'error',
      'vue/no-restricted-syntax': ['error', ...RESTRICTED_HTML_SYNTAX],
      'no-restricted-syntax': ['error', ...RESTRICTED_HTML_SYNTAX],
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
  {
    files: [...TEST_SCRIPT_FILES, 'packages/vue/test/**/*.{ts,tsx,vue}', 'fixtures/nuxt/test/**'],
    rules: {
      // A ported test keeps the `!` of the Base UI test. A value that is absent fails the test.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // A test takes the queries of Testing Library out of their object.
      '@typescript-eslint/unbound-method': 'off',
      // The fix changes a title such as `${key}` into an expression, and `pnpm parity:check` then
      // cannot read the title.
      '@typescript-eslint/no-unnecessary-template-expression': 'off',
      // A ported test keeps the casts of the Base UI test.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
  {
    // No tsconfig.json includes a JavaScript file. `nuxt prepare` writes the one of the fixture,
    // and `pnpm lint` does not run it. In an SFC, typescript-eslint has no type for a macro or
    // for a parameter of `generic`, and a fix then removes a type argument that vue-tsc needs.
    files: ['**/*.{js,mjs,vue}', 'fixtures/nuxt/**'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  eslintConfigPrettier,
]);
