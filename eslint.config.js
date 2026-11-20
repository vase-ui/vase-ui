import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import siteConfig from './docs/.vitepress/config.ts';

const SOURCE_FILES = ['packages/vue/src/**/*.{ts,vue}'];
const TEST_FILES = ['**/*.test.*', '**/*.spec.*'];
const TEST_SCRIPT_FILES = TEST_FILES.map((testFiles) => [testFiles, '**/*.{js,mjs,ts,tsx,vue}']);
const VUE_TEST_SCRIPT_FILES = TEST_SCRIPT_FILES.map((pair) => ['packages/vue/**', ...pair]);

const MESSAGES = {
  getCurrentInstance:
    'The current instance is null in Vapor mode. Use `provide` and `inject`, a prop or an exposed value.',
  cloneVNode: 'Vapor mode cannot clone a vnode. Use the `as` prop or the `element` slot.',
  slotCall: 'Vapor mode cannot call a slot in script. Render the slot in the template.',
  $el: 'A Vapor ref has no `$el`. Use `useElement` or the exposed `element`.',
  $parent: 'Vapor mode has no `$parent`. Use `provide` and `inject`.',
  arrayCopyMethod:
    'The build supports Firefox 114, and Firefox 114 does not have this array method. Use `sort`, `reverse` or `splice` on a copy. See "Compiler flags" in CONTRIBUTING.md.',
  customDirective: 'A custom directive has another signature in Vapor mode. Use a composable.',
  vMemo: 'Vapor mode has no `v-memo`. Remove it.',
  refByName:
    'Vapor mode applies a `ref` only when the template binds it by name. It ignores the `ref` key of a bound object. Bind the setter beside the spread: `v-bind="elementProps()" :ref="setRef"`.',
  inputRefByName:
    'Vapor mode applies a `ref` only when the template binds it by name. It ignores the `ref` key of a bound object. Give the input a named ref or bind its setter beside the spread.',
  defineComponent:
    'Only a `<script setup>` SFC compiles to Vapor mode. Use `<script setup lang="ts">`.',
  domGlobal:
    'A server render has no DOM, and an element can live in an iframe. Use `ownerDocument(element)` and `ownerWindow(element)`.',
  domInstanceof:
    'Another realm has other classes. Check `nodeType`, or use the class of `ownerWindow(element)`.',
  releaseFunction:
    'A release function in a `let` has no owner. Create the resource in a `watch` callback and give its release to `onCleanup`. See "Lifetime" in CONTRIBUTING.md.',
  staleRootNode:
    'A root node that a watcher, a hook or a `computed` reads is stale after `Teleport` moves the element. Use `observeRootNode` or `followRootNode` of `src/common`, or read the root node at the time of the event.',
  tsx: 'A TSX component never compiles to Vapor mode. Write an SFC or a `.ts` composable.',
  html: 'This name can render a string as HTML. Show data with text interpolation.',
  htmlDynamicArgument:
    'A dynamic argument can be `innerHTML`, which renders a string as HTML. Write the name of the attribute.',
  waitLimit:
    'This wait has a limit in seconds, and a busy machine can stall the page for longer. Use `waitFor`, `screen` or `within` of `#test-utils`. Their limit is a count of frames.',
  dragAndDrop:
    'In WebKit, this drag leaves the mouse button pressed for the later test files of the page. In Firefox, it leaves a second pointer at the drop point. Use `dragAndDrop` of `test/pointer.ts`, which releases the button and moves that pointer to the edge of the page when the case ends.',
  absenceWait:
    'A query for an absence passes before the element appears, so this wait can end before the change. Assert the absence directly, or wait on an element that you got before the action. For a presence, use a `getBy` query.',
  privateKeyword:
    'The `private` keyword is only a check of the compiler. Write an ECMAScript private member: `#name`.',
  vnodeAtCollection:
    'Vitest makes this vnode one time, when it collects the file, and Vue mounts a vnode one time. Write a function that returns the vnode. Call it in the case.',
  baseUiName:
    'A page can hold Base UI and Vase UI, and the two libraries must not share a marker. Write `vase-ui`.',
  baseUiImport:
    'The package does not depend on Base UI. Import the port of the file by a relative path, such as `../common/owner`.',
  commonImport:
    '`common` is not an entry point, so the built package has no such path. Import the file by a relative path, such as `../common/owner`.',
  prehydrationImport:
    'The build writes this subpath import. A test job has no `dist`, and Vite cannot resolve the import. Write `./prehydrationScript.min`.',
  useFloating:
    '`usePlacement` of `src/popup/placement.ts` gives `useFloating` the middleware of Base UI. Call `usePlacement` in a positioner part.',
  inputValueWrite: 'Restore the input through its Vue value binding.',
  handledInput: 'Handle the input event without a second copy of the value.',
  defineModel:
    'A defined model prop controls the part. An undefined prop lets the part own the value. Vue permits a local write through `useModel` with only the prop.',
  groupBy:
    'No browser that the build supports has `groupBy`, and the build adds no polyfill. Group the items in a loop.',
  withResolvers:
    'No browser that the build supports has `Promise.withResolvers`, and the build adds no polyfill. Use `new Promise`.',
  resourceManagement:
    'No browser that the build supports has `Symbol.dispose`, and the build adds no polyfill. Call the cleanup in a `finally` block.',
  temporalInstanceof:
    'Another realm and a polyfill have other `Temporal` classes. Use `kindOf` or `isKind` of `common/date-time/temporal`.',
  toLocaleString:
    '`Intl` must get a number, a zone and a calendar, and never a `Temporal` object. Format a date or a time with `formatter()` of `common/date-time/format`, and a number with `formatNumber` of `common/formatNumber`.',
  actInRef:
    'Vue can run a function ref before the element is in the document, so this call can do nothing. Act in `onMounted`, or in `onVnodeMounted` in a slot function.',
  vendorStyleKey:
    "A server render writes this key with no hyphen at its start, and the result is not a CSS property. Write the CSS form, such as `'-webkit-user-select'`.",
  vendorStyleWrite:
    "A server render writes this key of a style object with no hyphen at its start, and the result is not a CSS property. Write the CSS form, such as `style['-webkit-user-select']`. For the `style` of an element, call `setProperty` with the CSS form.",
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
  { name: '@floating-ui/vue', importNames: ['useFloating'], message: MESSAGES.useFloating },
];

