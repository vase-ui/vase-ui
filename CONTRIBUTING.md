# How to contribute to Vase UI

Vase UI is a port of [Base UI](https://base-ui.com) to Vue 3. The first section tells you how to propose a change. The other sections give the rules of the port to the maintainers and agents that write the code.

The port is in progress. Some rules name a helper that a later pull request adds.

## Start with a Discussion

Mathematic uses AI agents to maintain this repository. A review of an unsolicited pull request usually takes more time than an agent needs to implement an agreed proposal.

If you want to contribute:

1. [Start a Discussion](https://github.com/vase-ui/vase-ui/discussions/new). Describe the problem and your proposed solution.
2. Wait for a Mathematic maintainer to review the proposal. The maintainer decides whether to implement it.
3. If we accept the proposal, a Mathematic maintainer or agent opens the pull request.

The pull request links to the Discussion and credits you as the original author of the proposal.

GitHub restricts pull request creation to Mathematic maintainers, to repository collaborators with write, maintain or admin access, and to authorized maintenance agents. Everyone else uses Discussions.

Issues are off. Report a bug in a Discussion.

Do not report a security problem in a Discussion. Use [GitHub's private vulnerability reporting](https://github.com/vase-ui/vase-ui/security/advisories/new).

## Setup

Install these tools:

- Node.js, at the version in `.node-version`.
- pnpm, at the version in the `packageManager` field of `package.json`. pnpm 10 and later change to that version automatically.

Then install the dependencies and the browsers:

```bash
pnpm install
pnpm --filter @vase-ui/vue exec playwright install chromium firefox webkit
```

| Command                                          | Function                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                      | Runs the tests of the lint rules, of the cost script and of the parity scripts. Then it runs ESLint, the Prettier check and `pnpm cost:check`.                                                                                                                                              |
| `pnpm test:lint-rules`                           | Runs the tests of the lint rules in `eslint.config.js`.                                                                                                                                                                                                                                     |
| `pnpm test:cost`                                 | Runs the tests of the cost script, `scripts/cost/render.ts`.                                                                                                                                                                                                                                |
| `pnpm test:parity`                               | Runs the tests of the parity scripts in `scripts/parity`.                                                                                                                                                                                                                                   |
| `pnpm cost:render`                               | Writes the cost tables of `README.md` from the newest row of `cost/history.json`.                                                                                                                                                                                                           |
| `pnpm cost:check`                                | Fails when the cost tables of `README.md` differ from the newest row of `cost/history.json`.                                                                                                                                                                                                |
| `pnpm parity:check`                              | Checks each family against its extract of Base UI. It also checks the rows of `parity/better`. It reads only the repository.                                                                                                                                                                |
| `pnpm parity:extract --upstream <path> [family]` | Writes `parity/families/<family>.upstream.json` from a local clone of Base UI. With no family name, it writes each extract. With `--check`, it writes nothing and fails when an extract is absent or differs. With `--counts` alone, it prints the counts of Base UI at the tracked commit. |
| `pnpm parity:track <sha> --upstream <path>`      | Writes `parity/upstream.json` for a Base UI commit. The commit must be the tracked commit or a descendant of it.                                                                                                                                                                            |
| `pnpm format`                                    | Formats the files with Prettier.                                                                                                                                                                                                                                                            |
| `pnpm typecheck`                                 | Runs `tsc` on the root `scripts` folder. Then it writes the barrel and runs vue-tsc on the package.                                                                                                                                                                                         |
| `pnpm build`                                     | Builds `packages/vue/dist`.                                                                                                                                                                                                                                                                 |
| `pnpm check:package`                             | Builds the package with two fixture families. It checks that npm packs the license and the notices. Then it checks the result with publint, Are the Types Wrong and a consumer project.                                                                                                     |
| `pnpm test`                                      | Runs all tests.                                                                                                                                                                                                                                                                             |
| `pnpm test:node`                                 | Runs the tests that have no DOM.                                                                                                                                                                                                                                                            |
| `pnpm test:browser`                              | Runs the browser tests in Chromium, Firefox and WebKit.                                                                                                                                                                                                                                     |
| `pnpm test:chromium`                             | Runs the browser tests in Chromium. `test:firefox` and `test:webkit` do the same for their engine.                                                                                                                                                                                          |

To run one test file, add a part of its name: `pnpm test:chromium SinglePart`.

`--upstream <path>` is the path of a local clone of Base UI. The scripts read the clone through git at the commit that they need, so the clone can be at another commit.

### Tool versions

- `typescript` stays at version 6. The parity scripts use its compiler API. The main export of `typescript` 7 gives only its version.
- `vue-component-meta` and `vue-tsc` must have the same version. The two packages then read an SFC with the same `@vue/language-core`.
- `vue-component-meta` has a pnpm patch in `patches`. Without the patch, the package lists no exposed member of an SFC that has `generic`.
- When a release of `vue-component-meta` has the same correction, run `pnpm patch-remove vue-component-meta@3.3.14` and install that release. The test of `pnpm test:parity` for the exposed members of a generic SFC fails when the release lacks the correction.

## Pull requests

- Make one change in each pull request.
- Write the title as a Conventional Commit, with the family folder as the scope: `feat(separator): add Separator`.
- GitHub squashes each pull request, and the title becomes the commit on `main`.
- Write the body in three parts: Why, What and Tests.
- The check `required` must pass.

## Source of the port

- `parity/upstream.json` records the Base UI commit that Vase UI tracks. `pnpm parity:track` writes it.
- `parity/scope.json` lists what Vase UI does not port, each with its reason. It also lists the Base UI paths that are out of scope.
- Port from Base UI at the tracked commit.
- The other sources are the code and documentation of Vue, the web standards, and the libraries that Vase UI depends on.
- A ported file keeps the "Modified" or "@see" comment of its upstream file.

Each family has a file `parity/families/<family>.json`. It has five keys. `pnpm parity:check` refuses a file that lacks one:

| Key                    | Content                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `upstreamPaths`        | The Base UI paths that the family ports, as globs. A family with a docs folder also names that folder: `docs/src/app/(docs)/react/components/<family>/**`, or `docs/src/app/(docs)/react/utils/<family>/**`. |
| `matchedCommit`        | The Base UI commit that the family matches.                                                                                                                                                                  |
| `exceptions`           | The exception rows of the family. See [Exception rows](#exception-rows).                                                                                                                                     |
| `surfaceAdditions`     | The props, emits, slots and exposed members of a part that no Base UI row maps to, each with its reason.                                                                                                     |
| `notApplicableCommits` | The Base UI commits that touch these paths and do not apply to Vue, each with its reason.                                                                                                                    |

- A `surfaceAdditions` row names one member of one part: `{ "entry": "Button", "prop": "disabled", "reason": "…" }`.
- `entry` is the title of the part in the `types.md`. The key of the member is `prop`, `emit`, `slot` or `exposed`.
- A `types.md` has no row for a native attribute that the React part reads, such as `disabled` of Button. The prop of the Vase UI part then needs a `surfaceAdditions` row.
- The extract reads only the `types.md` of the docs folder. Without that folder, `pnpm parity:check` does not compare the props, emits, slots and exposed members of the family.
- A family also names the folder of its context, where upstream has that folder under `internals`: `packages/react/src/internals/direction-context/**`. `pnpm parity:check` then checks the files of the context as part of the family that provides it.

Each family also has an extract, `parity/families/<family>.upstream.json`. It holds the facts of Base UI at `matchedCommit`: the source files, the type tests, the test cases and the rows of each `types.md`.

- `pnpm parity:extract` writes the extract. Do not edit it.
- Run the command after each change of `upstreamPaths` or `matchedCommit`. Commit the extract in the same pull request as the family file.
- CI has no copy of Base UI, so `pnpm parity:check` reads the committed extract.

## Layout and names

| Base UI                       | Vase UI                     |
| ----------------------------- | --------------------------- |
| `packages/react/src/<folder>` | `packages/vue/src/<folder>` |
| `packages/utils/src`          | `packages/vue/src/common`   |
| `packages/react/test`         | `packages/vue/test`         |

- Folder, file and part names are the same as upstream: `dialog/root/DialogRoot.vue`.
- The counterpart of an upstream file is the file at the mapped path with the same name. The counterpart of a `.ts` or `.tsx` file can be a `.ts`, `.tsx` or `.vue` file. The counterpart of a test or a type test must be a `.ts` or `.tsx` file.
- The counterpart of an upstream folder is the folder at the mapped path.
- A file keeps the `BaseUi` or `BaseUI` of its upstream name, because `pnpm parity:check` finds a counterpart by its path: `useBaseUiId.ts`, `createBaseUIEventDetails.ts`. The names in the file change: `useVaseUiId`, `VaseUIChangeEventDetails`.
- The vocabulary is that of upstream's `GLOSSARY.md`: Popup, Root, Trigger, Anchor, Positioner.
- A family is one upstream folder.
- State attributes (`data-open`) and CSS variables keep upstream's names and values. Upstream CSS then works with no change.
- Internal names change `base-ui` to `vase-ui`: `data-vase-ui-*`, `event.preventVaseUIHandler()`, `VASE_UI_ANIMATIONS_DISABLED`, `new Event('vase-ui')`.
- A page can then hold the two libraries, and they do not share markers.
- Messages start with `Vase UI:`.
- Upstream imports `packages/utils/src` as `@base-ui/utils/<file>`. Import `src/common/<file>` by a relative path, such as `../common/owner`.
- `common` is not an entry point, so the built package has no path `@vase-ui/vue/common/<file>`.

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

A family whose upstream folder has no `index.parts.ts` declares the constant and its namespace in `index.ts`. A family whose upstream folder has an `index.parts.ts` keeps that file, also when it has one part. `pnpm parity:check` finds a counterpart by its path.

## API convention

### Parts that render an element

| API                                                              | Function                                                                                                                                                                                                         | Base UI form                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `as` prop: `string \| Component`. The default is upstream's tag. | Sets the element or the component that the part renders.                                                                                                                                                         | `render={<a />}`               |
| `#render` slot with the slot props `{ props, state }`            | Replaces the element. Bind `props` on your element: `<a v-bind="props">`.                                                                                                                                        | `render={(props, state) => …}` |
| Default slot with the slot props `{ state }`                     | Holds the content.                                                                                                                                                                                               | `children`                     |
| `class` and `style` attributes                                   | The part merges them with its own class and style. The class order is `class`, `stateClass`, then the class of the part. For one style property, `stateStyle` wins over `style`, and `style` wins over the part. | `className`, `style`           |
| `stateClass` prop: `(state) => ClassValue`                       | Gives a class that depends on the state.                                                                                                                                                                         | `className` as a function      |
| `stateStyle` prop: `(state) => StyleValue`                       | Gives a style that depends on the state.                                                                                                                                                                         | `style` as a function          |
| `nativeButton` prop, where upstream has it                       | The same as upstream.                                                                                                                                                                                            | `nativeButton`                 |
| Exposed `element`                                                | Gives the DOM element through a template ref.                                                                                                                                                                    | `ref`                          |

- `props` of the `#render` slot holds the attributes, the listeners, the state data attributes, the class, the style and the `ref` setter.
- Under `#render`, the part does not render its default slot. Put the content in your element.
- Your element takes one `ref`. Vue keeps the last `ref` key of an element. It gives no warning.
- If your element needs a ref of your own, call `props.ref` in a function ref: `:ref="(el) => { props.ref(el); own = el }"`.
- The setter must make no change when it gets the same element again. Vue calls a function ref again on each patch.
- In a Vapor component (`<script setup vapor>`), bind the setter by name: `<a v-bind="props" :ref="props.ref">`. Vapor drops the `ref` key of a bound object. It gives no warning.
- A development build shows a warning when a part with a `#render` slot has no element after mount.
- If a consumer gives `as` and `#render`, `#render` wins. A development build shows a warning.
- Vue removes a function that is given as `class`. This is the reason for `stateClass` and `stateStyle`.
- Each part that renders an element sets `defineOptions({ inheritAttrs: false })`. Each attribute and listener goes to the element through `mergeProps`.
- The exported props interface of a part extends `VaseUIComponentProps<State>`. That interface declares `as`, `stateClass` and `stateStyle`.
- The interface also extends the attributes of its default tag through `/* @vue-ignore */`: `interface SeparatorProps extends VaseUIComponentProps<SeparatorState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes>`.
- `WithVaseUIEvent` adds `preventVaseUIHandler()` to the event that each native listener gets.
- TSX and templates then accept the native attributes and listeners, with their types.
- The SFC compiler ignores the extended type, so the run-time props are only the declared props. A native attribute stays in `$attrs`.
- Omit a native attribute that the part declares as a prop: `Omit<ButtonHTMLAttributes, 'disabled'>`.
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
- A part that renders no element has only `<slot />`. It does not set `inheritAttrs`. Vue then shows a warning in a development build when the part gets an attribute or a listener. With `inheritAttrs: false`, Vue drops them and shows nothing.

### Parts with nodes of their own

Some upstream parts put nodes of their own in the element. Examples are the range input of `Slider.Thumb` and the focus guards of `Toast.Viewport`.

- Each such part has one internal SFC, `<Part>Children.vue`.
- That SFC reads the state of the part with `inject`. It renders the nodes around its default slot, in upstream's order.
- The `#render` slot of the part gets a third slot prop, `children`, which is that component.
- A consumer writes `<a v-bind="props"><component :is="children">…</component></a>`.
- A development build shows a warning when the `#render` slot does not mount `children`.
- The part passes `children: true` to `useRenderElement`. `<Part>Children.vue` calls `markChildrenMounted()` in setup. The warning needs the two calls.

<!-- prettier-ignore -->
```vue
<slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="SliderThumbChildren" />
<component :is="as" v-else v-bind="elementProps()"><SliderThumbChildren><slot :state="state" /></SliderThumbChildren></component>
```

### Element targets

One helper, `resolveElement(value)`, changes a value into an element:

- An element stays the same. A ref on a functional component is its root element, so it also stays the same.
- A component that exposes an element as `element` gives that element. Each Vase UI part does this. A wrapper component of a consumer can do it too.
- A component that exposes an empty `element` (`null` or `undefined`) gives `null`, with no warning. Its root element can be the wrong element.
- If `element` has a value that is not an element and not empty, the next rule applies. An example is a string prop with the name `element`.
- Another component gives `$el` when that is an element. If not, the result is `null` and a development build shows a warning.

Rules:

- The `ref` setter of a part calls `resolveElement`. Thus `as="RouterLink"` and `<RouterLink v-bind="props">` work.
- A part calls `resolveElement` again at mount. A component can set its exposed `element` after its render. At mount, the element exists.
- The ref of a component with no `expose` also gives access to its props. If such a component has a prop `element` with no value, `resolveElement` gives `null`.
- A prop that takes an element accepts `MaybeRefOrGetter<Element | ComponentPublicInstance | null>` and upstream's other forms. Examples are `anchor`, `container`, `initialFocus`, `finalFocus` and `collisionBoundary`.
- Find an element by its `nodeType`. Do not use `instanceof`.

### `mergeProps`

`mergeProps(...sets)` is public. It follows upstream's rules with Vue names:

- The rightmost set wins.
- `class` values are joined, rightmost first.
- `style` values are merged, and the rightmost wins.
- `on[A-Z]…` handlers run from right to left. An array of handlers is made flat.
- A falsy handler value in a later set keeps the handler of an earlier set. Vue's own `mergeProps` does the same for `on` keys.
- Code that calls a handler from a props set must accept a function, an array and a falsy value. A consumer can give each of them. The call `false?.()` throws.
- A set can be a function `(merged) => props`.
- `ref` is not merged.
- An event is an object that has `preventDefault`. Do not use `instanceof`.

### `useRenderElement` and `useRender`

- Each part that renders an element calls the internal composable `useRenderElement` in setup. It returns `element`, which the part exposes, and the function `elementProps`.
- Upstream's `useRenderElement` has a parameter `enabled`. The Vue composable has none, because the template decides if the part renders an element.
- A part that renders no element in some state uses `v-if` in its template. The template then does not call `elementProps()`.
- `useRender` is public. It gives the API of a part to a component of a consumer.

### Props

- Declare an optional prop as `x?: T | undefined`, as upstream does. A consumer that sets `exactOptionalPropertyTypes` can then pass `undefined`.
- Upstream types some Boolean props with a generic parameter, such as `multiple?: Multiple | undefined`. Declare such a prop as `multiple?: (Multiple & boolean) | undefined`.
- The SFC compiler then writes `type: Boolean`, so a bare `multiple` is `true`. For `Multiple` alone, it writes `type: null`, so a bare `multiple` is the string `''`, which is falsy.
- In a union of `boolean` and a string, write `boolean` first: `boolean | 'trap-focus'`. With the string first, a bare attribute is the string `''`.

### State and `v-model`

Upstream has trios such as `open`, `defaultOpen` and `onOpenChange`. For each trio `x`, `defaultX`, `onXChange`:

- The props `x` and `defaultX` keep their names.
- Declare each controlled prop with `default: undefined` through `withDefaults`. Without it, Vue changes an absent Boolean prop to `false`.
- `x !== undefined` means that the part is controlled. A development build shows a warning when the mode changes.
- The part emits `xChange(value, details)` and then `update:x(value)`, synchronously.
- The part does not emit `update:x` when `details.isCanceled` is true.
- To stop a change, call `details.cancel()` before the listener returns. The part reads `isCanceled` at that time, so a call after an `await` has no effect.
- Do not throw to stop a change. A listener that throws stops `update:x` only where Vue throws the error again. Vue throws the error again only in a development build, or in a production build where `app.config.throwUnhandledErrorInProduction` is `true`. Vue does not throw it again when `app.config.errorHandler` or an ancestor `errorCaptured` hook that returns `false` handles the error. Where Vue does not throw the error again, the part emits `update:x`.
- A consumer writes `v-model:open`, `v-model:value`, `v-model:checked` or `v-model:pressed`. There is no `modelValue` alias.
- One composable does this: `useControlled({ controlled: () => props.x, default: () => props.defaultX, name })`.
- `default` is a getter. A development build then shows a warning when the default of an uncontrolled part changes.
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
- `update:x` exists only where the part has a prop `x`. `Accordion.Item` emits `openChange` and has no prop `open`, so it has no `update:open`.
- A callback whose result the component uses stays a function prop: `validate`, `format`, `getAriaValueText`, `filter`, `itemToStringValue`, `isItemEqualToValue`, `initialFocus`, `finalFocus`.

### Actions, handles, slots, composables and ids

- `actionsRef` becomes methods that the part exposes. A consumer reads them through a template ref.
- Popup roots expose `close()` and `unmount()`. `Field.Root` exposes `validate()`. `Form` exposes `validate(name?)`. The types are `DialogRootActions` and so on.
- A ref prop of upstream (`inputRef`) becomes an exposed element (`inputElement`) beside `element`.
- Handles are upstream's objects, with no change: `Dialog.createHandle<Payload>()`, `handle`, `payload`, `triggerId`, `open()`, `openWithPayload()`, `close()`, `isOpen`.
- Function children become a default scoped slot with named props: `{ payload }` on a root, `{ validity }` on `Field.Validity`, `{ item, index }` on list parts, `{ value }` on `Select.Value`.
- Type the slots with `defineSlots`. Write each slot except `#render` as a method, as the Vue documentation does: `default(props: { state: ButtonState }): unknown`. A slot with no slot props is `default(): unknown`. A root with a value type uses `generic="Value"`.
- Write the `#render` slot as a property with the shared type: `render: ComponentRenderFn<HTMLProps, ButtonState>`. A part with the `children` slot prop writes a method with the three slot props, because `ComponentRenderFn` has no `children`.
- Hooks keep their names as composables: `useDirection`, `useRender`, `Toast.useToastManager`, `Combobox.useFilter`.
- Where an upstream hook returns a value that can change, the composable returns a `ComputedRef` of that value: `useDirection()` returns `ComputedRef<TextDirection>`. `setup` runs one time, so a plain value does not follow a change. Read `.value` where the code uses the value. Do not make a copy of it in `setup`.
- Where upstream calls `useBaseUiId`, call `useVaseUiId(() => props.id)` in setup. It gives the `id` prop, or a generated id with the prefix `vase-ui-`. The ids of the parts derive from the id of the root.

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
- Hydration must give no warning. The hydrated DOM must be equal to a client-only render. Vue does not compare `aria-*`, `role` or `data-*`.
- One internal SFC, `PrehydrationScript`, renders each prehydration script. It renders the script only while the part hydrates.
- Add `data-allow-mismatch` to each element that the script changes, with the category of each change, such as `style`. Vue accepts a class, style or attribute mismatch only on the element that has the attribute with that category.
- The part binds the attribute only while it hydrates, so the hydrated DOM stays equal to a client-only render.
- A portal renders after mount. It does not render while the popup is closed, unless `keepMounted` is set.

### What Vue replaces

- Vue reactivity replaces upstream's `Store`, `ReactStore`, `useStore`, `fastHooks` and `createSelector`.
- A popup store is `shallowReactive` state, `computed` selectors and a plain `context`. Each root makes one.
- `useId` gives the ids.
- `Teleport` puts a popup into a container node that the portal makes in `onMounted`. It has no `defer`, because the node exists before the `Teleport` renders.
- Each context has a plain `Symbol()` key for `provide` and `inject`. Each copy of the library then has its own contexts.
- Only three registries are shared between copies, on `Symbol.for` keys: the scroll-lock count, the modal marks and the Escape stack.
- Each shared registry is a plain object with a `version` field. Fields are only added.
- Direction and CSP stay as `DirectionProvider` and `CSPProvider`. There is no global configuration provider.

### DOM event names

A handler key of a DOM event is `on` plus the DOM event name with one capital. Vue makes the event name from the key with `hyphenate`, so `onKeyDown` listens to `key-down`. No browser sends that event. Vue gives no warning.

| React                              | Vue                                               |
| ---------------------------------- | ------------------------------------------------- |
| `onKeyDown`                        | `onKeydown`                                       |
| `onPointerDown`                    | `onPointerdown`                                   |
| `onMouseMove`                      | `onMousemove`                                     |
| `onDoubleClick`                    | `onDblclick`                                      |
| `onContextMenu`                    | `onContextmenu`                                   |
| `onFocus`, `onBlur`                | `onFocusin`, `onFocusout`                         |
| `onChange` on a text input         | `onInput`                                         |
| `onKeyDownCapture`                 | `onKeydownCapture`. The `Capture` suffix stays.   |
| `onOpenChange` (a component event) | `onOpenChange`. A component event keeps its name. |

- The rule applies to the handler keys of a part and to a ported test.
- React implements `onFocus` and `onBlur` with `focusin` and `focusout`.
- React calls `onChange` of a text input on each `input` event.
- To stop the focus handler of a part, call `event.preventVaseUIHandler()` from a `focusin` or `focusout` listener.
- ESLint reports a React name from a fixed list, with or without the `Capture` suffix. It reports an object key, a property read and a JSX attribute in script, in `packages/vue/src`, in test files and in `packages/vue/test`. It does not read a template.
- The lint rule has a fixed list of names, because a pattern for a second capital also matches a component event, such as `onOpenChange`.
- The list does not have `onFocus`, `onBlur` and `onChange`. Each is a valid Vue key with another meaning.

### What differs from the React source

- Vue has no `flushSync`. Replace each call with one of two forms.
- If the next line does not read the DOM, write the state and nothing else. Vue queues its flush as a microtask. A microtask runs before the next paint.
- If the next line reads the DOM or moves focus, write the state and `await nextTick()`. Then run the next line. Each replacement of this form must have a test of its own.
- In an event handler, call `preventDefault` and `stopPropagation` before the first `await`. A handler returns at its first `await`. The browser then completes the dispatch of the event.
- The transition status runs on a `flush: 'sync'` watcher. It replaces a state write during render.
- `useTransitionStatus` reads layout one time (`void element.offsetHeight`) after the DOM update that applies `data-starting-style`. It then removes the attribute in the next animation frame, as upstream.
- Without that read, Vue removes the attribute before the first style computation. The enter transition then does not start.
- React adds `px` to a number in a style object. Vue does not. Write each length that is not zero as a string with its unit, such as `'1px'`.
- An attribute key in a props object is the name in Vue's `HTMLAttributes`, such as `tabindex`. `mergeProps` merges by key, so the `tabindex` of a consumer then replaces the `tabindex` of the part.
- With the key `tabIndex`, the merged props hold two keys. Vue then sets one as a DOM property and one as an attribute.
- A parameter of a composable keeps upstream's name, such as `tabIndex` of `useButton`.
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
- A `.node.test` file does not import `#test-utils`, because that index loads the libraries of the DOM helpers. To render a part, such a file imports `renderToString` from `vue/server-renderer` and the part directly.
- There is no jsdom.
- A file with a name that ends in `.spec.ts` or `.spec.tsx` is a type test. vue-tsc checks it, and no test runner runs it.

### How to port a test

A ported test is a file at the mapped path with the same `describe` and `it` titles as upstream. It is TSX, so it differs from the upstream file only by these rules:

| Base UI test                                                             | Vase UI test                                                                                                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `from '@base-ui/react/<entry>'`                                          | `from '@vase-ui/vue/<entry>'`                                                                                                                                  |
| `from '@base-ui/react'`                                                  | `from '@vase-ui/vue'`                                                                                                                                          |
| `from '@base-ui/utils/<file>'`                                           | A relative path to `src/common/<file>`                                                                                                                         |
| `from '@mui/internal-test-utils'`                                        | `from '#test-utils'`                                                                                                                                           |
| `className`                                                              | `class`                                                                                                                                                        |
| `tabIndex` as a prop or as a key of a props object                       | `tabindex`. An assertion on the DOM property keeps `tabIndex`.                                                                                                 |
| `render={<x />}`, an element with no props                               | `as`                                                                                                                                                           |
| `render={<x a={b} />}`, an element with props of its own                 | `v-slots={{ render }}`. The function returns `<x {...props} a={b} />`, with the own props after the spread.                                                    |
| A render function                                                        | `v-slots={{ render }}`. Give its parameter a type. Move the children of the part into the element that it returns.                                             |
| A function as children: `<Part>{(args) => …}</Part>`                     | `v-slots={{ default: (args: Type) => … }}`                                                                                                                     |
| A handler key of a DOM event, such as `onKeyDown`                        | The Vue key, such as `onKeydown`. See [DOM event names](#dom-event-names).                                                                                     |
| A `Capture` listener on an element, such as `onClickCapture={fn}`        | A spread: `{...{ onClickCapture: fn }}`                                                                                                                        |
| `{ nativeEvent: new MouseEvent('click') }`                               | `new MouseEvent('click')`                                                                                                                                      |
| `ref` on the outermost vnode, or on a child of a plain element           | A function for `render`: `render(() => <Button ref={ref} />)`                                                                                                  |
| A `Wrapper` that forwards a ref                                          | A `Wrapper` that exposes `element`                                                                                                                             |
| `React.createRef()` and `ref.current`                                    | A function ref that writes a variable, or a `shallowRef`. A ref on a part gives the component, so read its `element`.                                          |
| `useMergedRefs(a, b)`                                                    | A function ref that calls each ref                                                                                                                             |
| `React.useState` in a test component                                     | A `shallowRef` in the setup function of `defineComponent`                                                                                                      |
| `React.lazy(loader)`                                                     | `defineAsyncComponent(loader)`, then `await flushMicrotasks()` before the assertions                                                                           |
| `act(fn)`                                                                | `fn()`, then `await flushMicrotasks()`                                                                                                                         |
| `renderHook(() => useX())`                                               | A component in the test that calls the composable in `setup` and gives the result to the test                                                                  |
| A function component that calls a hook and spreads the rest of its props | `defineComponent` with a setup function that returns the render function. Declare the props that the hook reads. Set `inheritAttrs: false` and spread `attrs`. |
| `renderToString` of the renderer, with no `hydrate()`                    | A case in the `.node.test.tsx` file of the same folder, with `renderToString` of `vue/server-renderer`. Give the upstream case a `replaced` row.               |
| `renderToString` of the renderer, then `hydrate()`                       | The case stays in the ported test file with the same title, so it needs no row. Use `renderOnServer` and `hydrate`, which need a browser.                      |
| `expect(fn).toErrorDev(message)` or `.toWarnDev(message)`                | A spy on `console.error` or `console.warn`. Call `fn`, then assert the call and its message. The message starts with `Vase UI:`.                               |
| `childNodes`, `firstChild` or `nextSibling` on the element of a part     | `children` or `querySelector`                                                                                                                                  |
| A number as a length in a style object, such as `top: 1`                 | A string with its unit, such as `top: '1px'`                                                                                                                   |
| An event                                                                 | Add `await`                                                                                                                                                    |
| An engine condition (`isWebKit`, `platform.engine.gecko`, a Blink check) | No change                                                                                                                                                      |
| `isJSDOM`                                                                | Always `false`                                                                                                                                                 |
| An `eslint-disable` comment that ESLint reports                          | Remove it                                                                                                                                                      |

- TypeScript cannot infer the type of the parameter of a `v-slots` function.
- Vue's JSX types declare no `Capture` attribute. Vue reads the suffix at run time.
- A Vue handler gets the DOM event. It has no `nativeEvent`.
- Vue binds a `ref` to the component whose render function makes the vnode. A vnode from the body of a test has no such component, so Vue drops its `ref`.
- Vue has no ref forwarding. `resolveElement` reads the `element` that the `Wrapper` exposes.
- `act` is a React function. `flushMicrotasks` is one of the test helpers.
- Vue puts empty text nodes around a fragment. `childNodes` has them. `children` does not.
- A case under `skipIf(isJSDOM)` runs.
- A case that upstream runs only in jsdom (`skipIf(!isJSDOM)`) is ported to the browser, or it gets an exception row.
- ESLint reports an `eslint-disable` comment that names a rule of a plugin that this repository does not have. It also reports a comment that disables nothing.
- `#test-utils` is `packages/vue/test/index.ts`. It replaces the `#test-utils` and `@mui/internal-test-utils` of upstream.
- `toErrorDev` and `toWarnDev` are custom matchers of upstream. For `.not.toErrorDev()`, assert that the spy got no call.
- `renderHook` is a function of `@testing-library/react`. A composable needs the `setup` of a component.
- Without `inheritAttrs: false`, Vue also puts the attributes on the root element of the test component. Each listener then runs two times.
- `createRenderer()` has no `renderToString`. A server render runs in Node with no DOM.
- A row for a `describe` block also covers each case of the block that has no counterpart. Use that row only when each case of the block moves to the `.node.test.tsx` file. `useButton` does this for `server-side rendering`.
- Vue renders an async component after its loader resolves. `flushMicrotasks` waits for that render.

### Test helpers

This section is the contract of the test helpers. Each helper must obey it. The helpers keep upstream's names.

- `createRenderer()` returns `{ render }`.
- `render` takes a vnode or a function that returns a vnode. It resolves to the queries, `container`, `unmount`, `user`, `rerender` and `setProps`.
- `render` mounts the vnode with `createApp`. The helpers do not use `@testing-library/vue`, because it depends on another version of `@testing-library/dom`.
- `user` is `userEvent.setup({ document })` of `@testing-library/user-event`, at the version that upstream pins.
- After a mount, a `rerender` or a `setProps`, the helper waits until `Date.now()` gives a later millisecond. Vue skips the second and later listeners of an event that occurs in the millisecond when Vue attached them.
- Under fake timers, the helper does not wait. It moves the fake clock by 1 ms and runs no timer, because a fake clock does not move by itself.
- `fireEvent` is a function of the test helpers. It dispatches the event, waits for `nextTick()` and returns the result of the dispatch. Upstream tests read that result, which is `false` when a listener prevents the default action.
- `flushMicrotasks` resolves in the next task. Each flush that Vue queued is then complete.
- `describeConformance` has no hydration case. A server render needs the path of a module. The suite gets a vnode. The test of a part calls the hydration helpers.
- The `render` option of `describeConformance` can call the `render` of `createRenderer()` and then make an assertion. Each case of the suite then makes that assertion.

The hydration helpers:

- `renderOnServer(file, props)` resolves to the server HTML of a component. `file` is the path of a Vue file from the root of the package, such as `test/fixtures/PlainPart.vue`.
- The render runs in Node with no DOM, as a server makes it. A Vue warning in that render fails the test.
- `hydrate(component, { serverHtml, props })` hydrates that HTML. The rules below are its contract.
- It inserts the HTML with `Range.createContextualFragment`, because `innerHTML` does not run an inline script.
- Its `warnHandler` collects the warnings and does not throw. After a `warnHandler` throws, Vue gives no more warnings on that page.
- It records each call to `console.warn` and `console.error` during the whole test. Vue writes some hydration messages only to the console.
- After mount and two ticks, it fails the test on a Vue warning or a console call. It also fails the test when the hydrated DOM differs from a client-only render.
- The comparison ignores comments, the order of the attributes and the format of `style`.

### Test rules

- Use only the Vitest APIs: `expect`, the functions of `vi`, such as `vi.fn` and `vi.spyOn`, and the DOM matchers.
- The DOM matchers are the matchers of `@testing-library/jest-dom`, as in Base UI. A ported assertion then has the same meaning.
- `test/setup.ts` loads them only in the browser projects. The matchers use `css.escape`, which defines the global `CSS`. A server has no such global, so a `.node.test` file has no DOM matchers.
- `toHaveTextContent` passes when the text contains the string. To compare the whole text, use `expect(element.textContent).toBe(text)`.
- Give a DOM matcher an element, not a Vitest locator.
- Put one assertion in each `waitFor`.
- Do not put a negative assertion in `waitFor`: it passes on the first try. Advance the timers or flush first, then assert.
- A test must fail when the behavior in its title breaks. Break the behavior in the source, make sure that the test fails, then put the source back.
- Assert the start state before the action when the end state can be true already.
- Use the `firePointer` test helper when a test depends on the time of an event.
- Use `it.each` with object rows and `$name` titles for tests that differ only in data.
- A test belongs in the file of the part whose prop or behavior it asserts.
- For text in a locale format, compute the expected text with the same locale and options as the component.
- `pnpm parity:check` reads the test files in `packages/vue` with the TypeScript parser. On `it`, `test` and `describe` it accepts only these modifiers: `skipIf`, `runIf`, `each`, `for`, `skip` and `todo`.
- It refuses `.only`. It also refuses each other modifier, such as `it.concurrent` or `test.extend(…)`, and a table in a tagged template. It cannot read these forms. Write a table as an array.

### Exception rows

`pnpm parity:check` compares each family with its extract. Each upstream thing in this table needs its counterpart or an exception row:

| Upstream thing                                             | Counterpart in Vase UI                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A source file or a type test                               | The file at the mapped path. See [Layout and names](#layout-and-names).                                            |
| A test case                                                | A case in the test file at the mapped path, with the same `describe` titles and the same title.                    |
| A call of a shared suite, such as `describeConformance(…)` | The same call in the same `describe` block.                                                                        |
| An entry of a `types.md`, and each row of its props table  | The export of the family, and the prop, emit, slot or exposed member that [API convention](#api-convention) gives. |

The rows of a family are in the `exceptions` list of its family file. A row names one upstream thing. The family files write the fields in this order:

| Field                               | Content                                                                                          | The row has it when                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `upstream`                          | One upstream path that the extract holds.                                                        | Always.                                   |
| `describe`                          | The titles of the `describe` blocks, from the outermost. It is `[]` for a case at the top level. | It names a block, a case or a suite call. |
| `title`                             | The title of the case.                                                                           | It names a case.                          |
| `suite`                             | The name of the function of the suite call.                                                      | It names a suite call.                    |
| `entry`                             | The title of an entry of the `types.md`, such as `Root`.                                         | It names an entry or a prop row.          |
| `prop`                              | The name of a row of the props table of that entry.                                              | It names a prop row.                      |
| `kind`                              | One of the four kinds.                                                                           | Always.                                   |
| `test`, `engine`, `link`, `waitsOn` | See the table of the kinds.                                                                      | The kind needs it.                        |
| `reason`                            | The reason.                                                                                      | Always.                                   |

The thing that a row names decides which kinds the row can have:

| The row names                              | Kinds                                    |
| ------------------------------------------ | ---------------------------------------- |
| A source file                              | `not-applicable`, `waits-on`             |
| A type test, or a suite call               | `replaced`, `not-applicable`, `waits-on` |
| A test file, a `describe` block, or a case | Each of the four kinds                   |
| An entry of a `types.md`, or a prop row    | `not-applicable`, `waits-on`             |

| Kind             | Meaning                                                                                                                  | The row gives                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `replaced`       | Another Vase UI test covers the thing.                                                                                   | `test`: the path of that test.                                                                                                                                                             |
| `not-applicable` | The thing is for something that only React has. The kind also covers an upstream file that no Base UI component imports. | Only the reason. Examples are StrictMode, React 17 or 18 and the React Compiler. More examples are the lazy wrapper of the React Flight client, jsdom internals and a file with no import. |
| `engine`         | The case does not run in one engine because of the browser.                                                              | `engine`: `chromium`, `firefox` or `webkit`. `link`: an `https://` link to a browser bug or an upstream issue.                                                                             |
| `waits-on`       | The thing waits for an upstream file or folder that has no counterpart on `main`.                                        | `waitsOn`: that upstream path, with no `/` at its end. A row that names a source file has no `waitsOn`, because it waits for the file itself.                                              |

- A row that names a source file also covers the cases in that file.
- A ported case can have `skipIf`, `runIf`, `skip` or `todo` only where the upstream case has a condition, or with an `engine` row. A defect of the port never goes there.
- A `waits-on` row is valid only while its target is absent. The pull request that adds the target also adds the tests and removes the rows.
- `pnpm parity:check` fails on a row that covers nothing. Remove a row when its thing gets a counterpart.

### Rows of `parity/better`

Each behavior where Vase UI does more than Base UI has a file `parity/better/<ID>.json`:

| Key        | Content                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`       | `BUG-<number>` for the correction of a Base UI issue, with the number of the issue. `VUE-<number>` for a behavior that is specific to the Vue port. The file name is the id plus `.json`. |
| `evidence` | One or more `https://` links. Each link is an issue, a pull request, a standard, a Vue documentation page, or a line of source at a tag or a commit.                                      |
| `behavior` | What Vase UI does.                                                                                                                                                                        |
| `dueWith`  | One upstream path, with no `/` at its end. The row is due when the path has a counterpart.                                                                                                |

- A due row needs a test. The title of that test or of its `describe` block must hold the id as a whole word: `VUE-1: the controlled Boolean prop`.
- `pnpm parity:check` fails on a due row that has no such title.

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
