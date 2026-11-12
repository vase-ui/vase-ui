# How to contribute to Vase UI

Vase UI is a port of [Base UI](https://base-ui.com) to Vue 3. This file gives the rules of the port.

The port is in progress. Some rules name a helper that a later pull request adds.

## Setup

Install these tools:

- Node.js, at the version in `.node-version`.
- pnpm, at the version in the `packageManager` field of `package.json`. pnpm 10 and later change to that version automatically.

Then install the dependencies and the browsers:

```bash
pnpm install
pnpm --filter @vase-ui/vue exec playwright install chromium firefox webkit
```

| Command              | Function                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`          | Tests the lint rules. Then it runs ESLint and the Prettier check.                                                                 |
| `pnpm format`        | Formats the files with Prettier.                                                                                                  |
| `pnpm typecheck`     | Writes the barrel. Then it runs vue-tsc on the package.                                                                           |
| `pnpm build`         | Builds `packages/vue/dist`.                                                                                                       |
| `pnpm check:package` | Builds the package with two fixture families. Then it checks the result with publint, Are the Types Wrong and a consumer project. |
| `pnpm test`          | Runs all tests.                                                                                                                   |
| `pnpm test:node`     | Runs the tests that have no DOM.                                                                                                  |
| `pnpm test:browser`  | Runs the browser tests in Chromium, Firefox and WebKit.                                                                           |
| `pnpm test:chromium` | Runs the browser tests in Chromium. `test:firefox` and `test:webkit` do the same for their engine.                                |

To run one test file, add a part of its name: `pnpm test:chromium SinglePart`.

## Pull requests

- Make one change in each pull request.
- Write the title as a Conventional Commit, with the family folder as the scope: `feat(separator): add Separator`.
- GitHub squashes each pull request, and the title becomes the commit on `main`.
- Write the body in three parts: Why, What and Tests.
- The check `required` must pass.

## Source of the port

- `parity/upstream.json` records the Base UI commit that Vase UI tracks.
- `parity/scope.json` lists what Vase UI does not port, each with its reason. It also lists the Base UI paths that are out of scope.
- Port from Base UI at the tracked commit.
- The other sources are the code and documentation of Vue, the web standards, and the libraries that Vase UI depends on.
- A ported file keeps the "Modified" or "@see" comment of its upstream file.

## Layout and names

| Base UI                       | Vase UI                     |
| ----------------------------- | --------------------------- |
| `packages/react/src/<folder>` | `packages/vue/src/<folder>` |
| `packages/utils/src`          | `packages/vue/src/common`   |
| `packages/react/test`         | `packages/vue/test`         |

- Folder, file and part names are the same as upstream: `dialog/root/DialogRoot.vue`.
- The vocabulary is that of upstream's `GLOSSARY.md`: Popup, Root, Trigger, Anchor, Positioner.
- A family is one upstream folder.
- State attributes (`data-open`) and CSS variables keep upstream's names and values. Upstream CSS then works with no change.
- Internal names change `base-ui` to `vase-ui`: `data-vase-ui-*`, `event.preventVaseUIHandler()`, `VASE_UI_ANIMATIONS_DISABLED`, `new Event('vase-ui')`.
- A page can then hold the two libraries, and they do not share markers.
- Messages start with `Vase UI:`.

## Entry points

The package is `@vase-ui/vue`. It is ESM only.

- Each upstream folder that has a package export is one entry point with the same name: `@vase-ui/vue/dialog`, `@vase-ui/vue/merge-props`, `@vase-ui/vue/use-render`.
- `@vase-ui/vue` is a barrel of the entry points.
- A folder `packages/vue/src/<name>` that has an `index.ts` file is an entry point.
- No list names the entry points. `package.json` has the one pattern `./*`. The build and `pnpm typecheck` write the barrel `src/index.ts`. Do not commit the barrel.
- `internals`, `utils` and `common` are not entry points.
- A folder with a name that starts with `unstable-` is an entry point, but the barrel does not include it.

The entry point of a family exports:

1. The namespace of the parts: `export * as Dialog from './index.parts'`. Documentation and tests use `<Dialog.Root>`.
2. The flat components `DialogRoot`, `DialogTrigger` and so on. `app.component`, the `components` option and auto-import tools use them.
3. The types, with the two upstream names: `Dialog.Root.Props` and `DialogRootProps`. The same is true for `State`, `ChangeEventDetails`, `ChangeEventReason` and `Actions`.
4. The attribute and variable names, such as `DialogPopupDataAttributes` and `DialogPopupCssVariables`, with upstream's names and values.

The first form of a type is a namespace of types beside the constant in `index.parts.ts`:

```ts
import DialogRoot from './root/DialogRoot.vue';
import type { DialogRootProps, DialogRootState } from './root/DialogRoot.vue';

export const Root: typeof DialogRoot = DialogRoot;
export namespace Root {
  export type Props<Payload = unknown> = DialogRootProps<Payload>;
  export type State = DialogRootState;
}
```

Give the constant the type `typeof DialogRoot`. Without it, the declaration build writes an expanded type. A consumer project that checks library files then reports an error.

A family with one part declares the constant and its namespace in `index.ts`.

## API convention

### Parts that render an element

| API                                                              | Function                                                                  | Base UI form                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------ |
| `as` prop: `string \| Component`. The default is upstream's tag. | Sets the element or the component that the part renders.                  | `render={<a />}`               |
| `#render` slot with the slot props `{ props, state }`            | Replaces the element. Bind `props` on your element: `<a v-bind="props">`. | `render={(props, state) => …}` |
| Default slot with the slot props `{ state }`                     | Holds the content.                                                        | `children`                     |
| `class` and `style` attributes                                   | Vue merges them. Your class comes first, and your style wins.             | `className`, `style`           |
| `stateClass` prop: `(state) => ClassValue`                       | Gives a class that depends on the state.                                  | `className` as a function      |
| `stateStyle` prop: `(state) => StyleValue`                       | Gives a style that depends on the state.                                  | `style` as a function          |
| `nativeButton` prop, where upstream has it                       | The same as upstream.                                                     | `nativeButton`                 |
| Exposed `element`                                                | Gives the DOM element through a template ref.                             | `ref`                          |

- `props` of the `#render` slot holds the attributes, the listeners, the state data attributes, the class, the style and the `ref` setter.
- If a consumer gives `as` and `#render`, `#render` wins. A development build shows a warning.
- Vue removes a function that is given as `class`. This is the reason for `stateClass` and `stateStyle`.
- Each part sets `defineOptions({ inheritAttrs: false })`. Each attribute and listener goes to the element through `mergeProps`.
- A consumer handler runs before the handler of the part. `event.preventVaseUIHandler()` stops the handler of the part.
- There is no `asChild` prop, and no part clones a vnode.

The template of each such part has two lines and no wrapper component:

```vue
<slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
<component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
```

- `elementProps` is a function that the template calls. It is not a `computed`.
- When the attributes start empty, a spread reads no key. A `computed` then does not see an attribute that comes later.
- The render function runs again on each change of the attributes.
- A part with a void default tag (`img`, `input`) has no default slot.
- A root part that renders no element has only `<slot />`.

### Parts with nodes of their own

Some upstream parts put nodes of their own in the element. Examples are the range input of `Slider.Thumb` and the focus guards of `Toast.Viewport`.

- Each such part has one internal SFC, `<Part>Children.vue`.
- That SFC reads the state of the part with `inject`. It renders the nodes around its default slot, in upstream's order.
- The `#render` slot of the part gets a third slot prop, `children`, which is that component.
- A consumer writes `<a v-bind="props"><component :is="children">…</component></a>`.
- A development build shows a warning when the `#render` slot does not mount `children`.

<!-- prettier-ignore -->
```vue
<slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="SliderThumbChildren" />
<component :is="as" v-else v-bind="elementProps()"><SliderThumbChildren><slot :state="state" /></SliderThumbChildren></component>
```

### Element targets

One helper, `resolveElement(value)`, changes a value into an element:

- An element stays the same.
- A Vase UI part gives its exposed `element`.
- Another component gives `$el` when that is an element. If not, the result is `null` and a development build shows a warning.

Rules:

- The `ref` setter of a part calls `resolveElement`. Thus `as="RouterLink"` and `<RouterLink v-bind="props">` work.
- A prop that takes an element accepts `MaybeRefOrGetter<Element | ComponentPublicInstance | null>` and upstream's other forms. Examples are `anchor`, `container`, `initialFocus`, `finalFocus` and `collisionBoundary`.
- Find an element by its `nodeType`. Do not use `instanceof`.

### `mergeProps`

`mergeProps(...sets)` is public. It follows upstream's rules with Vue names:

- The rightmost set wins.
- `class` values are joined, rightmost first.
- `style` values are merged, and the rightmost wins.
- `on[A-Z]…` handlers run from right to left. An array of handlers is made flat.
- A set can be a function `(merged) => props`.
- `ref` is not merged.
- An event is an object that has `preventDefault`. Do not use `instanceof`.

### `useRender`

`useRender({ state, props, stateAttributesMapping, enabled })` is public. It is the composable that the parts use.

### State and `v-model`

Upstream has trios such as `open`, `defaultOpen` and `onOpenChange`. For each trio `x`, `defaultX`, `onXChange`:

- The props `x` and `defaultX` keep their names.
- Declare each controlled prop with `default: undefined` through `withDefaults`. Without it, Vue changes an absent Boolean prop to `false`.
- `x !== undefined` means that the part is controlled. A development build shows a warning when the mode changes.
- The part emits `xChange(value, details)` and then `update:x(value)`, synchronously.
- The part does not emit `update:x` when `details.isCanceled` is true.
- A consumer writes `v-model:open`, `v-model:value`, `v-model:checked` or `v-model:pressed`. There is no `modelValue` alias.
- One composable does this: `useControlled({ controlled: () => props.x, default: props.defaultX, name })`.
- Do not use `defineModel`. It writes the value before a parent can cancel the change.

`details` is upstream's object:

- `reason`, with upstream's strings.
- `event`: the native event, or `new Event('vase-ui')` when there is none.
- `cancel()` and `isCanceled`.
- `allowPropagation()` and `isPropagationAllowed`.
- `trigger`.
- `preventUnmountOnClose()`, on popup roots.

### Other callbacks

- A callback that only tells the consumer about a change becomes an emit. The name loses `on`: `openChangeComplete`, `valueCommitted`, `itemHighlighted`, `loadingStatusChange`.
- A callback whose result the component uses stays a function prop: `validate`, `format`, `getAriaValueText`, `filter`, `itemToStringValue`, `isItemEqualToValue`, `initialFocus`, `finalFocus`.

### Actions, handles, slots, composables and ids

- `actionsRef` becomes methods that the part exposes. A consumer reads them through a template ref.
- Popup roots expose `close()` and `unmount()`. `Field.Root` exposes `validate()`. `Form` exposes `validate(name?)`. The types are `DialogRootActions` and so on.
- A ref prop of upstream (`inputRef`) becomes an exposed element (`inputElement`) beside `element`.
- Handles are upstream's objects, with no change: `Dialog.createHandle<Payload>()`, `handle`, `payload`, `triggerId`, `open()`, `openWithPayload()`, `close()`, `isOpen`.
- Function children become a default scoped slot with named props: `{ payload }` on a root, `{ validity }` on `Field.Validity`, `{ item, index }` on list parts, `{ value }` on `Select.Value`.
- Type the slots with `defineSlots`. A root with a value type uses `generic="Value"`.
- Hooks keep their names as composables: `useDirection`, `useRender`, `Toast.useToastManager`, `Combobox.useFilter`.
- An id is `props.id ?? useId()`, made in setup. The ids of the parts derive from the id of the root.

## Rules for the source

### Files

- Each part is an SFC with `<script setup lang="ts">`.
- The exported types of a part are in a `<script lang="ts">` block of the same file.
- Logic is in `.ts` composables.
- `packages/vue/src` has no TSX. Tests use TSX.
- `vue` is a peer dependency. The package can have only two run-time dependencies: `@floating-ui/vue` and `@floating-ui/utils`.
- When two families import each other, move the shared context or constant to `src/internals`.

### Vapor mode

The source obeys rules that keep it compatible with the Vapor mode of Vue. ESLint blocks these items in `packages/vue/src`:

| Blocked                               | Use                                                 |
| ------------------------------------- | --------------------------------------------------- |
| `getCurrentInstance`                  | `provide` and `inject`, props, or an exposed value  |
| `cloneVNode`                          | `as` or the `#render` slot                          |
| A call of a slot in script            | The slot in the template                            |
| `$el`                                 | `resolveElement` or the exposed `element`           |
| `$parent`                             | `provide` and `inject`                              |
| Custom directives                     | A composable                                        |
| `v-memo`                              | No replacement                                      |
| The Options API and `defineComponent` | `<script setup lang="ts">`                          |
| `document`, `window`, `navigator`     | `ownerDocument(element)` and `ownerWindow(element)` |
| `instanceof` with a DOM class         | `nodeType`, or the class of `ownerWindow(element)`  |
| A `.tsx` source file                  | An SFC or a `.ts` composable                        |

If a line must break a rule, put a disable comment on that line and give the reason.

### Server render

- Each part must render with `renderToString` in Node with no DOM.
- Code in setup does not touch `window` or `document`.
- Compute labels, `aria-*` attributes and the roving tabindex at render, from props and ids. Do not compute them in `onMounted`.
- Hydration must give no mismatch warning.
- A portal renders after mount. It does not render while the popup is closed, unless `keepMounted` is set.

### What Vue replaces

- Vue reactivity replaces upstream's `Store`, `ReactStore`, `useStore`, `fastHooks` and `createSelector`.
- A popup store is `shallowReactive` state, `computed` selectors and a plain `context`. Each root makes one.
- `useId` gives the ids.
- `Teleport` with `defer` puts a popup into a container node that the portal owns.
- Each context has a plain `Symbol()` key for `provide` and `inject`. Each copy of the library then has its own contexts.
- Only three registries are shared between copies, on `Symbol.for` keys: the scroll-lock count, the modal marks and the Escape stack.
- Each shared registry is a plain object with a `version` field. Fields are only added.
- Direction and CSP stay as `DirectionProvider` and `CSPProvider`. There is no global configuration provider.

### What differs from the React source

- A handler that is `onFocus` or `onBlur` upstream listens to `focusin` or `focusout`. React implements its two handlers with these events.
- `onChange` on a text input becomes `input`.
- To stop the focus handler of a part, call `event.preventVaseUIHandler()` from a `focusin` or `focusout` listener.
- Vue has no `flushSync`. Replace each use with a state write and then `await nextTick()` before paint, or with a direct DOM write.
- Each such replacement has a test that counts animation frames.
- The transition status runs on a `flush: 'sync'` watcher. It replaces a state write during render.
- The popup tree is the only link between a teleported child popup and its parent.
- An outside press and a focus-out treat the popup of a descendant node as inside.
- Under `KeepAlive`, a part keeps its state. In `onDeactivated` it releases the scroll lock, the modal marks, the document listeners and the timers. In `onActivated` it takes them back.
- Do not use the Vue `<Transition>` component. CSS drives animation through `data-starting-style`, `data-ending-style` and `getAnimations()`, as upstream.

### What stays from Base UI

- Use the ports of upstream's `useTimeout` and `useAnimationFrame`. Do not call `setTimeout` or `requestAnimationFrame` directly.
- Use the shadow DOM-safe helpers for DOM traversal and event targets: `closest`, `contains`, `getTarget` and `activeElement`.
- Write development checks as `process.env.NODE_ENV !== 'production'`.
- When a demo style sheet has `user-select: none`, it also has `-webkit-user-select: none` for Safari.

### Error messages

Each error message of the package says three things:

1. What occurred.
2. Why it is a problem.
3. How to correct it.

Example:

```text
Vase UI: <Dialog.Trigger> must be inside <Dialog.Root>. Without a root the trigger has no dialog to open. Put the trigger inside <Dialog.Root>, or pass a `handle`.
```

### Comments

- The code is the documentation. Correct a name or the structure before you add a comment.
- A comment stays only where it gives a reason that the code cannot show.
- Do not write the history of the code in a comment.

## Tests

### Where a test runs

- A test file runs in Chromium, Firefox and WebKit.
- A test file with a name that ends in `.node.test.ts` or `.node.test.tsx` runs in Node with no DOM. Use it for server render and for logic that must work with no DOM.
- There is no jsdom.
- A file with a name that ends in `.spec.ts` or `.spec.tsx` is a type test. vue-tsc checks it, and no test runner runs it.

### How to port a test

A ported test is a file at the mapped path with the same `describe` and `it` titles as upstream. It is TSX, so it differs from the upstream file only by these rules:

| Base UI test                                                             | Vase UI test                  |
| ------------------------------------------------------------------------ | ----------------------------- |
| `from '@base-ui/react/<entry>'`                                          | `from '@vase-ui/vue/<entry>'` |
| `from '@base-ui/react'`                                                  | `from '@vase-ui/vue'`         |
| `className`                                                              | `class`                       |
| `render={<x />}`                                                         | `as`                          |
| A render function                                                        | `v-slots={{ render }}`        |
| `onFocus`, `onBlur`                                                      | `onFocusin`, `onFocusout`     |
| `onChange` on a text input                                               | `onInput`                     |
| An event                                                                 | Add `await`                   |
| An engine condition (`isWebKit`, `platform.engine.gecko`, a Blink check) | No change                     |
| `isJSDOM`                                                                | Always `false`                |
| An `eslint-disable` comment that ESLint reports                          | Remove it                     |

- A case under `skipIf(isJSDOM)` runs.
- A case that upstream runs only in jsdom (`skipIf(!isJSDOM)`) is ported to the browser, or it gets an exception row.
- ESLint reports an `eslint-disable` comment that names a rule of a plugin that this repository does not have. It also reports a comment that disables nothing.

### Test rules

- Use only the Vitest APIs: `expect`, `vi.fn` and the DOM matchers.
- Put one assertion in each `waitFor`.
- Do not put a negative assertion in `waitFor`: it passes on the first try. Advance the timers or flush first, then assert.
- A test must fail when the behaviour in its title breaks. Break the behaviour in the source, make sure that the test fails, then put the source back.
- Assert the start state before the action when the end state can be true already.
- Use the `firePointer` test helper when a test depends on the time of an event.
- Use `it.each` with object rows and `$name` titles for tests that differ only in data.
- A test belongs in the file of the part whose prop or behaviour it asserts.
- For text in a locale format, compute the expected text with the same locale and options as the component.

### Upstream cases that have no matched test

Each upstream test case has a Vase UI test with the same path and title, or an exception row. The rows of a family are in `parity/families/<family>.json`. A row names a case, a `describe` block or a file, and has one of four kinds:

| Kind             | Meaning                                                                  | The row gives                                                                                             |
| ---------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `replaced`       | Another Vase UI test covers the case.                                    | The path of that test and the reason.                                                                     |
| `not-applicable` | The case tests something that only React has.                            | The reason, for example StrictMode, React 17 or 18, `React.lazy`, the React Compiler, or jsdom internals. |
| `engine`         | The case does not run in one engine because of the browser.              | The engine, the reason, and a link to a browser bug or an upstream issue.                                 |
| `waits-on`       | The case renders a family or an upstream path that `main` does not have. | The family or the path.                                                                                   |

- A ported case can add an engine condition only with an `engine` row. A defect of the port never goes there.
- A `waits-on` row is valid only while its target is absent. The pull request that adds the target also adds the tests and removes the rows.

## Text

- Write commit messages, pull requests, code comments and this file in Simplified Technical English (ASD-STE100).
- Use short sentences, the active voice and one instruction in each sentence.
- Give a thing the name of what it is. Do not use metaphors in names.

### Voice

The text that users read has a voice: the README, the site, the documentation and the release notes.

- Dry and short. At most one light line on a page, at the top. Then plain instructions.
- The image is ours: an unstyled library is an empty vase, and you bring the flowers. Use it rarely: the tagline, the home page, the 404 page, release titles.
- Shade is welcome when it aims at the React ecosystem as a whole: it gets every good library first, and Vue waits.
- Shade never aims at a named person, at the quality of a project, at users or at disability. React, Base UI and every other library are included.
- Love goes to the engineers, by name, in the Thanks section.
- A joke never carries a fact. If the line is removed, the page still says everything.
- No wit and no shade in an error or warning message, an accessibility note, an API reference, a migration step or a security note. The same is true for all text that a user reads while something is broken.
- No emoji. No exclamation marks.

Welcome:

- "Base UI, arranged for Vue."
- "Vase UI ships no styles. A vase should not pick your flowers."
- "React gets the good component libraries first. Vue gets to wait. We stopped waiting."
- In release notes: "React had this first. Vue has it now. The usual order, at an unusual speed."
- A release title: "2026.12.0: Dialogs, and what hides behind them."
- The 404 page: "Nothing here. Some vases are empty."

Not welcome:

- "Oops! Your Dialog lost its Root". Write the error message of the example in "Error messages".
- A line about a person, or about how good another project is.