const RESTRICTED_IMPORT_PATTERNS = [
  { regex: '^@base-ui/', message: MESSAGES.baseUiImport },
  { regex: '^@vase-ui/vue/common(?:/|$)', message: MESSAGES.commonImport },
  { regex: '^#prehydration/', message: MESSAGES.prehydrationImport },
];

const RESTRICTED_GLOBALS = {
  globals: ['document', 'window', 'navigator'].map((name) => ({
    name,
    message: MESSAGES.domGlobal,
  })),
  checkGlobalObject: true,
};

const ARRAY_COPY_METHODS = ['toSorted', 'toReversed', 'toSpliced'];

const RESTRICTED_PROPERTIES = [
  { property: '$el', message: MESSAGES.$el },
  { property: '$parent', message: MESSAGES.$parent },
  ...ARRAY_COPY_METHODS.map((property) => ({ property, message: MESSAGES.arrayCopyMethod })),
  { object: 'Map', property: 'groupBy', message: MESSAGES.groupBy },
  { object: 'Object', property: 'groupBy', message: MESSAGES.groupBy },
  { object: 'Promise', property: 'withResolvers', message: MESSAGES.withResolvers },
  { object: 'Symbol', property: 'dispose', message: MESSAGES.resourceManagement },
  { object: 'Symbol', property: 'asyncDispose', message: MESSAGES.resourceManagement },
  { property: 'toLocaleString', message: MESSAGES.toLocaleString },
];

// HTML ignores the case of an attribute name, so the pattern ignores the case.
const BASE_UI_NAME = '/base-ui/i';
const VENDOR_STYLE_KEY = '/^(?:[Ww]ebkit|[Mm]oz|ms)[A-Z]/';

// A template expression has these nodes too, so the script and the template share this list.
const RESTRICTED_EXPRESSION_SYNTAX = [
  {
    // The import rules report the source of an import, so this rule does not.
    selector: [
      `Literal[value=${BASE_UI_NAME}]:not(:matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration) > Literal)`,
      `TemplateElement[value.cooked=${BASE_UI_NAME}]`,
    ].join(', '),
    message: MESSAGES.baseUiName,
  },
  {
    // An object pattern has `Property` nodes too, and it reads the key.
    selector: [
      `ObjectExpression > Property[computed=false][key.name=${VENDOR_STYLE_KEY}]`,
      `ObjectExpression > Property[key.value=${VENDOR_STYLE_KEY}]`,
    ].join(', '),
    message: MESSAGES.vendorStyleKey,
  },
  {
    // The object can also be the `style` of an element, so this entry has its own message.
    selector: [
      `AssignmentExpression > MemberExpression.left[computed=false][property.name=${VENDOR_STYLE_KEY}]`,
      `AssignmentExpression > MemberExpression.left[property.value=${VENDOR_STYLE_KEY}]`,
    ].join(', '),
    message: MESSAGES.vendorStyleWrite,
  },
];

const RESTRICTED_TEST_IMPORTS = {
  patterns: [
    {
      group: ['@testing-library/dom'],
      importNamePattern: '^(waitFor|find|screen$|within$|queries$|getQueriesForElement$)',
      message: MESSAGES.waitLimit,
    },
  ],
};

const RESTRICTED_TEST_PROPERTIES = [
  { object: 'vi', property: 'waitFor', message: MESSAGES.waitLimit },
  { object: 'vi', property: 'waitUntil', message: MESSAGES.waitLimit },
  { object: 'expect', property: 'poll', message: MESSAGES.waitLimit },
  { object: 'expect', property: 'element', message: MESSAGES.waitLimit },
  // Also through another name of `userEvent`.
  { property: 'dragAndDrop', message: MESSAGES.dragAndDrop },
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

const VNODE = ":matches(JSXElement, JSXFragment, CallExpression[callee.name='h'])";
const TABLE = 'CallExpression[callee.property.name=/^(?:each|for)$/] > ArrayExpression';
const CONSTANT = 'VariableDeclaration > VariableDeclarator';
// A call such as `describe(…)`, `describe.skipIf(…)(…)` or `describe.each(…)(…)`.
const DESCRIBE =
  ":matches(CallExpression[callee.name='describe'], CallExpression[callee.callee.object.name='describe'])";

// A call that acts on an element. `select` of a store has an argument, and `select()` of an input has none.
const ACT_ON_ELEMENT =
  ":function :matches(CallExpression[callee.property.name=/^(?:click|select|blur)$/][arguments.length=0], CallExpression[callee.property.name='focus'])";

// A later block with `no-restricted-syntax` for a test file replaces the list of an earlier block.
// Thus each selector for the test files is in this one list.
const RESTRICTED_TEST_SYNTAX = [
  ...RESTRICTED_REACT_EVENT_PROP_SYNTAX,
  {
    selector: [
      `JSXAttribute[name.name='ref'] > JSXExpressionContainer > ${ACT_ON_ELEMENT}`,
      `CallExpression[callee.name='h'] > ObjectExpression > Property[key.name='ref'] > ${ACT_ON_ELEMENT}`,
    ].join(', '),
    message: MESSAGES.actInRef,
  },
  {
    selector: [
      "CallExpression[callee.name='waitFor'] CallExpression[callee.name=/^query(All)?By/]",
      "CallExpression[callee.name='waitFor'] CallExpression[callee.property.name=/^query(All)?By/]",
    ].join(', '),
    message: MESSAGES.absenceWait,
  },
  {
    // The first selector reports the outermost vnode of a row, and no vnode in a function of a row.
    selector: [
      `${TABLE} ${VNODE}:not(${TABLE} :function ${VNODE}):not(${VNODE} *)`,
      `Program > ${CONSTANT} > ${VNODE}`,
      `${DESCRIBE} > :function > BlockStatement > ${CONSTANT} > ${VNODE}`,
    ].join(', '),
    message: MESSAGES.vnodeAtCollection,
  },
];

const LET_TYPE =
  "VariableDeclaration[kind='let'] > VariableDeclarator:not([init.name='NOOP']) > Identifier.id > TSTypeAnnotation";
const VOID_FUNCTION = "TSFunctionType[returnType.typeAnnotation.type='TSVoidKeyword']";

const RESTRICTED_SYNTAX = [
  {
    selector: `${LET_TYPE} > ${VOID_FUNCTION}, ${LET_TYPE} > TSUnionType > ${VOID_FUNCTION}`,
    message: MESSAGES.releaseFunction,
  },
  {
    selector:
      "VariableDeclaration[kind='let'] > VariableDeclarator[init.type='Identifier'][init.name='NOOP']",
    message: MESSAGES.releaseFunction,
  },
  {
    selector:
      "CallExpression[callee.name=/^(?:watch|watchEffect|watchPostEffect|watchSyncEffect|onBeforeMount|onMounted|onBeforeUpdate|onUpdated|onActivated|computed)$/] CallExpression[callee.property.name='getRootNode']",
    message: MESSAGES.staleRootNode,
  },
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
  {
    // A `declare` field and a member of a `declare class` have no code at run time. TypeScript
    // refuses `declare` on a `#` member, and a constructor cannot have a `#` name.
    selector:
      ":not(ClassDeclaration[declare=true] > ClassBody) > [accessibility='private']:not([declare=true])",
    message: MESSAGES.privateKeyword,
  },
  {
    selector:
      "BinaryExpression[operator='instanceof']:matches([right.object.name='Temporal'], [right.object.property.name='Temporal'])",
    message: MESSAGES.temporalInstanceof,
  },
  {
    selector:
      'AssignmentExpression > MemberExpression.left[computed=false][property.name="value"] > TSAsExpression.object:has(TSTypeReference[typeName.name=/^HTML(Input|TextArea)Element$/])',
    message: MESSAGES.inputValueWrite,
  },
  {
    selector: 'VariableDeclarator[id.name=/^handled\\w*(Value|Text)$/]',
    message: MESSAGES.handledInput,
  },
  { selector: "CallExpression[callee.name='defineModel']", message: MESSAGES.defineModel },
  { selector: 'VariableDeclaration[kind=/using$/]', message: MESSAGES.resourceManagement },
  ...RESTRICTED_EXPRESSION_SYNTAX,
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
    // A start tag has only its attributes below it, so the descendant form is exact.
    selector:
      "VStartTag:has(VAttribute[directive=true][key.name.name='bind']:not([key.argument]) CallExpression[callee.name='elementProps']):not(:has(VAttribute[directive=true][key.name.name='bind'][key.argument.name='ref']))",
    message: MESSAGES.refByName,
  },
  {
    // A selector cannot read the bound object, so the rule applies to each `<input>` with a spread.
    selector:
      "VElement[name='input'] > VStartTag:has(VAttribute[directive=true][key.name.name='bind']:not([key.argument])):not(:has(VAttribute[directive=true][key.name.name='bind'][key.argument.name='ref'])):not(:has(VAttribute[directive=false][key.name='ref'][value.value=/.+/]))",
    message: MESSAGES.inputRefByName,
  },
  {
    // vue-eslint-parser reads the `generic` attribute of `<script setup>` as a directive.
    selector: `VElement:not([name='script']) > VStartTag > VAttribute[directive=true]:not([key.name.name=/^(?:${BUILT_IN_DIRECTIVES}|memo)$/])`,
    message: MESSAGES.customDirective,
  },
  { selector: "Identifier[name='$el']", message: MESSAGES.$el },
  { selector: "Identifier[name='$parent']", message: MESSAGES.$parent },
  {
    selector: `MemberExpression[computed=false][property.name=/^(?:${ARRAY_COPY_METHODS.join('|')})$/]`,
    message: MESSAGES.arrayCopyMethod,
  },
  {
    selector:
      "MemberExpression[computed=false][object.name=/^(?:Map|Object)$/][property.name='groupBy']",
    message: MESSAGES.groupBy,
  },
  {
    selector:
      "MemberExpression[computed=false][object.name='Symbol'][property.name=/^(?:dispose|asyncDispose)$/]",
    message: MESSAGES.resourceManagement,
  },
  {
    selector: "MemberExpression[computed=false][property.name='toLocaleString']",
    message: MESSAGES.toLocaleString,
  },
  {
    selector: `VIdentifier[name=${BASE_UI_NAME}], VLiteral[value=${BASE_UI_NAME}]`,
    message: MESSAGES.baseUiName,
  },
  ...RESTRICTED_EXPRESSION_SYNTAX,
];

// The sinks of the Trusted Types API that take `TrustedHTML`, and the methods of the HTML Sanitizer
// API, which also render a string as HTML. The list has `execCommand` for each command, not only
// `insertHTML`, because the API is deprecated.
// https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API#injection_sink_interfaces
// https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API
const HTML_PROPERTIES = '(?:inner|outer)HTML|srcdoc';
const HTML_METHODS =
  'insertAdjacentHTML|setHTML|setHTMLUnsafe|parseHTML|parseHTMLUnsafe|createContextualFragment|parseFromString|execCommand|writeln';

// The name can be an identifier, a string, or a template literal that has no expression. A prop
// `srcDoc` sets the attribute `srcdoc`, because HTML ignores the case of an attribute name. The
// pattern thus ignores the case.
function selectorOfEachName(node, field, names, rest = '') {
  const pattern = `/^(?:${names})$/i`;
  return [
    `[${field}.name=${pattern}]`,
    `[${field}.type='Literal'][${field}.value=${pattern}]`,
    `[${field}.type='TemplateLiteral'][${field}.expressions.length=0][${field}.quasis.0.value.cooked=${pattern}]`,
  ]
    .map((name) => `${node}${name}${rest}`)
    .join(', ');
}

const RESTRICTED_HTML_SCRIPT_SYNTAX = [
  {
    // An object pattern has `Property` nodes too, and it reads the property.
    selector: selectorOfEachName('ObjectExpression > Property', 'key', HTML_PROPERTIES),
    message: MESSAGES.html,
  },
  {
    // A member can be the target of a write in many positions, so the rule refuses each member, a
    // read too.
    selector: selectorOfEachName(
      'MemberExpression',
      'property',
      `${HTML_PROPERTIES}|${HTML_METHODS}`,
    ),
    message: MESSAGES.html,
  },
  {
    // A stream and the clipboard also have `write`, so the rule needs the name of the object.
    selector: selectorOfEachName(
      'MemberExpression',
      'property',
      'write',
      ':matches([object.name=/document$/i], [object.property.name=/document$/i], [object.callee.name=/document$/i])',
    ),
    message: MESSAGES.html,
  },
  {
    selector: [
      selectorOfEachName(
        "CallExpression[callee.property.name='setAttribute']",
        'arguments.0',
        'srcdoc',
      ),
      selectorOfEachName(
        "CallExpression[callee.property.name='setAttributeNS']",
        'arguments.1',
        'srcdoc',
      ),
    ].join(', '),
    message: MESSAGES.html,
  },
];

const RESTRICTED_HTML_TEMPLATE_SYNTAX = [
  {
    // `:innerHTML`, `v-bind:innerHTML`, `.innerHTML` and `:inner-h-t-m-l.camel`. The `camel`
    // modifier turns the last one into `innerHTML`, so the pattern allows a hyphen between the
    // letters.
    selector:
      "VAttribute[directive=true][key.name.name='bind'][key.argument.rawName=/^(?:(?:inner|outer)-?h-?t-?m-?l|src-?doc)$/i]",
    message: MESSAGES.html,
  },
  {
    selector:
      "VAttribute[directive=true][key.name.name='bind'][key.argument.type='VExpressionContainer']",
    message: MESSAGES.htmlDynamicArgument,
  },
  ...RESTRICTED_HTML_SCRIPT_SYNTAX,
];

// `createStaticVNode` and `Static` render a string as HTML.
const RESTRICTED_HTML_IMPORTS = [
  { name: 'vue', importNames: ['createStaticVNode', 'Static'], message: MESSAGES.html },
];

// VitePress makes an SFC from a page, and Vue compiles the SFC. The processor makes an SFC from the
// scripts of the page and the HTML of the renderer of VitePress. The rules for an SFC then apply to
// a page. A page includes a region of `README.md` and of `THANKS.md`, and the synchronous render of
// a processor does not expand an include. ESLint thus reads each of the two files as a page.
const PAGE_FILES = ['docs/**/*.md', 'README.md', 'THANKS.md'];
const SFC_OF_PAGE_FILES = PAGE_FILES.map((page) => `${page}/*.vue`);

// Vue reads `{{ }}` in a fence only when the language ends in `-vue`. As the site does, this reads
// the letters, digits, `_` and `-` at the start of the language in lower case. When the language
// starts with another character, it reads the full language.
function isVueFence(lang) {
  return (/^[\w-]+/.exec(lang)?.[0].toLowerCase() ?? lang).endsWith('-vue');
}

// ESLint renders a page with the VitePress of `docs`, the one that builds the site. The root
// `package.json` does not list VitePress, because the job `stage` of the release workflow installs
// the root dependencies in a step that can get an OIDC token.
const docsRequire = createRequire(`${import.meta.dirname}/docs/package.json`);
const vitepress = await import(pathToFileURL(docsRequire.resolve('vitepress')).href);

// The renderer has each `markdown` option of the site. A Markdown rule of the site, such as the
// heading badge, thus also changes the SFC that ESLint reads. The exception is the code of a fence.
// The site colors it in an asynchronous step, and a processor is synchronous, so this renderer
// writes the code as text.
const pageRenderer = await vitepress.createMarkdownRenderer(`${import.meta.dirname}/docs`, {
  ...siteConfig.markdown,
  highlight: (code, lang) =>
    `<pre${isVueFence(lang) ? '' : ' v-pre'}><code>${pageRenderer.utils.escapeHtml(code)}</code></pre>`,
});

function sfcOfPage(text, path) {
  // The `<<<` rule reads a code file from a path that is relative to the page.
  const env = { path };
  const html = pageRenderer.render(text, env);
  const scripts = env.sfcBlocks.scripts.map(({ content }) => content);
  // VitePress puts the HTML in a `div`, so a page that has no text still has a root element.
  return [...scripts, `<template><div>${html}</div></template>`].join('\n');
}

// A report has a position in the SFC. The page has the reported text where the writer typed it, so
// the report goes to the first place of that text in the page, or to line 1.
function positionInPage(page, sfc, { line, column, endLine, endColumn }) {
  const sfcLine = sfc.split('\n')[line - 1] ?? '';
  const reported = sfcLine.slice(column - 1, endLine === line ? endColumn - 1 : undefined);
  const before = page.slice(0, Math.max(page.indexOf(reported), 0)).split('\n');
  return { line: before.length, column: before.at(-1).length + 1 };
}

const renderedPages = new Map();

// There is no `supportsAutofix`, so ESLint writes no fix. A fix has a position in the SFC, not in
// the page.
const pageProcessor = {
  meta: { name: 'vase-ui/page' },
  preprocess(text, filename) {
    const sfc = sfcOfPage(text, filename);
    renderedPages.set(filename, { text, sfc });
    return [{ text: sfc, filename: 'page.vue' }];
  },
  postprocess([messages], filename) {
    const { text, sfc } = renderedPages.get(filename);
    renderedPages.delete(filename);
    return messages.map((message) => ({
      ...message,
      ...positionInPage(text, sfc, message),
      endLine: undefined,
      endColumn: undefined,
    }));
  },
};

const noEmptyPart = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { empty: 'A part must render a node. Move logic with no node to a composable.' },
  },
  create(context) {
    const { sourceCode } = context;
    const sfc = sourceCode.parserServices.getDocumentFragment?.();
    const template = sfc?.children.find((block) => block.name === 'template');
    const scriptSetup = sfc?.children.find(
      (block) =>
        block.name === 'script' &&
        block.startTag.attributes.some((attr) => attr.key.name === 'setup'),
    );
    const returns = new WeakMap();
    const paths = [];
    const checks = new Map();

    function initializer(id) {
      for (let scope = sourceCode.getScope(id); scope; scope = scope.upper) {
        const variable = scope.set.get(id.name);
        if (!variable) continue;
        const [def] = variable.defs;
        if (
          variable.defs.length !== 1 ||
          variable.references.some((ref) => ref.isWrite() && !ref.init)
        ) {
          break;
        }
        if (def.type === 'FunctionName') return def.node;
        if (def.parent?.kind === 'const' && def.node.id === def.name) return def.node.init;
        break;
      }
      return undefined;
    }

    function everyValue(node, test, seen = new Set()) {
      if (node?.type === 'Identifier') {
        if (seen.has(node)) return false;
        const value = initializer(node);
        // The binding of a const object is fixed, but its component options can change.
        if (value && value.type !== 'ObjectExpression') {
          return everyValue(value, test, new Set(seen).add(node));
        }
      }
      if (
        [
          'TSAsExpression',
          'TSSatisfiesExpression',
          'TSTypeAssertion',
          'TSNonNullExpression',
        ].includes(node?.type)
      ) {
        return everyValue(node.expression, test, seen);
      }
      if (node?.type === 'ConditionalExpression') {
        return everyValue(node.consequent, test, seen) && everyValue(node.alternate, test, seen);
      }
      return test(node);
    }

    function emptyRender(node) {
      const values = returns.get(node);
      return (
        values?.length > 0 &&
        values.every((value) =>
          everyValue(value, (result) => result?.type === 'Literal' && result.value === null),
        )
      );
    }

    function emptySetup(node, fallback) {
      const values = returns.get(node);
      return (
        values?.length > 0 &&
        values.every((value) =>
          everyValue(value, (result) => {
            // Vue uses the render option when setup returns bindings or falls through.
            if (!result || result.type === 'ObjectExpression' || result.type === 'Literal') {
              return fallback;
            }
            return emptyRender(result);
          }),
        )
      );
    }

    function keyOf(property) {
      if (property.type === 'SpreadElement') return undefined;
      if (!property.computed && property.key.type === 'Identifier') return property.key.name;
      if (property.key.type === 'Literal') return property.key.value;
      return undefined;
    }

    function option(object, name) {
      // A later spread or computed key can replace either option.
      const property = object.properties.findLast(
        (entry) => keyOf(entry) === name || keyOf(entry) === undefined,
      );
      return property && keyOf(property) === name && property.kind === 'init'
        ? property.value
        : property;
    }

    function emptyComponent(node, hasTemplate = false) {
      if (node?.type !== 'ObjectExpression') return false;
      const fallback = !hasTemplate && everyValue(option(node, 'render'), emptyRender);
      const setup = option(node, 'setup');
      return setup ? everyValue(setup, (fn) => emptySetup(fn, fallback)) : fallback;
    }

    function emptySfc(program) {
      if (!sfc) return undefined;
      if (template) {
        if (
          program.templateBody &&
          !template.startTag.attributes.some(
            (attr) => attr.key.name === 'src' && attr.value?.value,
          ) &&
          template.children.every(
            (child) => child.type === 'VText' && !/[^\t\n\f\r ]/u.test(child.value),
          )
        ) {
          return template;
        }
        return undefined;
      }
      if (!scriptSetup) return undefined;
      const declaration = program.body.find(
        (node) => node.type === 'ExportDefaultDeclaration',
      )?.declaration;
      const options =
        declaration?.type === 'CallExpression' ? declaration.arguments[0] : declaration;
      // Without a template, Vue inlines an empty render unless the normal script declares a
      // render option by identifier. It then applies the options from script setup last.
      if (!options?.properties?.some((property) => property.key?.name === 'render')) {
        return scriptSetup;
      }
      const macro = program.body.find(
        ({ expression, range }) =>
          expression?.type === 'CallExpression' &&
          expression.callee.name === 'defineOptions' &&
          range[0] >= scriptSetup.startTag.range[1] &&
          range[1] <= scriptSetup.range[1],
      )?.expression.arguments[0];
      if (macro && macro.type !== 'ObjectExpression') return undefined;
      const render = (macro && option(macro, 'render')) ?? option(options, 'render');
      return everyValue(render, emptyRender) ? render : undefined;
    }

    return {
      onCodePathStart(_path, node) {
        const values = [];
        returns.set(node, values);
        paths.push({ active: 0, values });
      },
      onCodePathSegmentStart() {
        paths.at(-1).active += 1;
      },
      onCodePathSegmentEnd() {
        paths.at(-1).active -= 1;
      },
      ReturnStatement(node) {
        const path = paths.at(-1);
        if (path.active) path.values.push(node.argument);
      },
      ':function:exit'(node) {
        const path = paths.at(-1);
        if (node.body.type !== 'BlockStatement') path.values.push(node.body);
        else if (path.active) path.values.push(null);
      },
      onCodePathEnd() {
        paths.pop();
      },
      "CallExpression[callee.name='defineComponent']"(call) {
        const [component, extra] = call.arguments;
        if (!component || (scriptSetup && call.parent.type === 'ExportDefaultDeclaration')) return;
        checks.set(component, (node) => {
          const hasTemplate = template && call.parent.type === 'ExportDefaultDeclaration';
          if (node?.type === 'ObjectExpression') return emptyComponent(node, hasTemplate);
          const fallback =
            !hasTemplate &&
            extra?.type === 'ObjectExpression' &&
            everyValue(option(extra, 'render'), emptyRender);
          return emptySetup(node, fallback);
        });
      },
      ExportDefaultDeclaration(node) {
        if (sfc && !scriptSetup) {
          checks.set(
            node.declaration,
            (value) => emptyComponent(value, Boolean(template)) || emptyRender(value),
          );
        }
      },
      "VariableDeclarator[id.typeAnnotation.typeAnnotation.typeName.name='FunctionalComponent']"(
        node,
      ) {
        if (node.init) checks.set(node.init, emptyRender);
      },
      ":matches(TSSatisfiesExpression, TSAsExpression, TSTypeAssertion)[typeAnnotation.typeName.name='FunctionalComponent']"(
        node,
      ) {
        checks.set(node, emptyRender);
      },
      'Program:exit'(program) {
        const empty = emptySfc(program);
        if (empty) {
          context.report({ node: empty, messageId: 'empty' });
          return;
        }
        for (const [node, test] of checks) {
          if (everyValue(node, test)) context.report({ node, messageId: 'empty' });
        }
      },
    };
  },
};

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
      // A number in a template is correct, such as `${height}px` for a CSS length.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // An arrow function that calls a function with no result is the text of Base UI, such as
      // `() => resolve()`.
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
      'logical-assignment-operators': ['error', 'always', { enforceForIfStatements: true }],
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
    plugins: { 'vase-ui': { rules: { 'no-empty-part': noEmptyPart } } },
    rules: {
      'vase-ui/no-empty-part': 'error',
      'no-restricted-imports': [
        'error',
        { paths: RESTRICTED_IMPORTS, patterns: RESTRICTED_IMPORT_PATTERNS },
      ],
      'no-restricted-globals': ['error', RESTRICTED_GLOBALS],
      'no-restricted-properties': ['error', ...RESTRICTED_PROPERTIES],
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
      // `public` is the default of a class member, so the keyword says nothing.
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
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
    rules: { 'no-restricted-syntax': ['error', ...RESTRICTED_TEST_SYNTAX] },
  },
  {
    // No test runner runs a type test, and Vue runs the `<script setup>` of a test SFC at each mount, so a vnode there never mounts twice.
    files: ['**/*.spec.{ts,tsx}', '**/*.{test,spec}.vue', 'packages/vue/test/**/*.vue'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...RESTRICTED_TEST_SYNTAX.filter(({ message }) => message !== MESSAGES.vnodeAtCollection),
      ],
    },
  },
  {
    files: ['**/*.{test,spec}.vue', 'packages/vue/test/**/*.vue'],
    rules: {
      'vue/no-restricted-syntax': [
        'error',
        {
          selector: `VAttribute[directive=true][key.name.name='bind'][key.argument.name='ref'] > VExpressionContainer > ${ACT_ON_ELEMENT}`,
          message: MESSAGES.actInRef,
        },
      ],
    },
  },
  {
    // The tests of `fixtures/nuxt` run in Node and wait with Playwright and `expect.poll`. These
    // rules are for `packages/vue` only. `test/queries.ts` wraps the queries of Testing Library.
    files: [...VUE_TEST_SCRIPT_FILES, 'packages/vue/test/**/*.{ts,tsx,vue}'],
    ignores: ['packages/vue/test/queries.ts'],
    rules: {
      'no-restricted-imports': ['error', RESTRICTED_TEST_IMPORTS],
      'no-restricted-properties': ['error', ...RESTRICTED_TEST_PROPERTIES],
    },
  },
  { files: PAGE_FILES, processor: pageProcessor },
  {
    // Text from parity/ and from Base UI commits is data. A page must not render it as HTML.
    files: ['docs/**', ...SFC_OF_PAGE_FILES],
    rules: {
      'vue/no-v-html': 'error',
      'vue/no-restricted-syntax': ['error', ...RESTRICTED_HTML_TEMPLATE_SYNTAX],
      'no-restricted-syntax': ['error', ...RESTRICTED_HTML_SCRIPT_SYNTAX],
      'no-restricted-imports': ['error', { paths: RESTRICTED_HTML_IMPORTS }],
    },
  },
  {
    // The style sheet of a CSS-module demo is a byte copy of the Base UI file, and the class strings
    // of a Tailwind demo are those of Base UI. Both show that the data attributes and CSS variables
    // of Vase UI are those of Base UI. A demo has no style of its own.
    files: ['docs/demos/**/*.vue'],
    rules: {
      'vue/no-restricted-block': [
        'error',
        {
          element: 'style',
          message:
            'A CSS-module demo takes its styles from the copied style sheet of Base UI. A Tailwind demo takes them from its class names. Remove the style block.',
        },
      ],
    },
  },
  {
    files: ['packages/vue/src/popup/placement.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: RESTRICTED_IMPORTS.filter(({ message }) => message !== MESSAGES.useFloating),
          patterns: RESTRICTED_IMPORT_PATTERNS,
        },
      ],
    },
  },
  {
    files: ['packages/vue/src/common/element.ts'],
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
      // A ported test can keep the `!` of the Base UI test. A value that is absent fails the test.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // A test takes the queries of Testing Library out of their object.
      '@typescript-eslint/unbound-method': 'off',
      // The fix changes a title such as `${key}` into an expression, and `pnpm parity:check` then
      // cannot read the title.
      '@typescript-eslint/no-unnecessary-template-expression': 'off',
      // A ported test can keep the casts of the Base UI test.
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
