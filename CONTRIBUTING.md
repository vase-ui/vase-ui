# How to contribute to Vase UI

Vase UI is a port of [Base UI](https://base-ui.com) to Vue 3. The first section says what is open to people outside the project. The other sections give the rules of the port to the maintainers and agents that write the code.

The port is in progress. Some rules name a helper that a later pull request adds.

## Contributions are closed for now

Mathematic uses AI agents to maintain this repository. While the port is in progress, the repository takes no contributions from outside.

- Issues and Discussions are off.
- GitHub lets only repository collaborators and authorized maintenance agents open a pull request or write a comment.
- To follow the work, watch the repository. Each pull request is one step of the port.

Do not report a security problem in public. Use [GitHub's private vulnerability reporting](https://github.com/vase-ui/vase-ui/security/advisories/new).

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
| `pnpm lint`                                      | Runs the tests of the lint rules and of the cost, parity, documentation, thanks and release scripts. Then it runs ESLint, the Prettier check, `pnpm cost:check` and `pnpm status:check`.                                                                                                    |
| `pnpm test:lint-rules`                           | Runs the tests of the lint rules in `eslint.config.js`.                                                                                                                                                                                                                                     |
| `pnpm test:cost`                                 | Runs the tests of the cost script, `scripts/cost/render.ts`.                                                                                                                                                                                                                                |
| `pnpm test:parity`                               | Runs the tests of the parity scripts in `scripts/parity`.                                                                                                                                                                                                                                   |
| `pnpm test:docs`                                 | Runs the tests of the documentation scripts in `scripts/docs`.                                                                                                                                                                                                                              |
| `pnpm test:thanks`                               | Runs the tests of the thanks script, `scripts/thanks/render.ts`. It also fails when `THANKS.md` has text that the script does not write.                                                                                                                                                    |
| `pnpm test:release`                              | Runs the tests of the release script, `scripts/release/checkTag.ts`.                                                                                                                                                                                                                        |
| `pnpm cost:render`                               | Writes the cost tables of `README.md` from the newest row of `cost/history.json`.                                                                                                                                                                                                           |
| `pnpm cost:check`                                | Fails when the cost tables of `README.md` differ from the newest row of `cost/history.json`.                                                                                                                                                                                                |
| `pnpm status:render`                             | Writes the status line of `README.md` from the family files in `parity/families` and from `parity/upstream.json`.                                                                                                                                                                           |
| `pnpm status:check`                              | Fails when the status line of `README.md` differs from the line that `pnpm status:render` writes.                                                                                                                                                                                           |
| `pnpm thanks:render`                             | Writes `THANKS.md` from GitHub's contributor lists of Base UI, Floating UI and aria-hidden. It uses your `gh` login.                                                                                                                                                                        |
| `pnpm parity:check`                              | Checks each family against its extract of Base UI. It also checks the rows of `parity/better`. It reads only the repository.                                                                                                                                                                |
| `pnpm parity:extract --upstream <path> [family]` | Writes `parity/families/<family>.upstream.json` from a local clone of Base UI. With no family name, it writes each extract. With `--check`, it writes nothing and fails when an extract is absent or differs. With `--counts` alone, it prints the counts of Base UI at the tracked commit. |
| `pnpm parity:track <sha> --upstream <path>`      | Writes `parity/upstream.json` for a Base UI commit. The commit must be the tracked commit or a descendant of it.                                                                                                                                                                            |
| `pnpm docs:demos --upstream <path> [family]`     | Writes the demo style sheets of a family and the record `docs/demos/<family>/upstream.json` from a local clone of Base UI. With no family name, it does this for each family with a page or a demo folder. With `--check`, it writes nothing and fails when a file is absent or differs.    |
| `pnpm format`                                    | Formats the files with Prettier.                                                                                                                                                                                                                                                            |
| `pnpm typecheck`                                 | Runs `tsc` on the root `scripts` folder. Then it writes the barrel and runs vue-tsc on the package.                                                                                                                                                                                         |
| `pnpm build`                                     | Builds `packages/vue/dist`.                                                                                                                                                                                                                                                                 |
| `pnpm check:package`                             | Builds the package with the fixture families and packs it through `prepack`. It fails when the pack lacks the license, notices or readme. It runs publint, Are the Types Wrong and a consumer project. The project fails when a prehydration script is in a client bundle or not in Node.   |
| `pnpm release:check-tag <tag>`                   | Fails when the tag is not `v` plus the version in `packages/vue/package.json`, or when that version does not have the form `YYYY.M.MICRO`.                                                                                                                                                  |
| `pnpm docs:typecheck`                            | Runs vue-tsc on the site configuration, the site components, the data loaders, the code samples and the demos in `docs`.                                                                                                                                                                    |
| `pnpm docs:build`                                | Builds the site into `docs/.vitepress/dist`. It fails when the check of `pnpm parity:check` fails. `pnpm docs:preview` then serves the built site.                                                                                                                                          |
| `pnpm docs:dev`                                  | Starts the development server of the site.                                                                                                                                                                                                                                                  |
| `pnpm --filter @vase-ui/nuxt-fixture dev`        | Starts the development server of the Nuxt fixture, `fixtures/nuxt`. Run `pnpm build` first.                                                                                                                                                                                                 |
| `pnpm --filter @vase-ui/nuxt-fixture typecheck`  | Runs `nuxt prepare`. Then it runs the vue-tsc of `packages/vue` on the app of the Nuxt fixture. Run `pnpm build` first.                                                                                                                                                                     |
| `pnpm test`                                      | Runs all tests of `packages/vue`. It does not run `pnpm test:nuxt`.                                                                                                                                                                                                                         |
| `pnpm test:node`                                 | Runs the tests that have no DOM.                                                                                                                                                                                                                                                            |
| `pnpm test:browser`                              | Runs the browser tests in Chromium, Firefox and WebKit.                                                                                                                                                                                                                                     |
| `pnpm test:chromium`                             | Runs the browser tests in Chromium. `test:firefox` and `test:webkit` do the same for their engine.                                                                                                                                                                                          |
| `pnpm test:nuxt`                                 | Runs the tests of the Nuxt fixture, `fixtures/nuxt`, in Chromium. It tests a production build and then the development server. Run `pnpm build` first.                                                                                                                                      |

To run one test file, add a part of its name: `pnpm test:chromium SinglePart`.

`--upstream <path>` is the path of a local clone of Base UI. The scripts read the clone through git at the commit that they need, so the clone can be at another commit.

The site imports the built package. Run `pnpm build` before `pnpm docs:typecheck`, `pnpm docs:build` or `pnpm docs:dev`.

### Tool versions

- `typescript` stays at version 6. The parity scripts use its compiler API. The main export of `typescript` 7 gives only its version.
- `vue-component-meta` and `vue-tsc` must have the same version. The two packages then read an SFC with the same `@vue/language-core`.
- `vue-component-meta` has a pnpm patch in `patches`. Without the patch, the package lists no exposed member of an SFC that has `generic`.
- When a release of `vue-component-meta` has the same correction, run `pnpm patch-remove vue-component-meta@3.3.14`. Then install that release. The test of `pnpm test:parity` for the exposed members of a generic SFC fails when the release lacks the correction.
- `@vue/language-core` has a pnpm patch in `patches`. Without the patch, the package changes `//` in an attribute value of a component into a comment in the generated code. The type check of that template then fails.
- The patch is the correction of [vuejs/language-tools#6241](https://github.com/vuejs/language-tools/pull/6241). When a release of `@vue/language-core` has the correction, run `pnpm patch-remove @vue/language-core@3.3.14`. Then install the `vue-tsc` and `vue-component-meta` of that release. The sample `docs/examples/type-check/AbsoluteUrlAttribute.vue` fails `pnpm docs:typecheck` when the release lacks the correction.
- `vitepress` stays at exactly `2.0.0-alpha.21`, a prerelease. The stable release, 1.6.4, installs a second Vite from the 5.x line. `pnpm audit` lists advisories for that line, and no 5.x release corrects them. The prerelease uses the Vite of `packages/vue`. Install the stable 2.0 release when VitePress publishes it.
- The workspace denies the install script of `esbuild` with the `allowBuilds` entry `esbuild: false`. The release job `stage` also installs `esbuild`, as an optional peer of `vite` in `packages/vue`. That job can get an OIDC token. Keep the entry `false`.
- The lowest version of Vue that the package supports is 3.5.12. Before that version, `useId` can give different ids on the server and in the browser below a component that has `onServerPrefetch` ([vuejs/core#12128](https://github.com/vuejs/core/pull/12128)).
- The peer range in `packages/vue/package.json`, the job `test-vue-floor` of CI and `docs/quick-start.md` hold that version. Change them together. The job installs that version and runs `pnpm test:node` and `pnpm test:chromium`.

## Pull requests

- Make one change in each pull request.
- Write the title as a Conventional Commit, with the family folder as the scope: `feat(separator): add Separator`.
- GitHub squashes each pull request, and the title becomes the commit on `main`.
- Write the body in three parts: Why, What and Tests.
- The check `required` must pass.

## Source of the port

- `parity/upstream.json` records the Base UI commit that Vase UI tracks. Its key `components` lists the folders of `docs/src/app/(docs)/react/components/` at that commit. `pnpm parity:track` writes the file.
- `parity/scope.json` lists what Vase UI does not port, each with its reason. It also lists the Base UI paths that are out of scope.
- Port from Base UI at the tracked commit.
- The other sources are the code and documentation of Vue, the web standards, and the libraries that Vase UI depends on.
- A ported file keeps the "Modified" or "@see" comment of its upstream file.

Each family has a file `parity/families/<family>.json`. It has six keys. `pnpm parity:check` refuses a file that lacks one:

| Key                     | Content                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `upstreamPaths`         | The Base UI paths that the family ports, as globs. A family with a docs folder also names that folder: `docs/src/app/(docs)/react/components/<family>/**`, or `docs/src/app/(docs)/react/utils/<family>/**`. |
| `matchedCommit`         | The Base UI commit that the family matches.                                                                                                                                                                  |
| `exceptions`            | The exception rows of the family. See [Exception rows](#exception-rows).                                                                                                                                     |
| `surfaceAdditions`      | The props, emits, slots and exposed members of a part that no Base UI row maps to, each with its reason.                                                                                                     |
| `returnTypeDifferences` | The functions that return a different type from the type that Base UI documents, each with the Vase UI type and the reason.                                                                                  |
| `notApplicableCommits`  | The Base UI commits that touch these paths and do not apply to Vue, each with its reason.                                                                                                                    |

- A `surfaceAdditions` row names one member of one part: `{ "entry": "Button", "prop": "disabled", "reason": "…" }`.
- `entry` is the title of the part in the `types.md`. The key of the member is `prop`, `emit`, `slot` or `exposed`.
- A `types.md` has no row for a native attribute that the React part reads, such as `disabled` of Button. The prop of the Vase UI part then needs a `surfaceAdditions` row.
- A `types.md` can also have a prop row for a native attribute that the React part does not read. An example is `aria-valuetext` of `Progress.Root`. Do not declare that prop: the attribute goes to the element through `$attrs`, with its type from `HTMLAttributes`. Give the row a `not-applicable` exception row.
- A `returnTypeDifferences` row names one function: `{ "entry": "useDirection", "returns": "ComputedRef<TextDirection>", "reason": "…" }`.
- `entry` is the title of the function in the `types.md`. `returns` is the return type of the Vase UI function, as `pnpm parity:check` prints it.
- `pnpm parity:check` fails on a difference when no row gives the Vase UI type and no exception row names the entry. It also fails on a stale row.
- A row is stale when Vase UI returns the type that Base UI documents. It is also stale when the extract has no return value for the entry. It is also stale when an exception row names the entry and `returns` is not the type that Vase UI returns.
- The extract reads the rows of the surface only from the `types.md` of the docs folder. Without that folder, `pnpm parity:check` does not compare the props, emits, slots, exposed members and return types of the family.
- A family also names the folder of its context, where upstream has that folder under `internals`: `packages/react/src/internals/direction-context/**`. `pnpm parity:check` then checks the files of the context as part of the family that provides it.

Each family also has an extract, `parity/families/<family>.upstream.json`. It holds the facts of Base UI at `matchedCommit`: the source files, the type tests, the test cases and the rows of each `types.md`. It also holds the `<Types…>` tags of each `page.mdx`, in their sequence.

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
- Internal names change `base-ui` to `vase-ui`: `data-vase-ui-*`, `event.preventVaseUIHandler()`, `VASE_UI_ANIMATIONS_DISABLED`, `new Event('vase-ui')`, the class `vase-ui-disable-scrollbar`.
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
- A development build shows a warning when the `#render` slot of a part gives no element.
- The part makes the check after each render in which the slot appears. A part with no element at mount thus gets the check when it renders its element.
- If a consumer gives `as` and `#render`, `#render` wins. A development build shows a warning.
- Vue removes a function that is given as `class`. This is the reason for `stateClass` and `stateStyle`.
- A part can have declarations that must win over `style` and `stateStyle`. The part gives them to `useRenderElement` as `overridingStyle`, a function that returns a style object or `undefined`. The composable merges the result last. `undefined` or an empty object adds no `style` key.
- `Collapsible.Panel` gives `animation-name: none` and its temporary declarations in this way. See [What differs from the React source](#what-differs-from-the-react-source).
- Each part that renders an element sets `defineOptions({ inheritAttrs: false })`. Each attribute and listener goes to the element through `mergeProps`.
- The exported props interface of a part extends `VaseUIComponentProps<State>`. That interface declares `as`, `stateClass` and `stateStyle`.
- The interface also extends the attributes of its default tag through `/* @vue-ignore */`: `interface SeparatorProps extends VaseUIComponentProps<SeparatorState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes>`.
- `WithVaseUIEvent` adds `preventVaseUIHandler()` to the event that each native listener gets.
- TSX and templates then accept the native attributes and listeners, with their types.
- The SFC compiler ignores the extended type, so the run-time props are only the declared props. A native attribute stays in `$attrs`.
- Omit a native attribute that the part declares as a prop: `Omit<ButtonHTMLAttributes, 'disabled'>`.
- A consumer handler runs before the handler of the part. `event.preventVaseUIHandler()` stops the handler of the part. The exception is a native event that the part declares as an emit. See [Other callbacks](#other-callbacks).
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
- That SFC reads the values that its nodes need with `inject`. `ProgressRootChildren.vue` needs none, so it calls no `inject`.
- It renders the nodes around its default slot, in upstream's order.
- The `#render` slot of the part gets a third slot prop, `children`, which is that component.
- A consumer writes `<a v-bind="props"><component :is="children">…</component></a>`.
- A development build shows a warning when the `#render` slot does not mount `children`. The part makes this check together with the check for the element of the slot.
- The part passes `children: true` to `useRenderElement`. `<Part>Children.vue` calls `markChildrenMounted()` in setup. The warning needs the two calls.

<!-- prettier-ignore -->
```vue
<slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="SliderThumbChildren" />
<component :is="as" v-else v-bind="elementProps()"><SliderThumbChildren><slot :state="state" /></SliderThumbChildren></component>
```

A part whose own node is text, such as `Progress.Value`, has four more rules:

- `<Part>Children.vue` shows the default slot of the consumer when there is one. If there is none, it shows the text. Write the two as one `v-if` chain: `<slot v-if="$slots.default" … />`, then `<template v-else-if="…">{{ text }}</template>`.
- The part gives a default slot to `<Part>Children.vue` only when the consumer has one: `<template v-if="$slots.default" #default="content"><slot v-bind="content" :state="state" /></template>`.
- Do not write an interpolation that can be empty. Do not render a `<slot>` that the consumer did not give. A client-only render then leaves empty text nodes in the element, and `toBeEmptyDOMElement` fails. A `v-if` chain that renders nothing leaves one comment, and the matcher ignores a comment.
- Give `describeConformance` no `childrenSelector` for such a part, because a selector cannot match a text node. Add a case that mounts `children` in the `#render` slot and compares the text.

### Parts with a hidden input

Some upstream parts render a hidden `<input>` beside their element. `Switch.Root` is the model. The input gives the part the form behavior of a native control.

- The part has more than one root node: its element, then its inputs. The inputs are not in the element. An `<input>` in a `<button>` is not valid HTML, and a `#render` slot would have to mount the inputs.
- The template has the two lines of a part. The inputs come after them.
- The input that has the state of the part has one `v-bind` and no other attribute. The `ref` setter is a key of the bound object. With a second attribute, the compiler calls the `mergeProps` of Vue, which makes a new `style` object in each render. See [What differs from the React source](#what-differs-from-the-react-source).
- A part with more than one root node gets no scope id from the component that renders it. A rule of `<style scoped>` thus does not match the element of the part, and `v-show` on the part has no effect. The JSDoc of the part says this. It names `:deep()`, a CSS module, a `style` binding and `v-if`.
- The part declares `aria-label` and `aria-labelledby` as props, because `useAriaLabelledBy` watches them. Each prop gets a `surfaceAdditions` row.
- Vue writes `checked` to an input only when the value changes between two renders. Hydration does not write it. The part thus writes its state to the input after the mount and on each `pageshow` event of the window. Chromium restores the form state of a page after `load`.
- The part also writes its state to the input in the tick after a click that it accepted. A parent that controls the part can keep the old value.
- For a change that a listener cancels, the part calls `preventDefault` on the click of the input. The browser then puts the old state back.
- The part listens to `reset` on the root node of the input, because the form of the input can change. An uncontrolled part goes back to its default value through its change event, with the `reset` event in `details`. A controlled part does not change.

```vue
<slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
<component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
<input v-bind="inputProps()" />
```

### Element targets

One helper, `resolveElement(value)`, changes a value into an element:

- An element stays the same. A ref on a functional component is its root element, so it also stays the same.
- A component that exposes an element as `element` gives that element. Each Vase UI part does this. A wrapper component of a consumer can do it too.
- A component that exposes an empty `element` (`null` or `undefined`) gives `null`, with no warning. Its root element can be the wrong element.
- If the exposed `element` has a value that is not an element and not empty, the next rule applies.
- A prop with the name `element` is not an exposed element. The next rule applies.
- Another component gives `$el` when that is an element. If not, the result is `null` and a development build shows a warning.

Rules:

- The `ref` setter of a part calls `resolveElement`. Thus `as="RouterLink"` and `<RouterLink v-bind="props">` work.
- A part calls `resolveElement` again at mount. A component can set its exposed `element` after its render. At mount, the element exists.
- The ref of a component with no `expose` also gives access to its props. `resolveElement` compares `element` with the prop of that name in `$props`. When the two are the same value, it reads `$el`.
- The SFC compiler adds an empty `expose()` call to a `<script setup>` component with no `defineExpose`. It adds no call when it compiles the template inline, as a production build does. The rule above gives the two builds the same element.
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
- The type argument is the tag of the element: `mergeProps<'button'>`. The sets and the result then have the attributes of that element. With no type argument, a set accepts the attributes of each element, and the type of the result is `NativeElements['div']`: the attributes that each HTML element has.
- A handler in a set gets a `VaseUIEvent`. A listener of the result gets the DOM event. With a type argument, the type of the result is `NativeElements[T]`.
- Vue types a listener of an element as a function of the DOM event. A template thus refuses a bound object whose listeners need a `VaseUIEvent`.

### `useRenderElement` and `useRender`

- Each part that renders an element calls the internal composable `useRenderElement` in setup. It returns `element`, which the part exposes, and the function `elementProps`.
- `useRenderElement` takes its `ref` callbacks one time, in `setup`. It calls a callback only when the element changes. A change of a prop that keeps the element calls none.
- A part that chooses a holder from a prop reads the prop in the callback. A `watch` of the prop moves the element to the other holder. `ScrollAreaScrollbar.vue` is the model.
- A part that takes its orientation from a context clears, in its `ref` callback, each holder that holds its element. Its `watch` does not run when the change removes it with its parent. `ScrollAreaThumb.vue` is the model.
- Upstream's `useRenderElement` has a parameter `enabled`. The Vue composable has none, because the template decides if the part renders an element.
- A part that renders no element in some state uses `v-if` in its template. The template then does not call `elementProps()`.
- `useRender` is public. It gives the API of a part to a component of a consumer.

### Props

- Declare an optional prop as `x?: T | undefined`, as upstream does. A consumer that sets `exactOptionalPropertyTypes` can then pass `undefined`.
- Upstream types some Boolean props with a generic parameter, such as `multiple?: Multiple | undefined`. Declare such a prop as `multiple?: (Multiple & boolean) | undefined`.
- The SFC compiler then writes `type: Boolean`, so a bare `multiple` is `true`. For `Multiple` alone, it writes `type: null`, so a bare `multiple` is the string `''`, which is falsy.
- In a union of `boolean` and a string, write `boolean` first: `boolean | 'trap-focus'`. With the string first, a bare attribute is the string `''`.
- Declare a required prop that can be `null` as `x: T | null`, such as `value` of `Progress.Root`. The SFC compiler then writes `required: true`, and Vue accepts `null` with no warning.
- Do not give a constant of `setup` the name of a prop. The SFC compiler then reports that name as a constant, and `pnpm parity:check` does not find the prop. `ProgressLabel.vue` declares the prop `id`, so its constant is `labelId`.
- A native attribute that a part must watch is a declared prop. The Vue documentation says that `$attrs` is not reactive. `Avatar.Image` declares `src`, `srcset`, `sizes`, `crossorigin` and `referrerpolicy` for this reason.
- A generic SFC is not assignable to `as` of another part. vue-tsc types it as a function that `as` does not accept, so `<Toolbar.Button :as="ToggleGroup">` fails the type check.
- A part that a consumer must be able to give to `as`, such as `Toggle`, is not a generic SFC. It keeps the type parameter on its exported props interface: `ToggleProps<Value extends string = string>`, with `defineProps<ToggleProps>()`. `ToggleGroup` is a generic SFC, because the type of its `valueChange` event follows `Value`.

### State and `v-model`

Upstream has trios such as `open`, `defaultOpen` and `onOpenChange`. For each trio `x`, `defaultX`, `onXChange`:

- The props `x` and `defaultX` keep their names.
- Declare each controlled prop with `default: undefined` through `withDefaults`. Without it, Vue changes an absent Boolean prop to `false`.
- `x !== undefined` means that the part is controlled. A development build shows a warning when the mode changes.
- The part emits `xChange(value, details)` and then `update:x(value)`, synchronously.
- The part does not emit `update:x` when `details.isCanceled` is true.
- To stop a change, call `details.cancel()` before the listener returns. The part reads `isCanceled` at that time, so a call after an `await` has no effect.
- An item whose change also changes its group, such as `Toggle` in `ToggleGroup`, emits in this order: `pressedChange` of the item, `valueChange` and `update:value` of the group, and `update:pressed` of the item. Both change events get the same `details` object. A `details.cancel()` in `pressedChange` stops each later event. A `details.cancel()` in `valueChange` stops `update:value` and `update:pressed`.
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
- A native listener that the part calls itself, after work of its own, is a declared emit. `Form` does this for `submit`: it emits `submit` only when each field is valid. A listener in the attributes would run before that work.
- A part can need to know if a listener exists. `Form` prevents the native submit only when a `formSubmit` listener exists. Such a part declares the emit and also a prop with the `on` name: `onFormSubmit`.
- Vue gives the listener to the prop, and the emit still calls it. Type the prop as a function or an array of functions, because Vue gives the prop an array for two listeners.
- A listener with `.once` has the key `onFormSubmitOnce`. Declare that prop too, and read both props. The emit calls the `.once` listener one time.
- A callback whose result the component uses stays a function prop: `validate`, `format`, `getAriaValueText`, `filter`, `itemToStringValue`, `isItemEqualToValue`, `initialFocus`, `finalFocus`.

### Actions, handles, slots, composables and ids

- `actionsRef` becomes methods that the part exposes. A consumer reads them through a template ref.
- Popup roots expose `close()` and `unmount()`. `Field.Root` exposes `validate()`. `Form` exposes `validate(name?)`. The types are `DialogRootActions` and so on.
- A ref prop of upstream (`inputRef`) becomes an exposed element (`inputElement`) beside `element`.
- Handles are upstream's objects, with no change: `Dialog.createHandle<Payload>()`, `handle`, `payload`, `triggerId`, `open()`, `openWithPayload()`, `close()`, `isOpen`.
- Function children become a default scoped slot with named props: `{ payload }` on a root, `{ validity }` on `Field.Validity`, `{ item, index }` on list parts, `{ value }` on `Select.Value`.
- Type the slots with `defineSlots`. Write each slot except `#render` as a method, as the Vue documentation does: `default(props: { state: ButtonState }): unknown`. A slot with no slot props is `default(): unknown`. A root with a value type uses `generic="Value"`.
- Give the type parameter the default that Base UI gives it: `generic="Value = any"` on `Accordion.Root`. With no default, the handler of a root that has no `value` and no `defaultValue` gets `unknown[]`. Base UI gives `any[]`, and its type test has a line for it.
- Write the `#render` slot as a property with the shared type: `render: ComponentRenderFn<HTMLProps, ButtonState>`. A part with the `children` slot prop writes a method with the three slot props, because `ComponentRenderFn` has no `children`.
- Hooks keep their names as composables: `useDirection`, `useRender`, `Toast.useToastManager`, `Combobox.useFilter`.
- Where an upstream hook returns a value that can change, the composable returns a ref of that value. `setup` runs one time, so a plain value does not follow a change. Read `.value` where the code uses the value. Do not make a copy of it in `setup`.
- The ref is a `ComputedRef` when the composable computes the value: `useDirection()` returns `ComputedRef<TextDirection>`. It is a `Readonly<Ref<T>>` when the composable writes the value: `useTransitionStatus()` returns `mounted` and `transitionStatus` in this form.
- Where an upstream hook returns a props object with a value that can change, the composable returns a `ComputedRef` of that object. Examples are `useLabel()` and `compositeProps` of `useCompositeItem()`. The part reads `.value` in the function that it gives to `useRenderElement` as `props`. `useCompositeRoot` returns a plain object, because its props are only listeners.
- A composable can have an option that is always a function and that must follow a change, such as `matchMedia` of `useMediaQuery(query, options)`. It takes the whole options object as one `MaybeRefOrGetter`. Such a member cannot be a `MaybeRefOrGetter`, because `toValue` calls a function.
- A callback that the composable only calls is a plain function member beside the `MaybeRefOrGetter` members. Examples are `onMapChange` of `useCompositeRoot` and `useCompositeList`, `onComplete` of `useOpenChangeComplete`, `onOpenChange` of `useCollapsibleRoot` and `focusControl` of `useLabel`.
- A composable with many options takes one object. Each option that can change is a `MaybeRefOrGetter`: `useAnchorPositioning({ side: () => props.side, mounted })`. Read an option with `toValue` in a `computed`, in a `watch` or in a callback. Do not keep a plain copy of its value in `setup`.
- An option whose value can be a function, such as `sideOffset`, takes a number, a ref or a getter that returns the value. It does not take a plain function, because `toValue` calls a function. Give the option a type that refuses it: `number | Readonly<Ref<number | OffsetFunction | undefined>> | (() => number | OffsetFunction | undefined)`.
- An option that takes an element in upstream's forms, such as `anchor`, is a source of a value that can itself be a ref or a getter. Read it with `toValue(toValue(option))`. `useAnchorPositioning` does this in `resolveAnchor`, and in `resolveBoundary` for `collisionBoundary`.
- Do not call a getter of the consumer that can read the DOM before the component is mounted. A server render must never call it. Keep a flag that `onMounted` sets, and read the getter only while the flag is set.
- Upstream calls some functions of the consumer only while a popup is mounted, such as the `anchor` function. Read such a getter only while the popup is mounted too. A getter that reads an element that exists only while the popup is open then does not run for a closed popup. A getter that has no such upstream rule, such as the one of `collisionBoundary`, also runs while the popup is closed, after the mount.
- Where upstream calls `useBaseUiId`, call `useVaseUiId(() => props.id)` in setup. It gives the `id` prop, or a generated id with the prefix `vase-ui-`. The ids of the parts derive from the id of the root. The label of a root does not call it, because the root makes the id of the label. See [Server render](#server-render).

## Rules for the source

### Files

- Each part is an SFC with `<script setup lang="ts">`.
- The exported types of a part are in a `<script lang="ts">` block of the same file.
- Logic is in `.ts` composables.
- `packages/vue/src` has no TSX. Tests use TSX.
- `vue` is a peer dependency. The package can have only two run-time dependencies: `@floating-ui/vue` and `@floating-ui/utils`.
- Import the middleware, `computePosition`, `autoUpdate` and the types of Floating UI from `@floating-ui/vue`. Do not import `@floating-ui/dom` or `@floating-ui/core`. They are not dependencies of the package, so pnpm does not link them.
- `@floating-ui/vue` does not export the type `Derivable`. Declare it in the file that needs it: `type Derivable<T> = (state: MiddlewareState) => T`.
- A middleware of `@floating-ui/react-dom` takes a list of dependencies. A middleware of `@floating-ui/vue` takes none. Make the list of middleware in a `computed`. Read in it each option that must cause a new position.
- Keep the range of `@floating-ui/utils` at the release that Base UI resolves at the tracked commit. Choose the range of `@floating-ui/vue` so that it uses the `@floating-ui/dom` of the `@floating-ui/react-dom` that Base UI resolves. The middleware is then the same: `@floating-ui/vue` 2.0 and `@floating-ui/react-dom` 2.1 depend on `@floating-ui/dom` 1.8.
- Do not add a `minimumReleaseAgeExclude` line or an `allowBuilds` entry to `pnpm-workspace.yaml` without a comment that gives the reason.
- `useAnchorPositioning` of `src/internals` is the only caller of `useFloating` of `@floating-ui/vue`. A positioner part calls `useAnchorPositioning` in `setup`. `test/fixtures/PositionerPart.vue` is the model.
- To add or change a dependency of the package, run `pnpm --filter @vase-ui/vue add <name>@<range>`. Then commit `pnpm-lock.yaml`. Do not edit the lockfile. `THIRD_PARTY_NOTICES.md` names each run-time dependency.
- When two families import each other, move the shared context or constant to `src/internals`.
- Base UI's `internals` folders import constants, types and functions of the Field and Form families. Those pieces are in `src/internals`: `field-constants/FieldControlDataAttributes.ts`, `field-root-context/getCombinedFieldValidityData.ts`, and the types in `field-root-context/FieldRootContext.ts` and `form-context/FormContext.ts`. The file of the family exports them again from the path of Base UI.
- A file of `utils` that Base UI has keeps the path of Base UI, also when it imports a constant of a family. `utils` is a shared folder and not an entry point. An example is `utils/collapsibleOpenStateMapping.ts`.

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
- Code in setup does not touch `window` or `document`. The exception is a read behind a `typeof` check, where an option of the API needs the value before the mount.
- `useMediaQuery` reads `window.matchMedia` in this way for its option `noSsr`. `src/common/platform` reads `navigator` in the same way when the module loads.
- Compute labels, `aria-*` attributes and the roving tabindex at render, from props and ids. Do not compute them in `onMounted`. Nine values are exceptions, and each can change when its component is mounted. Three are an `aria-labelledby`: that of a root with a label part, that of a control in a field, and that of a control that only a native `<label>` names. Two more are the id of a control that has an `id` prop in a field, and an `aria-valuetext` in a locale format. The sixth is the `tabindex` of an item of a composite. See [Composite](#composite). The seventh is the `aria-controls` of an open `Collapsible.Trigger` or `Accordion.Trigger` whose panel has an `id` prop. The eighth is the pair of `aria-controls` on a `Tabs.Tab` and `aria-labelledby` on a `Tabs.Panel`. The part that renders first has no such attribute in the server HTML, because the other part registers later. It gets the attribute in the first flush on the client. The ninth is the `aria-labelledby` of an `Accordion.Panel` that renders before its trigger, when the trigger has an `id` prop. The server HTML then has the id that the item generates. The first flush on the client replaces it with the `id` of the trigger.
- Hydration must give no warning. The hydrated DOM must be equal to a client-only render. Vue does not compare `aria-*`, `role` or `data-*`.
- The element gets no `style` key while the merged style has no value, because Vue writes `style=""` for an empty key on a server. After a render that wrote a `style` key, the key stays. Vue removes the whole `style` attribute when the key goes away, and with it each declaration that a part writes to the DOM.
- One internal SFC, `internals/PrehydrationScript.vue`, renders each prehydration script. A part renders `<PrehydrationScript :script="script" />` where its script expects it. A script that follows its element finds the element with `document.currentScript.previousElementSibling`.
- The SFC renders the script element only while the part hydrates. It writes `<component :is="'script'">`, because the Vue compiler removes a `<script>` tag from a template.
- Only a server gives the text to the element. A client render gives an empty script, and a browser does not run an empty script. A script element that Vue makes with a text runs when Vue inserts it.
- The SFC writes the text with `innerHTML`, and only in the server render. On a server, text interpolation changes `&`, `<`, `>`, `"` and `'` into entities, and a browser does not decode an entity in a `<script>`. The text is a constant of the library. Do not give `innerHTML` a value of a consumer.
- A client render has no `innerHTML`, not even an empty one. Vue assigns an `innerHTML` prop through its own Trusted Types policy, named `vue`. A page that requires Trusted Types for scripts and has no `vue` entry in its `trusted-types` list makes that assignment throw.
- The script element gets the nonce of `CSPProvider` with `:nonce.attr`, as the style element does. `CSPProvider` has no setting that stops a script. A prop of the part does that, such as `renderBeforeHydration`.
- The client render has the script element in the place of the server element, and Vue does not compare `innerHTML`. The script element thus needs no `data-allow-mismatch`.
- The text of a script is the export `script` of the file `prehydrationScript.min.ts` in the folder of the part. The part imports it by a relative path: `import { script } from './prehydrationScript.min'`.
- The build changes that import into a subpath import with the folder of the part, such as `#prehydration/tabs/indicator`. The pattern `#prehydration/*` in `imports` of `packages/vue/package.json` resolves it.
- The `browser` condition of the pattern gives `internals/prehydrationScript.stub`, whose text is empty. A client bundle of a consumer then does not hold the text. `pnpm check:package` fails when a client bundle holds the text, or when the server HTML in Node lacks it.
- Do not write the subpath import in the source. A test job has no `dist`, and Vite cannot resolve the import.
- `imports` also has `#test-utils`. When a package has `imports`, Vite resolves each `#` specifier from that field, and it does not use the `paths` of `tsconfig.json` for that specifier.
- Add `data-allow-mismatch` to each element that the script changes, with the category of each change, such as `style`. Vue accepts a class, style or attribute mismatch only on the element that has the attribute with that category.
- Vue compares the `style` of an element only when the client render gives a `style` key. An element that can have a `style` in its client render, such as the `style` of a consumer, needs the category `style`.
- The part binds the attribute only while it hydrates, so the hydrated DOM stays equal to a client-only render.
- A style element of the library must be in the server HTML, so that its rule applies before the page hydrates. The internal SFC `utils/StyleDisableScrollbar.vue` renders that element in the element of the part, only while the part hydrates.
- The SFC writes `<component :is="'style'">`, because the Vue compiler removes a `<style>` tag from a template. It binds the nonce of `CSPProvider` with `:nonce.attr`. Without `.attr`, a client render sets the DOM property, and the element has no `nonce` attribute.
- After the mount, `useStyleDisableScrollbar(element)` keeps one shared style element for each document or shadow root. The last part that uses the element removes it. With `disableStyleElements` of `CSPProvider`, no such element exists, and the consumer writes the rule of the class `vase-ui-disable-scrollbar` in a style sheet.
- A portal renders after mount. It does not render while the popup is closed, unless `keepMounted` is set.
- The server render of some families depends on an id, a locale, a prehydration script or a portal. It can also depend on a state that a server cannot know, such as the loading status of an image. Such a family adds a page and its cases to the Nuxt fixture, `fixtures/nuxt`.

The hydration state:

- `useIsHydrating()` and `useIsHydrated()` are in `src/common/hydration.ts`. `useIsHydrating()` returns a `ComputedRef<boolean>`. `useIsHydrated()` returns a `Readonly<Ref<boolean>>`.
- `useIsHydrating()` gives `true` on a server. On the client, it gives `true` until the component that calls it is mounted.
- Vue has no public API that tells a hydration from a client-only mount in `setup`. The helpers use two facts of the lifecycle.
- A server render never calls `onMounted`. An app that hydrates calls it after the hydration of the component.
- The first render of a client-only mount thus also reads `true`. The component renders again in the flush after the mount, before a paint.
- Each call is for the component that calls it. A part that can hydrate after its root calls the helper itself. An example is an async component in `<Suspense>`.
- Do not keep the result in a module variable or in the context of the root.
- For a value in a locale format, call `useFormatLocale(locale)`. It gives the locale of the consumer. With no such locale, it gives `en-US` until the component is mounted, and then `undefined`, which is the runtime locale.
- The server HTML and the first client render then have the same text.
- A composable that reads another value of the browser obeys the same rule. It gives the server value in the first client render, and it reads the real value in `onMounted`. `useMediaQuery` does this. A client-only mount thus renders again when the two values differ.
- A part that measures the layout gives no measurement on a server and in the first client render. `Tabs.Indicator` reads the layout in a `computed` that gives `null` while `useIsHydrating()` is `true`. The server HTML and the first client render are then equal.

The label of a root:

- A root with a label part calls `useLabelId()` of `src/utils/useRegisteredLabelId.ts`. The root binds `labelId` to `aria-labelledby`. It provides `setLabelId` and `defaultLabelId` in its context.
- The label calls `useRegisteredLabelId(() => props.id, setLabelId, defaultLabelId)` and binds the result to `id`. The result is the `id` prop, or the id that the root made.
- A server render writes the attributes of the root before the `setup` of the label runs. The label cannot give its id in time for the server HTML.
- Thus the root assumes a label until it is mounted. The server HTML has `aria-labelledby` with the generated id.
- After the mount, a root with no label has no `aria-labelledby`. A root whose label has an `id` prop has that id. Vue gives no warning, and the hydrated DOM is equal to a client-only render.
- Until the page hydrates, the server HTML of those two roots points at the generated id.
- An `aria-labelledby` of the consumer on the root wins, because the attributes of the consumer merge last.
- Two labels with no `id` in one root get the same id.

The label, the control and the messages of a field:

- `provideLabelableContext()` of `src/internals/labelable-provider` makes the labelable context and provides it. A root that owns a control and its label calls it in `setup`, such as the root of a field.
- The provider makes one id for the control and one id for the label. A part with no `id` prop takes the id that the provider made. The label and the control then agree in the server HTML, in each order of the two parts.
- A control calls `useLabelableId({ id })` and binds the result to `id`. A label calls `useLabel({ native })`. A native `<label>` gets `for` with the id of the control. An element that is not a `<label>` gets a click handler that focuses the control.
- A control with an `id` prop has the id of the provider until the control is mounted. Then it registers a getter for its own id, and the label follows. With its own id from the start, the control would not match a label that comes before it.
- A label and a message register a getter for their id one time in `setup`. Each part that Vue renders after that `setup` has the id in the server HTML. `useLabel()` registers the label. A message calls `useRegisteredMessageId(id)`.
- `labelId` of the context is the id of the last label that has one. `messageIds` lists the ids of the messages in the order of the registrations, which is the order of the mount.
- A control gets `aria-describedby` from `getDescriptionProps` of the context.
- A control calls `useControlLabelId()` when its element is not a labelable element of HTML, such as a `<span>` with a role. It gives the result to `useAriaLabelledBy`, which follows this list. Until the control is mounted, the result is the id of a registered label. With no registered label, it is the id that the provider made for the label. A label that comes after the control then names it in the server HTML.
- The control holds that state, and the provider does not. A control can hydrate after its provider.
- When the field has no label, that `aria-labelledby` has no target until the control is mounted. A label with an `id` prop that comes after the control also does not name the control in the server HTML.
- A control makes no assumption for a message. A message that comes after the control is in `aria-describedby` after the first flush on the client, before a paint.
- A control whose element is not a labelable element calls `useAriaLabelledBy` and binds the result to `aria-labelledby`.
- It passes `useControlLabelId()` as `labelId`, the `shallowRef` of its hidden input as the source, and the id of that input as the source id.
- A native `<label>` names the control only after the mount. A server has no DOM, and the label of the consumer has no id.
- The composable writes an id to a label that has none.

The state of a field:

- The root of a field holds `touched`, `dirty`, `filled`, `focused` and the validity data in `shallowRef` values. A part changes one only through a function of the field context.
- A control can call such a function in `setup` with a value that it knows from its props, such as `setFilled`. The server HTML of the control and of each part after it then has the attribute. The root and the parts before the control get it in the first flush on the client. Vue does not compare `data-*`.
- A value that can add or remove an element does not come from `setup`. A lazy component runs its `setup` later in a browser than on a server, and Vue reports the difference as a hydration mismatch.
- `focused`, `touched`, the validity and the initial value come after the mount. A control that has focus before the hydration gets `data-focused` when it is mounted.
- The name of a control comes with its registration, after the mount. A form error for a `name` that only the control has thus shows after the mount. A field with the `name` on its root has the error in the server HTML.

### What Vue replaces

- Vue reactivity replaces upstream's `Store`, `ReactStore`, `useStore`, `fastHooks` and `createSelector`.
- A popup store is `shallowReactive` state, selector functions and a plain `context`. Each root makes one. See [Popup store](#popup-store).
- `useId` gives the ids.
- `Teleport` puts a popup into a container node that the portal makes in `onMounted`. It has no `defer`, because the node exists before the `Teleport` renders.
- Each context has a plain `Symbol()` key for `provide` and `inject`. Each copy of the library then has its own contexts.
- Only three registries are shared between copies, on `Symbol.for` keys: the scroll-lock count, the modal marks and the Escape stack.
- Each shared registry is a plain object with a `version` field. Fields are only added.
- Direction and CSP stay as `DirectionProvider` and `CSPProvider`. There is no global configuration provider.
- A React ref object that leaves the function that makes it (`React.RefObject`, read as `.current`) becomes a Vue ref, read as `.value`. It can be a member of a context, a member of a registration or a parameter. An example is the list of the elements of a composite.
- A function that only reads such a ref takes `Readonly<Ref<T>>`. The owner makes the ref with `shallowRef` and gives it a new value on each change. It does not change an array in place, because a `shallowRef` does not see that change.
- Base UI sometimes gives a ref object that computes its value on each read, or that it selects at render. A function that only reads such a ref takes `MaybeRefOrGetter<T>` and reads it with `toValue` in a handler or a hook. A function that gives the ref to such a reader takes the same type. Examples are `focusTargetRef` of `useSetFieldFocused` and `controlRef` of `useRegisterFieldControl`, which the form reads.
- A ref that parts write with no function of the context is a `Ref<T>`, made with `shallowRef`. `focusOwnerRef` of the field context is an example.
- A ref that only handlers, lifecycle hooks and `watch` callbacks read costs no render. They read it with no effect active, so a write wakes nothing. Do not read such a ref in a template.
- A value that Base UI keeps in a React ref and reads during render is also a `shallowRef`. Only a reactive value renders the part when it changes. `useCollapsiblePanel` has examples.
- A React ref that stays in one function becomes a `let`.
- A React synthetic event becomes the DOM event. `isReactEvent` of Base UI has no counterpart.

### Context of a root

A root gives values to its parts with `provide` and `inject`. Use `progress/root/ProgressRootContext.ts` as the model.

- The context is a plain object. A function is a plain function. Each field that can change is a ref, of one of three kinds.
- A field that the root computes is a `ComputedRef`.
- A field that the root writes is a `Readonly<Ref<T>>`. The root gives its `shallowRef`, and a part changes the value only through a function of the context.
- A field that holds the element of a part is a `ShallowRef<HTMLElement | null>`. The part writes it in the `ref` callback of `useRenderElement`. `scroll-area/root/ScrollAreaRootContext.ts` has the three kinds.
- A part can then destructure the context in `setup` and keep reactivity. A part that reads one field renders again only when that field changes.
- The context file exports the key with the type `InjectionKey<Context>`. It exports `use<Root>Context()` beside the key.
- `use<Root>Context()` calls `inject(key, undefined)`. With one argument, Vue gives a warning of its own when there is no provider.
- When the result is `undefined`, the function throws an error that follows [Error messages](#error-messages).
- A context that a part can be without does not throw. `useCompositeListContext()` returns `undefined`, because an item with no list is valid. `useCompositeRootContext(true)` also returns `undefined`.
- A context that Base UI creates with a default value has one default object in its file. `use<Name>Context()` then calls `inject(key, DEFAULT_<NAME>_CONTEXT)`, and a part works with no provider. `useLabelableContext()`, `useFieldRootContext()` and `useFormContext()` do this.
- The default holds no state, because all apps and all server requests share it. Each value that a provider can change is a `computed` with a constant. Each function does nothing, or returns a constant, or returns its argument where the default of Base UI does.
- `DEFAULT_FIELD_ROOT_CONTEXT` has three more forms. A ref that parts write drops each write: `validation.inputRef` is a `customRef` that reads `null`. A member that only a provider can have is `null`: `focusOwnerRef`. A collection is empty and read-only: `registeredInputs`.
- Base UI keeps three things in its default field and form contexts: the fields of the page that have no form, one focus owner and one input. Vase UI keeps none. With no form, `fields` is empty. With no field, `useSetFieldFocused` keeps the owner of its control.
- To find out if a provider is there, compare a function of the context with `NOOP`, as Base UI does: `registerControlId === NOOP`, `setValidityData === NOOP`. `useFieldRootContext(false)` throws when there is no field.
- Where Base UI types a member as a React state setter, the function takes a value. A Vue write is immediate, so a caller that needs the last value reads the ref.
- A component cannot `inject` a value that it provides. A root that needs its own context uses the object that the composable returns: `const labelable = provideLabelableContext()`.
- The context of a provider has another form. `DirectionContext` and `CSPContext` are each one `ComputedRef` of an object, and one composable reads the whole object.
- A context with one value that can change is one `ComputedRef` of that value. `scroll-area/scrollbar/ScrollAreaScrollbarContext.ts` is the model.
- A part can provide the context of another family, where Base UI does this. `Accordion.Item` calls `useCollapsibleRoot` and provides `CollapsibleRootContext`. The trigger and the panel of the Accordion then read `useCollapsibleRootContext()`, and the panel uses `useCollapsiblePanel` with no change.
- Such a part gives the context the members that the root of that family gives: the result of the composable, `onOpenChange` and `state`.

### Popup store

The state of a popup is in a store. The code is in `src/utils/popups`.

- `ReactiveStore` holds `state`, `context` and the selectors. `state` is a `shallowReactive` object. `context` is a plain object for the values that no part renders, such as a callback or a map.
- A selector is a plain function of the state: `(state, ...args) => value`. `store.select(key, ...args)` calls it with the reactive state.
- A part reads a selector in a `computed` in `setup`: `computed(() => store.select('isOpenedByTrigger', id.value))`. The part then renders again only when the value changes.
- A `select` call in a render function makes the part render again on each change of a key that the selector reads.
- The store makes no `computed` and no watcher. The `computed` of a part stops with the part. Thus code can make a store outside a component, with no `effectScope`.
- Write with `set`, `update` or `setState`. Do not assign to `state`.
- `set` and `update` call `setState` with the full state, so a subclass that overrides `setState` sees each write.
- Vue has no public batch for writes. A watcher with the default flush runs one time for an update of many keys. A watcher with `flush: 'sync'` runs after the write of each key, so it can read a state that is not complete.
- `setState` finds the changed keys before it writes the first key. A sync watcher can write the store during an update, and that write stays.
- `BasePopupStore` writes `open` and `openProp` after the other keys. A sync watcher of the open state then reads the trigger and the reason of the change.
- A function that a render function or a ref callback calls reads `toRaw(store.state)`. That read adds no dependency. The write methods of a store read the state in this way.
- The state keeps each value as it is: an object, an element, a ref. Do not hold a payload in `ref()` or `reactive()`.
- `NullStore` is a store that takes no write. Give it a frozen state and a frozen context. Vue does not make a frozen object reactive. Code that all apps and all server requests share, such as a handle, holds only such a store.
- A handle holds an inert `NullStore` and a `shallowRef` that points at the store of the root that controls the handle. A `computed` that reads `handle.store`, or a getter such as `isOpen` that reads the state of that store, follows the pointer. A method such as `open()` reads `attachedStoreUntracked`, so an effect that calls it does not run again when a root attaches or detaches.
- A root attaches its store to its handle in `onBeforeMount`. `attachStore` returns the function that detaches the store. A server does not call `onBeforeMount`, so a server render writes nothing to a handle that all requests share. Do not attach in `setup`.
- A trigger that has a handle calls `usePopupHandleStore(() => props.handle)` in `setup`. The result is the inert store of the handle while the trigger hydrates, and then the store that the handle points at. Hydration does not patch an attribute of a bound object, which is how a part binds its attributes. A trigger that reads the store of the root while it hydrates then keeps the attribute values of the server HTML.
- When two roots take one handle, the newest root controls it. When the newest root unmounts, control returns to the older root. A development build warns when two roots are still attached one frame later.
- `BasePopupHandle` calls `markRaw(this)`. Vue then makes no reactive proxy of a handle. A proxy, from `ref()` or the `data` option, would unwrap the pointer ref and fail at the next write to it.
- A family makes a subclass of `BasePopupStore`. The subclass overrides only the steps where it differs: `isOpenChangeIgnored`, `getCloseTrigger`, `prepareOpenChange`, `prepareUnmount` and `anchorsToActiveTrigger`.
- `BasePopupStore` has no `isCommittedSynchronously` step, because Vue has no `flushSync`. A caller that reads the DOM after `setOpen` awaits `nextTick()`.
- A function that works with the store of any family types its parameter as `PopupTriggerDataStore<State>`, or as a `ReactiveStore<State, PopupStoreContext<never>, PopupStoreSelectors>` plus the members that it calls. A parameter of the type `BasePopupStore<…>` refuses a family store with other change event details. It also refuses a family store with a step that returns only keys that the family adds.
- Take the innermost registered trigger that contains an event target, because an inner trigger can register after its outer trigger.
- `types.ts` has a part of the types of Base UI. The pull request that first needs a type adds it.

### Popup tree

A popup tree holds one node for each popup below one root. The code is in `src/utils/popups/tree`.

- `provideFloatingTree()` makes a `FloatingTreeStore`, provides it and returns it. `provideFloatingNode(id)` provides the id of a node. Base UI has the components `FloatingTree` and `FloatingNode` for this.
- `useFloatingNodeId()` registers a node in the tree and returns its id. `useFloatingParentNodeId()` gives the id of the node above the part, or `null`. `useFloatingTree()` gives the tree above the part, or `null`.
- `provide` follows the components and not the DOM. A part in a `Teleport` thus gets the tree and the node of the part around it.
- `inject` gives a part the tree and the node of the part above it, also when the part provides a tree or a node itself.
- Base UI sometimes calls a hook in a component below the `FloatingTree` of the same file, as `PopoverRoot.tsx` and `Menubar.tsx` do. Give the result of `provideFloatingTree()` to that composable as `externalTree`.
- A node registers in `onBeforeMount`. A server render does not call that hook, so a tree gets no node on a server.
- The hook runs before the `setup` of the parts below. Each of them thus finds the node when it is mounted.
- The nodes are in the order of those hooks: a node comes before the nodes below it. In Base UI, it comes after them. Find a node by its id. Do not use its position in the list.
- `nodesRef` is a `shallowRef`. The tree gives it a new array for each node that it adds or removes.
- `parentId` of a node gives the id that the part above provides at the time of the read. When that id changes, the node keeps its place and its `context`.
- `KeepAlive` leaves a node in its place. While the part of the node is deactivated, the `context` of the node is `undefined`. `getNodeChildren` then does not count the node as open.

### Focus helpers

The focus helpers of a popup are in `src/utils/popups/focus`.

- `tabbable()` keeps the order of the document for an element with a positive `tabindex`, as Base UI does. A browser visits that element first.

### Composite

A composite is a group of items with one tab stop, such as a toolbar or a list of tabs. Its code is in `src/internals/composite`.

- A root part calls `useCompositeRoot` in `setup`, and an item part calls `useCompositeItem`. Each part gives the result to `useRenderElement`.
- `useCompositeRoot` makes the item registry with `useCompositeList`. `useCompositeItem` registers the item with `useCompositeListItem`. A part that needs only the registry calls those two composables.
- Base UI also has the components `CompositeList`, `CompositeRoot` and `CompositeItem`. Vase UI has no counterpart of them, because a Vue part renders its own element. Thus `as` and `#render` work with no change, and the DOM has no wrapper element.

The composite root:

- A root part writes `const { props: compositeProps, rootRef } = useCompositeRoot({ … })`. It gives `ref: [rootRef]` and `props: (attrs) => [compositeProps, ownProps, attrs]` to `useRenderElement`.
- Keep that sequence of `props`. A `keydown` listener of the consumer then runs first, and `event.preventVaseUIHandler()` stops the navigation.
- The composable has no `direction` parameter. A handler reads the value of `useDirection()` when a key comes, so a change of `DirectionProvider` applies.
- The highlighted index goes through `useControlled`. A root with `onHighlightedIndexChange` and no `highlightedIndex` also writes its own state. Base UI writes no state in that case.
- A root part whose selected item can be hidden or natively disabled gives `highlightedIndex` and `onHighlightedIndexChange` to `useCompositeRoot`, as `Tabs.List` does. An uncontrolled root moves the tab stop off that item. The item moves it back. A development build of Vue then stops with `Maximum recursive updates exceeded`.
- The composable adds no attribute to the element of the root.
- The check of `disabledIndices` reads the elements of the list, so `elementsRef` is a source of its watcher. Under `KeepAlive`, the list sorts after the `onActivated` hooks, and the check must run after that sort.
- The composable returns `props`, `rootRef` and `highlightedIndex`. A part below the root reads `onHighlightedIndexChange` and `relayKeyboardEvent` from `useCompositeRootContext()`. Base UI's hook also returns them, for its `CompositeRoot` component.

Grid navigation:

- A root part that is a grid gives `grid: gridNavigation(config)` to `useCompositeRoot`. The function is in `root/gridNavigation.ts`. A root part with no grid does not import that file. A bundler can then remove the grid code.
- `grid` is a plain function and not a `MaybeRefOrGetter`, because `toValue` calls a function. The root reads it when a key comes.
- `config` holds `cols`, `dense` and `itemSizes`. It is a value, a ref or a getter. The navigator reads it when a key comes.
- `cols` is a whole number of 1 or more. A fraction counts as its whole part. A value below 1, or a value that is not a finite number, counts as 1.
- An item width or an item height that is not a finite number counts as 1.
- With a grid, each key that moves the highlight calls `event.preventDefault()`, also an arrow key outside `orientation`.
- An item that is wider than the grid gets the width of the grid, in each build. A development build also reports the item. Base UI throws in a development build, and its loop does not end in a production build.

The composite item:

- An item part writes `const { compositeProps, compositeRef } = useCompositeItem({ metadata, active, disabled })`. It gives `ref: [compositeRef, …]` and `props: (attrs) => [compositeProps.value, ownProps, attrs]` to `useRenderElement`.
- Put `compositeRef` first in `ref`. When two items share one element, the outer item then registers last and owns the entry.
- `active` and `disabled` are for the first tab stop only. The composable reads them one time, in `setup`.
- Give `active` when the part writes `data-composite-item-active`. Give `disabled` when the item cannot hold the first tab stop. The part still writes the attributes itself.

A part that is in a composite only in some trees:

- `Toggle` is a composite item only in a `ToggleGroup`. `ToggleGroup` is a composite root only outside a `Toolbar.Root`. In a toolbar, the toggles register with the root of the toolbar. `toggle/Toggle.vue` and `toggle-group/ToggleGroup.vue` are the models.
- The part reads the context that decides with `inject`, in `setup`. It calls `useCompositeItem` or `useCompositeRoot` only when that context allows it: `const compositeItem = groupContext ? useCompositeItem({ … }) : undefined`.
- The choice is made one time, because a component keeps its provider chain from the moment that Vue makes it. `KeepAlive` and `Teleport` do not change that chain.
- `useCompositeItem` throws when it has no composite root, so a part cannot call it in each tree.
- A root part that is in another composite calls no `useCompositeRoot`. It provides no composite context and no list. Its items register with the outer root, and the composite has one tab stop.
- The outer root owns the keys. The `orientation` and `loopFocus` of the inner part do not change them.
- The part writes the composite sets with an optional chain. A set that is `undefined` adds nothing: `ref: composite ? [composite.rootRef] : []` and `props: (attrs) => [composite?.props, ownProps, attrs]`. An item part writes `compositeItem?.compositeProps.value` in the same way.

The item registry:

- An item registers its element in its ref callback, and it removes the element there.
- A function that a ref callback calls must not read reactive state. Vue calls the callback during a render, and the read makes that render depend on the state.
- The list sorts the elements by their position in the document. It does this at mount and in a `watch` with `flush: 'post'`, after the DOM update that follows a registration.
- A `v-for` with keys moves elements and calls no ref callback. A `MutationObserver` sees the move and starts the sort again, as in Base UI.
- `KeepAlive` takes the element of an item out of the document and calls no ref callback. The item removes its element in `onDeactivated` and registers it again in `onActivated`.
- `KeepAlive` empties the composite map while the item parts still exist. A root that falls back when its items are gone decides a removal by a registry of the item parts, not by the map. `tabs/root/TabsRoot.vue` is the model.
- The list publishes a new map only when an index, an element, an explicit index or a metadata value is different. An item reads its index from the map in a `computed`.
- The metadata, the label, the explicit index and the text element of an item are values, refs or getters. When one of them changes, the item tells the list to sort again. It does not register again.
- Give an object as metadata through a `computed` or a ref. A getter that makes a new object on each call makes the list publish a new map on each sort.
- `elementsRef` and `labelsRef` are `shallowRef` values. The list gives each a new array on each sort. An explicit index can leave an empty slot in the array.
- An item with no list is valid. Its index is its explicit index, or `-1`.
- A family can use the registry only for the index of its items. `Accordion.Root` calls `useCompositeList`, and `Accordion.Item` calls `useCompositeListItem`. The root does not call `useCompositeRoot`, so the items have no roving tab stop and no arrow keys. Base UI removed the arrow keys of the Accordion to follow the APG.

The index on a server:

- A server render calls no ref callback, so the registry is empty there.
- An item takes its first index in `setup`, from a counter of the list. The counter counts the `setup` calls of the items that have no explicit index. Each sort sets it to the length of `elementsRef`.
- Base UI has this as the option `guess`, which is off by default. `useCompositeListItem` has no `guess` parameter, because `setup` runs one time for each item.
- When a server and a browser run `setup` in the same order, the server HTML and the first client render have the same index.
- The first index can be wrong until the sort that follows the mount, in five cases:
  - The list has an item with an explicit index. The counter does not know the slot that the explicit index takes.
  - The list has an item in an async component that is not loaded yet, or below a component with an async `setup`. The `setup` of that item runs after the `setup` of the items that follow it. An async `setup` causes this on each server render.
  - The list has an item in a `Teleport`. The element of that item is in the target, but its `setup` runs in the order of the template.
  - An item whose `setup` ran before registers no element of its own. It renders no element, or it shares its element with another item of the list. The counter still counts it.
  - The item mounts in a mounted list. The first index is wrong if the item comes before an item that was in the list at the last sort. It is also wrong if an item left the list since that sort.

The tab stop on a server:

- The server HTML has `tabindex="0"` on at most one item and `tabindex="-1"` on the others. Base UI has `-1` on each item.
- An item asks the root for the tab stop one time, in `setup`, with its first index. The root gives it to at most one item, in the order of the `setup` calls.
- When the root part sets `hasActiveItem`, the tab stop is the first item with `active`. Set `hasActiveItem` only when an item is active.
- If not, the tab stop is the first item that is not `disabled` and is at or after the highlighted index of the root.
- The first client render uses the same rule and reads no DOM. An item keeps this tab stop until it is mounted. Then the tab stop is the item at the highlighted index, as in Base UI.
- `Tabs.List` sets `hasActiveItem` only when `value` or an explicit `defaultValue` is not `null`. With the implicit default, the first enabled tab has the tab stop. With `null`, the first tab has it, also when it is disabled.
- The order of `setup` is the order of the document, with the exceptions of the list above. Two exceptions are usual:
  - An item below a component with an async `setup`. A server runs the `setup` of that item after the items that follow it.
  - An item in an async component that a module makes one time, such as a lazy component of Nuxt. After its first render, a server has loaded the component and runs its `setup` in the order of the document. A browser has not loaded it when the page hydrates.
- In such a list, the tab stop of the server HTML can be on another item than the tab stop after the mount. A server writes the HTML of an item before it knows the later items.
- While an item hydrates, it gives `data-allow-mismatch="attribute"` and a `tabindex` that is a string. Vue then reports no mismatch when the server and the browser give the tab stop to different items.
- After the mount, the item gives a number. Hydration does not patch an attribute, but the string and the number are different values, so Vue writes the attribute again.
- An item can be mounted after its root: an item in an async component, or below a `<Suspense>` inside the root. Its element keeps the `tabindex` of the server HTML until the item is mounted.
- While such an element has `tabindex="0"`, the mounted items do not take the tab stop. The list then has one tab stop. That element has no listeners of its own until its item is mounted.
- While an item hydrates, it also gives the attribute `data-vase-ui-hydrating-composite-item` with the id of its root. The root finds the element by that attribute. Thus it does not wait for an item of a nested composite or for an element of a consumer.
- The wait ends when the item is mounted or its element leaves the document. The tab stop is then the item at the highlighted index.
- The root searches its own element only. It does not find an item whose element is outside it, for example in a `Teleport`. If the server HTML gives that item the tab stop, the list can have two tab stops until the item is mounted.
- A `<Suspense>` outside the root holds the mount of the root. Until it resolves, the list keeps the tab stop of the server HTML.
- The server HTML has no tab stop in three cases:
  - The root part sets `hasActiveItem` and no item is active.
  - Each item is disabled.
  - The root is controlled, its highlighted index is above 0, and no enabled item has that index or a higher index.

### DOM event names

A handler key of a DOM event is `on` plus the DOM event name with one capital. Vue makes the event name from the key with `hyphenate`, so `onKeyDown` listens to `key-down`. No browser sends that event. Vue gives no warning.

| React                                     | Vue                                               |
| ----------------------------------------- | ------------------------------------------------- |
| `onKeyDown`                               | `onKeydown`                                       |
| `onPointerDown`                           | `onPointerdown`                                   |
| `onMouseMove`                             | `onMousemove`                                     |
| `onDoubleClick`                           | `onDblclick`                                      |
| `onContextMenu`                           | `onContextmenu`                                   |
| `onFocus`, `onBlur`                       | `onFocusin`, `onFocusout`                         |
| `onChange` on a text input                | `onInput`                                         |
| `onChange` on a checkbox or a radio input | `onClick`                                         |
| `onKeyDownCapture`                        | `onKeydownCapture`. The `Capture` suffix stays.   |
| `onOpenChange` (a component event)        | `onOpenChange`. A component event keeps its name. |

- The rule applies to the handler keys of a part and to a ported test.
- React implements `onFocus` and `onBlur` with `focusin` and `focusout`.
- React calls `onChange` of a text input on each `input` event.
- React calls `onChange` of a checkbox or a radio input on the `click` event. A check of `event.nativeEvent.defaultPrevented` in such a handler becomes a check of `event.defaultPrevented`.
- To stop the focus handler of a part, call `event.preventVaseUIHandler()` from a `focusin` or `focusout` listener.
- ESLint reports a React name from a fixed list, with or without the `Capture` suffix. It reports an object key, a property read and a JSX attribute in script, in `packages/vue/src`, in test files and in `packages/vue/test`. It does not read a template.
- The lint rule has a fixed list of names, because a pattern for a second capital also matches a component event, such as `onOpenChange`.
- The list does not have `onFocus`, `onBlur` and `onChange`. Each is a valid Vue key with another meaning.

### What differs from the React source

- Vue has no `flushSync`. Replace each call with one of three forms.
- If the next line does not read the DOM, write the state and nothing else. Vue queues its flush as a microtask. A microtask runs before the next paint.
- If the next line reads the DOM or moves focus, write the state and `await nextTick()`. Then run the next line. Each replacement of this form must have a test of its own.
- In an event handler, call `preventDefault` and `stopPropagation` before the first `await`. A handler returns at its first `await`. The browser then completes the dispatch of the event.
- If upstream gives each callback a `flushSync` call of its own, run the callbacks in sequence. Each callback runs after the Vue flush of the callback before it, so it reads the state that the earlier callback changed.
- `useAnimationsFinished` uses this form for each completion that is not batched. Only microtasks wait, so the browser does not paint before the completion runs.
- An error of a completion goes to `reportError`. The later completions still run.
- An effect of upstream (`useEffect` or `useIsoLayoutEffect`) becomes a `watch` with a callback and no `immediate`. A server render does not run such a `watch`, except one with `flush: 'sync'`.
- An effect that reads the DOM uses `onMounted(run)` plus `watch(sources, run, { flush: 'post' })`. `run` then runs at mount and after each DOM update that follows a change of a source. `useTransitionStatus`, `useOpenChangeComplete` and `useCollapsiblePanel` do this.
- An effect that needs the element of the part, such as an observer, is a `watch` of the `element` of `useRenderElement` with `flush: 'post'`. Start the observer in the callback. Stop it in `onCleanup`. Vue runs the cleanup when the element changes and when the part unmounts. `scroll-area/viewport/ScrollAreaViewport.vue` is the model.
- An effect of Base UI with no dependency list runs after each commit, so it also sees a DOM change of another component. A Vue component with the same props does not render again when its parent renders.
- Such an effect is a `watch` of its sources with `flush: 'post'`, plus a `MutationObserver` for the DOM change. `useAriaLabelledBy` keeps one observer for each document or shadow root.
- A part of Base UI that measures the layout in each render becomes a `computed` that reads the measurement. Each value that can move the element is a source of the `computed`, such as the orientation. A `ResizeObserver` reports only a change of size, so its listener raises a `shallowRef` count that is one more source. The count replaces `useForcedRerendering`. `Tabs.Indicator` is the model.
- A watcher that writes state that the render reads keeps the default flush. It runs before the render, so the component renders one time for the change. `useMediaQuery` and `useImageLoadingStatus` do this.
- `isPositioned` of `useAnchorPositioning` is the exception: its `watch` has `flush: 'sync'`.
- `useFloating` sets `isPositioned` from the `open` option that it read when the position pass started. A pass can start while the popup is open and end after the popup closed. `useFloating` then gives `true` for a closed popup, and the part shows an old position.
- The composable keeps its own `isPositioned` in a `shallowRef`. One `watch` on `middlewareData` and on the `isPositioned` of `useFloating` writes it. The value is `true` only when the `isPositioned` of `useFloating` is `true` and `open` is not `false` at that time.
- Each reader of `isPositioned` reads this ref. A reader outside a render, such as the microtask of a function ref, needs the value in the write that ends the pass.
- `useValueChanged` calls its callback after the DOM update, because the callback of a field control reads the validity of the input. Under `KeepAlive` it waits for the activation and gives the value before the deactivation.
- A consumer can change an object prop in place, because a `ref` of the consumer gives a reactive proxy. `errors` of `Form` is such a prop. A `computed` that reads the proxy with `Object.hasOwn` does not see a new key, because Vue tracks no `Object.hasOwn` of a proxy.
- Watch such a prop with `deep: true`, and keep a plain copy of it in a `shallowRef`. Each change then gives a new object, and a `computed` that reads the copy runs again.
- Do not use `watchPostEffect` for an effect. It runs again for each value that the effect reads, and an effect of upstream runs again only for the dependencies that it names. A dependency that the effect does not read, such as `restartKey` in `useOpenChangeComplete`, then starts no run.
- An internal component of Base UI that only provides a context and renders its children becomes a composable that the root calls. `LabelableProvider.ts` exports `provideLabelableContext()`.
- A registration that the server HTML needs runs one time in `setup`. Register a getter for the value, so that a later change needs no new registration. Remove the registration in `onScopeDispose`. `useLabel` and `useRegisteredMessageId` do this.
- Do not register with a `watch` that has `immediate` and a cleanup. A server render stops that watcher directly after its first run, and the stop runs the cleanup.
- A registration from which a provider picks one value among many parts runs in `onMounted`. A control that replaces another control then registers after the old control left the registrations. `useLabelableId` does this for the id of a control, with a `watch` for a later change. `useRegisterFieldControl` does it for the control of a field. It registers one getter for all the values of the control. A `watch` registers the same getter again when the `id`, the `name`, the value or `enabled` of the control changes.
- `Collapsible.Panel` registers its id in `setup` with `useRegisteredId`, and the root takes the id of the last registration. A panel that replaces another panel then registers after it.
- Where Base UI removes a registration in the cleanup of a layout effect, use `onScopeDispose`. It runs while Vue unmounts the component. The `onMounted` of a part that replaces it runs after that.
- A compiled template can mount a new part before it unmounts the part that it replaces. A removal by value then removes the value of the new part.
- Thus register a value that two parts can have by source: a `Map` with one entry for each part. `createIdRegistry()` of `src/internals/labelable-provider` does this for the controls, the labels and the messages, for the controls of a field, for the panels of a collapsible, and for the triggers of an accordion item.
- A `#render` slot can give an element with attributes that no prop of the part shows. An effect that depends on such an attribute runs in `onMounted` and `onUpdated`. It compares the values that it reads with the values of its last run, and it stops when they are equal. `AvatarImage.vue` reads the rendered image in this way.
- The transition status runs on a `flush: 'sync'` watcher. It replaces a state write during render.
- A composable that drives `useTransitionStatus` writes its state one time in each run. React batches the writes of an effect, but the sync watcher sees each write. In `useImageLoadingStatus`, a `'loading'` write before a `'loaded'` write would give a loaded image `data-ending-style`.
- `useTransitionStatus` has a fifth parameter, `element`, that upstream does not have. It is the element that gets `data-starting-style`, or a ref or a getter for it.
- After the DOM update that applies `data-starting-style`, the composable reads the layout of that element one time, with `getBoundingClientRect()`. It then removes the attribute in the next animation frame, as upstream.
- The read is not `offsetHeight`, because an `<svg>` has no such property.
- Without that read, Vue removes the attribute before the first style computation. The enter transition then does not start.
- Omit `element` only when the element has no enter transition.
- `Accordion.Item` gives no `element` to `useCollapsibleRoot`. Its state has no transition status, so its element never has `data-starting-style`. The panel reads its own computed style in the size effect of `useCollapsiblePanel`, before the frame that removes the attribute.
- `useUnmountAfterClose` keeps a popup mounted until its exit animation ends. Then it sets `mounted` to `false` and calls `onUnmount` one time.
- `mounted` changes in the write, so the composable has no copy of it. Upstream's `mountedRef` has no counterpart.
- A `forceUnmount()` call while the popup is open is a request. A `watch` of the request, with `flush: 'post'`, unmounts the popup if the popup is closed after the flush. The `open` prop of a controlled root changes only in that flush.
- Do not decide that request in `nextTick`. With no flush in the queue, `nextTick` runs before the flush of a write that comes later in the same task.
- The element of the composable is a ref or a getter, so upstream's `subscribeToAttach` has no counterpart. A watcher starts the wait again when the element attaches, and only then.
- Vue applies a state write of an animation frame callback in the microtask after that callback. The browser computes the style of the frame after that microtask.
- A transition must sometimes start from a value that an earlier DOM update set. Then read the layout of the element after that update. `useCollapsiblePanel` calls `getBoundingClientRect()` in `nextTick` after it writes the measured size. Without that read, the exit transition does not start.
- React adds `px` to a number in a style object. Vue does not. Write each length that is not zero as a string with its unit, such as `'1px'`.
- Write a style key with a vendor prefix in its CSS form, such as `'-webkit-user-select'`. A server render writes the key `WebkitUserSelect` as `webkit-user-select`, which is not a CSS property.
- Vue writes each key of a style again when the `style` object is not the object of the last render. A temporary inline style that the code writes to the DOM is then lost when the consumer has the same property in `style`.
- Thus keep each temporary declaration that a part writes to its element also in a record that the part renders. Remove the declaration from the record when the code restores the property. `useCollapsiblePanel` returns that record as `temporaryStyle`.
- `CollapsiblePanel.vue` gives `animation-name: none` and the record to `useRenderElement` as `overridingStyle`. They then win over `style` and `stateStyle` of the consumer.
- A hidden input that `handleHiddenInputInvalid` grows gets the style constant itself, in a bound object, outside `mergeProps`. That bound object is the only attribute of the input.
- A root can write a temporary declaration to the element of another part. `ScrollAreaRoot.vue` does this for `scroll-snap-type`, while a thumb drag or a track press is active.
- The root saves the inline value that it finds, and it restores that value at the end.
- A render of the other part can replace the declaration. The other part thus calls the root in `onUpdated`, and the root writes the declaration again.
- For a declaration on the element of another part, do not use a record. Vue removes the property when the record loses the declaration. A value that the consumer wrote in script is then lost.
- An attribute key in a props object is the name in Vue's `HTMLAttributes`, such as `tabindex`. `mergeProps` merges by key, so the `tabindex` of a consumer then replaces the `tabindex` of the part.
- With the key `tabIndex`, the merged props hold two keys. Vue then sets one as a DOM property and one as an attribute.
- A parameter of a composable keeps upstream's name, such as `tabIndex` of `useButton`.
- Where upstream takes a native attribute out of its props and does not use it, the part takes the key out of `attrs` in the `props` function of `useRenderElement`. It does not declare a prop for it. `Toggle` does this for `type` and `form`: `const { form, type, ...elementAttrs } = attrs`.
- Where an element can lack the DOM property, a part gives a Boolean attribute the value `true` or `undefined`, never `false`. On an `<svg>`, which has no `hidden` property, Vue writes `false` as `hidden="false"`.
- For `hidden="until-found"`, the props hold the string `'until-found'` as `hidden`. A server with Vue 3.5.41 or later writes that value. An earlier server writes a bare `hidden`.
- Hydration does not patch an attribute, so the part also writes `hidden="until-found"` to the element at mount.
- A transition continues when an element gets `hidden="until-found"`, because the element has no `display: none`. When the element becomes hidden, the part first writes a plain `hidden` and reads the computed style one time. The browser then cancels the transitions.
- Base UI adds some listeners to the element of the part with `addEventListener`. Give such a handler in the props of the part. An example is `onBeforematch` of `Collapsible.Panel`. The element of a `#render` slot then gets the listener too.
- A listener that Base UI adds with `{ passive: false }` also goes in the props. An example is the `wheel` listener of `ScrollArea.Scrollbar`. Vue adds the listener of an element with no `passive` option. A browser makes a `wheel` listener passive by default only on the window, the document, the root element and the body.
- The popup tree is the only link between a teleported child popup and its parent.
- An outside press and a focus-out treat the popup of a descendant node as inside.
- `KeepAlive` is the counterpart of `React.Activity`. Under `KeepAlive`, a part keeps its state. In `onDeactivated` it releases the scroll lock, the modal marks, the document listeners and the timers. In `onActivated` it takes them back.
- A part that clears a timer in `onDeactivated` also ends the state that the timer would end. `ScrollAreaRoot.vue` ends its scrolling state.
- A part that follows a pointer ends that state in `onDeactivated`, because `KeepAlive` sends no leave event. `ScrollAreaRoot.vue` does this for its hover state.
- A part that reads `:hover` at mount reads it again in `onActivated`. No enter event comes for a pointer that is already over the part. `ScrollAreaViewport.vue` does this.
- An effect that reads the DOM stops while the part is deactivated. `onDeactivated` runs the cleanup of the effect, and `onActivated` runs the effect again. `useCollapsiblePanel` does this for its size effect and its close effect.
- `useUnmountAfterClose` is the exception. A close that is in progress when `KeepAlive` deactivates the root completes, and `onUnmount` runs one time. A wait that starts again at the activation would play a keyframe exit a second time.
- `onActivated` also runs at the first mount in a `KeepAlive`. Keep a flag that `onDeactivated` sets. Do nothing in `onActivated` while the flag is not set.
- Where the effect is a `watch` with `onCleanup`, the flag is a `shallowRef` in the sources of that `watch`. The callback returns while the flag is set. `ScrollAreaViewport.vue` and `ScrollAreaContent.vue` do this for their observers.
- `KeepAlive` takes the DOM of a deactivated part out of the document. The id of that part then must not stay in a `for`, an `aria-controls`, an `aria-labelledby` or an `aria-describedby`.
- A registration with a provider registers a getter one time and keeps its entry and its place. The getter gives no value while the part is deactivated. `useRegisteredId` does this for a label, a message and the panel of a collapsible, and `useLabelableId` does it for the id of a control. `useRegisterFieldControl` does it for the control of a field, with one difference. It registers the getter again when a value of the control changes, and the entry then goes to the end of the registry.
- The two hooks of such a registration only set a flag that the getter reads. `KeepAlive` runs the `onActivated` hooks of one branch from the last part to the first part. A new entry in that hook would reverse the order of the parts.
- A pick of one value from many registrations, such as the control id of a provider, runs in a `watch` with the default flush. The pick runs one time for each flush, against all registrations, as the state updater of Base UI does. It then does not depend on the order of the hooks.
- An action of a part that needs the registrations of other parts runs in a `watch` of the flag, when the flag becomes `false`. In its own hook, the parts before it are still deactivated and give no value. `useLabelableId` does this for a control with no id: it takes the default id of the provider again.
- The active control of a field is the last control of its registry that gives a registration. The registry has the order in which the controls registered or changed.
- A control registers again when its `id`, its `name`, its value or `enabled` changes, as the effect of Base UI does. Thus the control that changed last is the active control. A write of an equal value is not a change.
- When the active control goes away, the field uses the control that was active before it and is still there. The same occurs when the active control gets `enabled` false and when `KeepAlive` deactivates it. Base UI has no control then, until another control registers again.
- The activation of a control by `KeepAlive` is not a registration. A control that comes back keeps its place in the registry. A change of a deactivated control moves its entry to the end. The control is active again only when no control after it in the registry gives a registration.
- A field gives no value to its form while it has no active control, for example while `KeepAlive` has each of its controls deactivated. `fields` of the form context then does not list the field, so a form does not validate it, submit its value or focus its control.
- `fields` has the order of the registrations, which is the order in which the roots of the fields mount. A field that mounts later than its siblings is last, as in Base UI. A field keeps its place when its control is replaced, when the id of its control changes and when `KeepAlive` shows it again.
- Thus a form finds the first invalid control by the position of the controls in the document, as Base UI does. An entry of `fields` has the name and the validity of the moment of the read, so a form reads `fields.value` again after a call of `validate`.
- A part that mounts in a branch that `KeepAlive` has already deactivated gets no `onDeactivated` call, and Vue has no public API for the state of the branch. The getter of such a part gives a value until the next deactivation of the branch.
- The registry of a composite is different: it holds elements and sorts them by their position in the document. See [Composite](#composite).
- Do not use the Vue `<Transition>` component. CSS drives animation through `data-starting-style`, `data-ending-style` and `getAnimations()`, as upstream.
- Give `useFloating` an element or a virtual element, never a component. It reads the element of a component through `$el`. `resolveElement` changes a component into an element.
- The reference of `useFloating` is `null` before the mount, while the popup is not mounted, and while `KeepAlive` holds the component. `useFloating` then starts no `autoUpdate` and computes no position.
- Write the anchor to a `shallowRef` that the reference reads, in a `watch` with `flush: 'post'`. A getter of the consumer can read the DOM of the render.
- Make the reference empty in a `computed` that reads `mounted`. The cleanup of `autoUpdate` then runs in the write that closes the popup.
- A watcher with `flush: 'post'` runs after the DOM update that hides the popup. The `ResizeObserver` of `autoUpdate` then starts one more position pass, which measures the hidden popup as 0 by 0.
- Give `placement`, `strategy` and `middleware` to `useFloating` as getters of one `shallowRef`. One `watch` with the default flush writes that ref.
- `useFloating` computes a position in a sync watcher for each option that changes. Vue writes the props of one render one at a time. A pass with a shorter middleware list ends first, so the popup can keep the position of the old options.
- Use `whileElementsMounted` with `autoUpdate` for a popup that stays mounted too. The reference is `null` while that popup is closed, so `autoUpdate` does not run then.
- `useFloating` writes a position in microtasks. A popup has its position before the first paint after it opens.
- A key that no rendered style has, such as `--anchor-width`, keeps the value that code writes on the element. A value that code writes for a key of the rendered style goes into a ref that the style reads, such as `--available-height`.
- A function ref of a composable reads no ref in the render, because the render then depends on that ref. Where the function ref must start work that depends on a ref, it reads the ref in a `queueMicrotask` callback. `arrowRef` of `useAnchorPositioning` does this.
- The check for a rectangle must refuse a component. The ref of a component with no `expose` also gives its props. A component that has `width` and `height` props then has the names of a rectangle. A rectangle has no `nodeType` and no `$props`, and its `x`, `y`, `width` and `height` are numbers.

### What stays from Base UI

- Use the ports of upstream's `useTimeout` and `useAnimationFrame`. Do not call `setTimeout` or `requestAnimationFrame` directly.
- Use the shadow DOM-safe helpers for DOM traversal and event targets: `closest`, `contains`, `getTarget` and `activeElement`.
- Write development checks as `process.env.NODE_ENV !== 'production'`.

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
- Write the reason for a node of a template as a comment in the script block. A comment in a template becomes a DOM node in a development build.

## Tests

### Where a test runs

- A test file runs in Chromium, Firefox and WebKit.
- `packages/vue/vitest.config.ts` sets the Firefox preference `dom.multiple_import_maps.enabled` to `false`. Vitest sets it to `true`, and Firefox then sometimes crashes a page when the page starts.
- With `false`, Vitest mocks a module in Firefox by request interception, not by import map. Do not set `browser.importMapMocks` to `true`: Vitest then refuses a mock in Firefox.
- A test file with a name that ends in `.node.test.ts` or `.node.test.tsx` runs in Node with no DOM. Use it for server render and for logic that must work with no DOM.
- A `.node.test` file does not import `#test-utils`, because that index loads the libraries of the DOM helpers. To render a part, such a file imports `renderToString` from `vue/server-renderer` and the part directly.
- A family can have one `.node.test.tsx` file for the server render of the whole family, in the folder of its root: `progress/root/ProgressRoot.node.test.tsx`. A `replaced` Base UI case is the exception. It goes to the `.node.test.tsx` file of the folder of its Base UI test, as [How to port a test](#how-to-port-a-test) says: `fieldset/legend/FieldsetLegend.node.test.tsx`.
- There is no jsdom.
- A file with a name that ends in `.spec.ts` or `.spec.tsx` is a type test. vue-tsc checks it, and no test runner runs it.
- The tests of `fixtures/nuxt` run in Node. They start the Nuxt app with `@nuxt/test-utils` and read its pages in Chromium. They are not part of `pnpm test`. The job `test-nuxt` of CI runs them, and `required` needs that job.
- The job `test-nuxt` also runs `pnpm --filter @vase-ui/nuxt-fixture typecheck`. vue-tsc then checks the templates of the fixture against the built package, as it does in the project of a consumer.

### How to port a test

A ported test is a file at the mapped path with the same `describe` and `it` titles as upstream. It is TSX, so it differs from the upstream file only by these rules:

| Base UI test                                                                                               | Vase UI test                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `from '@base-ui/react/<entry>'`                                                                            | `from '@vase-ui/vue/<entry>'`                                                                                                                                                                                                                             |
| `from '@base-ui/react'`                                                                                    | `from '@vase-ui/vue'`                                                                                                                                                                                                                                     |
| `from '@base-ui/utils/<file>'`                                                                             | A relative path to `src/common/<file>`                                                                                                                                                                                                                    |
| `vi.mock('@base-ui/utils/<file>', …)` and `vi.importActual` of that module                                 | The same calls with the relative path to `src/common/<file>`                                                                                                                                                                                              |
| `from '@mui/internal-test-utils'`                                                                          | `from '#test-utils'`                                                                                                                                                                                                                                      |
| `from '@floating-ui/react-dom'`                                                                            | `from '@floating-ui/vue'`                                                                                                                                                                                                                                 |
| A global name with `BASE_UI`, such as `BASE_UI_ANIMATIONS_DISABLED`                                        | The Vase UI name, such as `VASE_UI_ANIMATIONS_DISABLED`. See [Layout and names](#layout-and-names).                                                                                                                                                       |
| `event.preventBaseUIHandler()`                                                                             | `event.preventVaseUIHandler()`                                                                                                                                                                                                                            |
| `className`                                                                                                | `class`                                                                                                                                                                                                                                                   |
| `tabIndex` as a prop or as a key of a props object                                                         | `tabindex`. An assertion on the DOM property keeps `tabIndex`.                                                                                                                                                                                            |
| `noValidate` as a prop or as a key of a props object                                                       | `novalidate`. An assertion on the DOM property keeps `noValidate`.                                                                                                                                                                                        |
| `crossOrigin`, `referrerPolicy` or `srcSet` as a prop or as a key of a props object                        | `crossorigin`, `referrerpolicy` or `srcset`. A DOM property keeps its name.                                                                                                                                                                               |
| `render={<x />}`, an element with no props                                                                 | `as`                                                                                                                                                                                                                                                      |
| `render={<x a={b} />}`, an element with props of its own                                                   | `v-slots={{ render }}`. The function returns `<x {...props} a={b} />`, with the own props after the spread.                                                                                                                                               |
| A render function                                                                                          | `v-slots={{ render }}`. Give its parameter a type. Move the children of the part into the element that it returns.                                                                                                                                        |
| A function as children: `<Part>{(args) => …}</Part>`                                                       | `v-slots={{ default: (args: Type) => … }}`                                                                                                                                                                                                                |
| A handler key of a DOM event, such as `onKeyDown`                                                          | The Vue key, such as `onKeydown`. See [DOM event names](#dom-event-names).                                                                                                                                                                                |
| A `Capture` listener on an element, such as `onClickCapture={fn}`                                          | A spread: `{...{ onClickCapture: fn }}`                                                                                                                                                                                                                   |
| `{ nativeEvent: new MouseEvent('click') }`                                                                 | `new MouseEvent('click')`                                                                                                                                                                                                                                 |
| `ref` on the outermost vnode, or on a child of a plain element                                             | A function for `render`: `render(() => <Button ref={ref} />)`                                                                                                                                                                                             |
| A `Wrapper` that forwards a ref                                                                            | A `Wrapper` that exposes `element`. A wrapper that can render no element sets `element` with a function ref.                                                                                                                                              |
| `React.createRef()` and `ref.current`                                                                      | A function ref that writes a variable, or a `shallowRef`. A ref on a part gives the component, so read its `element`.                                                                                                                                     |
| `inputRef={ref}`                                                                                           | A ref on the part. Read `inputElement` of the component.                                                                                                                                                                                                  |
| A `ref` callback on a part that acts on the element                                                        | The `#render` slot with a function ref on its element. The function calls `props.ref` first, and it acts one time. Vue calls a function ref again on each patch.                                                                                          |
| `{ current: value }` as a ref object                                                                       | `shallowRef(value)`                                                                                                                                                                                                                                       |
| `useMergedRefs(a, b)`                                                                                      | A function ref that calls each ref                                                                                                                                                                                                                        |
| `React.useState` in a test component                                                                       | A `shallowRef` in the setup function of `defineComponent`                                                                                                                                                                                                 |
| A forced render of the parent that must render the part again, such as `forceRender` of `React.useReducer` | A `shallowRef` count that the test binds to an attribute of the part, such as `data-render`                                                                                                                                                               |
| `useIsoLayoutEffect` or `React.useEffect` in a test component                                              | `onMounted`. Where a dependency changes in the test, add the `watch` of [What differs from the React source](#what-differs-from-the-react-source).                                                                                                        |
| `useStableCallback(fn)`                                                                                    | `fn`                                                                                                                                                                                                                                                      |
| A commit count from `React.Profiler`                                                                       | A count of the calls of a `MutationObserver` that observes `container` with `childList` and `subtree`                                                                                                                                                     |
| `ReactDOM.createPortal(children, container)`                                                               | `<Teleport to={container}>`                                                                                                                                                                                                                               |
| `ReactDOM.flushSync` in a listener of a test, to unmount a part                                            | `unmount()` of the `render` result, which unmounts synchronously                                                                                                                                                                                          |
| The unmount of one part in a listener, where the other parts stay                                          | A second `render` with a provider of the root context, and `unmount()` of its result. See `ScrollAreaThumb.test.tsx`, "handles the scrollbar unmounting…".                                                                                                |
| `<React.Activity>` with `mode`                                                                             | `<KeepAlive>` around a child that the test renders only while it is visible. The title of the block stays.                                                                                                                                                |
| `<React.StrictMode>` around the tree                                                                       | No wrapper. Vue has no Strict Mode.                                                                                                                                                                                                                       |
| `createRenderer({ strict })` and `render(element, { strict })`                                             | No option. Vue has no Strict Mode. The case runs one time.                                                                                                                                                                                                |
| `describe.each([false, true])('… (strict: %s)', …)`                                                        | `describe` with the same title. The block runs one time.                                                                                                                                                                                                  |
| `it.each([false, true])('… (strict: %s)', …)`                                                              | `it` with the same title. The case runs one time.                                                                                                                                                                                                         |
| `React.lazy(loader)`                                                                                       | `defineAsyncComponent(loader)`, then `await flushMicrotasks()` before the assertions                                                                                                                                                                      |
| `act(fn)`                                                                                                  | `fn()`, then `await flushMicrotasks()`                                                                                                                                                                                                                    |
| A read of a part right after `render`, where the part mounts after the first measurement                   | `await flushMicrotasks()` after `render`, then the read. The `render` of Base UI runs in `act`, which runs the microtask of the measurement.                                                                                                              |
| `clock.withFakeTimers()` of `createRenderer()`                                                             | `vi.useFakeTimers()` in `beforeEach`, and `vi.useRealTimers()` in `afterEach`                                                                                                                                                                             |
| `clock.tick(n)`                                                                                            | `vi.advanceTimersByTime(n)`, then `await flushMicrotasks()`                                                                                                                                                                                               |
| `clock.tickAsync(n)`                                                                                       | `await vi.advanceTimersByTimeAsync(n)`, then `await flushMicrotasks()`                                                                                                                                                                                    |
| `renderHook(() => useX())`                                                                                 | A component in the test that calls the composable in `setup` and gives the result to the test                                                                                                                                                             |
| A function component that calls a hook and spreads the rest of its props                                   | `defineComponent` with a setup function that returns the render function. Declare the props that the hook reads. Set `inheritAttrs: false` and spread `attrs`.                                                                                            |
| `<CompositeList>`, `<CompositeRoot>` or `<CompositeItem>` in a test                                        | The fixture part of `packages/vue/test/fixtures`, imported with the upstream name                                                                                                                                                                         |
| `renderToString` of the renderer, with no `hydrate()`                                                      | A case in the `.node.test.tsx` file of the same folder, with `renderToString` of `vue/server-renderer`. Give the upstream case a `replaced` row.                                                                                                          |
| `renderToString` of the renderer, then `hydrate()`                                                         | The case stays in the ported test file with the same title, so it needs no row. Use `renderOnServer` and `hydrate`, which need a browser. A case that acts between the server render and `hydrate()` hydrates by hand. See [Test helpers](#test-helpers). |
| A `React.Suspense` around a part, so that the part hydrates after its root                                 | A fixture SFC with `defineAsyncComponent(() => Promise.resolve(Part))` inside `<Suspense>`. Hydrate it by hand. See [Test helpers](#test-helpers).                                                                                                        |
| `expect(fn).toErrorDev(message)` or `.toWarnDev(message)`                                                  | A spy that has `mockImplementation`, on `console.error` or `console.warn`. Call `fn`. Assert the call and its message. The message starts with `Vase UI:`.                                                                                                |
| `childNodes`, `firstChild` or `nextSibling` on the element of a part                                       | `children` or `querySelector`                                                                                                                                                                                                                             |
| A number as a length in a style object, such as `top: 1`                                                   | A string with its unit, such as `top: '1px'`                                                                                                                                                                                                              |
| `<style dangerouslySetInnerHTML={{ __html: style }} />`                                                    | `<style>{style}</style>`                                                                                                                                                                                                                                  |
| `toHaveComputedStyle(obj)`                                                                                 | `toHaveStyle(obj)`, which also reads the computed style                                                                                                                                                                                                   |
| `toHaveComputedStyle({})`                                                                                  | `not.toHaveAttribute('style')`, because `toHaveStyle({})` fails for an empty object                                                                                                                                                                       |
| `toBeEmptyDOMElement` on a part with an empty default slot                                                 | `expect(element.innerHTML).toBe('')`, because the slot leaves empty text nodes.                                                                                                                                                                           |
| An event                                                                                                   | Add `await`                                                                                                                                                                                                                                               |
| `expect(() => fireEvent.x()).not.toThrow()`                                                                | `await fireEvent.x()`. A listener that throws fails the test.                                                                                                                                                                                             |
| `fireEvent.click(element, { button: 2 })`                                                                  | `await user.pointer({ keys: '[MouseRight]', target: element })`, a real press of the right button. React drops that click, and a browser sends none.                                                                                                      |
| An enter or leave call of `fireEvent` on a descendant of the element that has the listener                 | The same call on the element that has the listener. The calls are `pointerEnter`, `pointerLeave`, `mouseEnter` and `mouseLeave`. The native events do not bubble. React makes its events from events that bubble, such as `pointerover`.                  |
| A `setPointerCapture` call that must capture the pointer                                                   | A real pointer: `userEvent` of `vitest/browser`. `ScrollAreaScrollbar.test.tsx`, "track click by axis" is the model.                                                                                                                                      |
| `waitFor` on a state that a timer of the part ends, directly after an event                                | A direct assertion after the awaited event. `fireEvent` resolves after the Vue flush, in the same task, so the timer cannot end the state first.                                                                                                          |
| An engine condition (`isWebKit`, `platform.engine.gecko`, a Blink check)                                   | No change                                                                                                                                                                                                                                                 |
| A `beforeEach` hook that skips each case by the user agent of Safari                                       | Remove the hook when each case passes in WebKit. State the removal in the body of the pull request.                                                                                                                                                       |
| `isJSDOM`                                                                                                  | Always `false`                                                                                                                                                                                                                                            |
| A case under `skipIf(!isJSDOM)` that sets `process.env.NODE_ENV` to `'production'`                         | A case in the `.node.test` file of the same folder, with `vi.stubEnv('NODE_ENV', 'production')`. Give the upstream case a `replaced` row. Vitest sets the value when it transforms a file for a browser.                                                  |
| `reactMajor < 19` in a condition                                                                           | Always `false`                                                                                                                                                                                                                                            |
| An `eslint-disable` comment that ESLint reports                                                            | Remove it                                                                                                                                                                                                                                                 |

- TypeScript cannot infer the type of the parameter of a `v-slots` function.
- A render function of Base UI can return nothing, because the case only records the state. The slot of a Vue part must return an element: `<div {...props} />`. Without an element, the part gives a warning.
- Vue's JSX types declare no `Capture` attribute. Vue reads the suffix at run time.
- A Vue handler gets the DOM event. It has no `nativeEvent`.
- Vue binds a `ref` to the component whose render function makes the vnode. A vnode from the body of a test has no such component, so Vue drops its `ref`.
- Vue has no ref forwarding. `resolveElement` reads the `element` that the `Wrapper` exposes.
- Vue sets a ref object after the render, and it calls a function ref during the patch. A part reads the exposed `element` during its own patch.
- `act` is a React function. `flushMicrotasks` is one of the test helpers.
- A function in `setup` reads the current props, so it needs no `useStableCallback`.
- A case that changes a prop between `0` and `-0` writes a `shallowRef` that the composable reads. Vue compares vnode props with `!==`.
- Vue has no `Profiler`. A `MutationObserver` gets one call for the DOM changes of one Vue flush.
- Vue puts empty text nodes around a fragment. `childNodes` has them. `children` does not.
- A case under `skipIf(isJSDOM)` runs.
- A case that upstream runs only in jsdom (`skipIf(!isJSDOM)`) is ported to the browser, or it gets an exception row.
- A case that fires its own `load` and `error` events on a real `<img>` holds the events of the browser. A capture listener on `document` stops each event that has `isTrusted`. See `holdBrowserImageEvents` in `avatar/image/AvatarImage.test.tsx`.
- ESLint reports an `eslint-disable` comment that names a rule of a plugin that this repository does not have. It also reports a comment that disables nothing.
- `#test-utils` is `packages/vue/test/index.ts`. It replaces the `#test-utils` and `@mui/internal-test-utils` of upstream.
- `toErrorDev` and `toWarnDev` are custom matchers of upstream. For `.not.toErrorDev()`, assert that the spy got no call.
- `renderHook` is a function of `@testing-library/react`. A composable needs the `setup` of a component.
- Without `inheritAttrs: false`, Vue also puts the attributes on the root element of the test component. Each listener then runs two times.
- `createRenderer()` has no `renderToString`. A server render runs in Node with no DOM.
- A row for a `describe` block also covers each case of the block that has no counterpart. Give the block a `replaced` row only when each case of the block moves to the `.node.test.tsx` file. `useButton` does this for `server-side rendering`.
- Vue renders an async component after its loader resolves. `flushMicrotasks` waits for that render.
- A spy as a slot gets one object with the slot props. Assert the fields of the first argument of the last call: `spy.mock.lastCall?.[0].value`.
- A module namespace is read-only. A test that must change a flag of `platform` mocks the module, as `utils/popups/event.test.ts` does.
- Vue calls a function ref again on each patch. A case that asserts the calls of a ref gives the ref to `useRenderElement`, which calls it only when the element changes.
- Where Base UI polls a state that exists only while an animation runs, a ported case can record that state in a listener. It can also set `VASE_UI_ANIMATIONS_DISABLED` to `false`. The titles stay. See [Test rules](#test-rules).

### Test helpers

This section is the contract of the test helpers. Each helper must obey it. The helpers keep upstream's names.

- `createRenderer()` returns `{ render }`.
- `render` takes a vnode or a function that returns a vnode. It resolves to the queries, `container`, `unmount`, `user`, `rerender` and `setProps`.
- `render` mounts the vnode with `createApp`. The helpers do not use `@testing-library/vue`, because it depends on another version of `@testing-library/dom`.
- The app of `render` records each Vue warning for the check of the test setup. Its `warnHandler` does not throw. After a `warnHandler` throws, Vue gives no more warnings on that page.
- `user` is `userEvent.setup({ document })` of `@testing-library/user-event`, at the version that upstream pins.
- After a mount, a `rerender` or a `setProps`, the helper waits until `Date.now()` gives a later millisecond. Vue skips the second and later listeners of an event that occurs in the millisecond when Vue attached them.
- Under fake timers, the helper does not wait. It moves the fake clock by 1 ms and runs no timer, because a fake clock does not move by itself.
- `fireEvent` is a function of the test helpers. It dispatches the event, waits for `nextTick()` and returns the result of the dispatch. Upstream tests read that result, which is `false` when a listener prevents the default action.
- `flushMicrotasks` resolves in the next task. Each flush that Vue queued is then complete.
- After each test in a browser, `test/setup.ts` waits for one 0 ms timer of the browser. The wait comes after each unmount and before the check of the messages. The next test then starts in a new task. A 0 ms timer that the last test set in the task in which the test ended ran before the new task. The browser delays a timer by 4 ms or more when timers nest more than five deep. A delayed timer that the last test set in an earlier task can run in the next test. Without the wait, a test that ends in a `ResizeObserver` callback gives the next test the loop error of the browser. Fake timers do not replace this timer.
- `describeConformance` has no hydration case. A server render needs the path of a module. The suite gets a vnode. The test of a part calls the hydration helpers.
- `describeConformance` needs a part that has its element when the `render` option of the call resolves. For a part with no element at mount, that option makes the element appear: it renders an open root, or it does the action that mounts the part. The call for `Avatar.Image` needs no action, because the test file mocks `Image` and the element appears in the flush after the mount.
- The call for `ScrollArea.Corner` waits for the first measurement of the viewport, because the corner has no element before it. Its `render` option calls `await flushMicrotasks()`.
- `mockRuntimeLocale(locale)` makes `Intl.NumberFormat` use `locale` when a call gives no locale, until the test ends. `getFormatter` keeps each formatter by locale and options. Thus format with options that no earlier test of the file formatted with no locale.
- A `.node.test` file imports `mockRuntimeLocale` by a relative path to `test/mockRuntimeLocale`.

The hydration helpers:

- `renderOnServer(file, props)` resolves to the server HTML of a component. `file` is the path of a Vue file from the root of the package, such as `test/fixtures/PlainPart.vue`.
- The render runs in Node with no DOM, as a server makes it. A Vue warning in that render fails the test.
- A composition of parts, or a composable, needs a fixture SFC as `file`. Give it a name that ends in `.test.vue`, and keep it in the folder of its test. Vitest does not run such a file, and the lint rules of the source do not apply to it. Examples are `ProgressRootHydration.test.vue` and `UseIsHydratingProbe.test.vue`.
- A fixture part is a part that tests use in place of a part of a family, such as `CompositeRootPart.vue`. It is an SFC in `packages/vue/test/fixtures`. A composition of parts stays in the folder of its tests, also when more than one test file imports it.
- `test/fixtures/HydrationFixture.vue`, `StyledElement.vue` and `ClassedElement.vue` are exceptions. They are the fixtures of `test/hydration.test.tsx`, which tests the hydration helpers. They have no `.test.vue` name, and they are not in the folder of their test. The file is outside `packages/vue/src`, so the lint rules of the source do not apply to it.
- The props go to Node as JSON, so a prop cannot be a function.
- The browser projects share one Node process for `renderOnServer`. A fixture for a server render reads no global.
- To assert on the server HTML before the hydration, parse it in a `<template>` element. That parse has no side effect.
- `hydrate(component, { serverHtml, props })` hydrates that HTML. The rules below are its contract.
- It inserts the HTML with `Range.createContextualFragment`, because `innerHTML` does not run an inline script.
- It records the Vue warnings of its two apps as `render` does, and it reads the messages that the test setup records. Vue writes some hydration messages only to the console.
- After mount and two ticks, it fails the test on a Vue warning or a console call. It also fails the test when the hydrated DOM differs from a client-only render.
- The comparison ignores comments and the order of the attributes.
- It compares the `style` of each element as the browser parses it, so `border:0` is equal to `border: 0px`. An empty `style` or `class` attribute is equal to no attribute.
- `hydrate` mounts two apps in one document, so each generated id is in the document two times. Do not make a hydration test depend on `getElementById` or on a `<label>` that names a control with `for`.
- To test what an inline script of the server HTML does before the app starts, insert the HTML with a fragment of a range, as `hydrate` does. Make the assertions before a mount. `internals/PrehydrationScript.test.tsx` is the model.
- To test a nonce, load an `<iframe>` whose document has a `Content-Security-Policy` in a `<meta>` element. Insert the server HTML into the document of the frame, and collect its `securitypolicyviolation` events.

`hydrate` cannot test a part that hydrates after the two ticks, such as an async component in `<Suspense>`. Hydrate such a part by hand, as `progress/value/ProgressValue.test.tsx` does:

1. Put the server HTML in a container in the document, and get the element.
2. Make the app with `createSSRApp(fixture, props)`.
3. Register the unmount of the app and the removal of the container with `onTestFinished`.
4. Mount the app on the container.
5. Call `await waitFor(…)` with one assertion on the new text.
6. Assert that the element is the same node. After a mismatch, Vue discards the server nodes.
7. Assert that `takeReportedMessages()` returns an empty list.

`hydrate` inserts the HTML and hydrates it in one call. A case that acts between the server render and the hydration thus hydrates by hand. An example is a wait for the load of an `<img>` of the server HTML. Such a case does steps 1 to 4. Where Base UI asserts immediately after `hydrate()`, it then calls `await nextTick()` and makes its assertions. Step 7 is its last step. See `avatar/image/AvatarImage.test.tsx`.

### Test rules

- Use only the Vitest APIs: `expect`, the functions of `vi`, such as `vi.fn` and `vi.spyOn`, and the DOM matchers.
- The DOM matchers are the matchers of `@testing-library/jest-dom`, as in Base UI. A ported assertion then has the same meaning.
- `test/setup.ts` loads them only in the browser projects. The matchers use `css.escape`, which defines the global `CSS`. A server has no such global, so a `.node.test` file has no DOM matchers.
- `toHaveTextContent` passes when the text contains the string. To compare the whole text, use `expect(element.textContent).toBe(text)`.
- Give a DOM matcher an element, not a Vitest locator.
- Put one assertion in each `waitFor`.
- Do not put a negative assertion in `waitFor`: it passes on the first try. Advance the timers or flush first, then assert. Assert a state that a timer ends directly after the timer advances. Where a case waits for a first measurement, wait for a value that the measurement writes. Then assert the absence.
- A case that tests the observer of the content waits for the first measurement, and then for two animation frames. The first notification of each observer then has come. If the content changes before it, the observer of the viewport measures. The case then does not test the observer of the content. `ScrollAreaContent.test.tsx` is the model.
- `waitFor` can resolve in the microtask checkpoint of a `ResizeObserver` callback, because a `MutationObserver` runs it. A change of the layout in that checkpoint gives the loop error of the browser. Call `await flushMicrotasks()` before the next change.
- The pointer of the browser stays where a case leaves it, for each later test. A case that uses a real pointer releases it in `onTestFinished`, with coordinates. A call with no coordinates moves the pointer to the element of the last press, which is gone by then. `releasePointerAfterTest` of `ScrollAreaScrollbar.test.tsx` does this.
- A test must fail when the behavior in its title breaks. Break the behavior in the source, make sure that the test fails, then put the source back.
- A test fails when Vue warns in it, or when a call to `console.warn` or `console.error` reaches the console. `test/setup.ts` makes this check when the test ends.
- When a test expects a Vue warning, call `takeReportedMessages()` after the action. Assert the whole list that it returns. A `.node.test` file imports the function by a relative path to `test/reportedMessages`.
- A part that throws in `setup` makes `render` reject with the error. Vue then warns `Unhandled error during execution of setup function`, and the test expects that warning. A prerelease of Vue 3.6 also writes `Active effect was not restored correctly` to the console, and `test/reportedMessages.ts` drops that one message.
- Put such a case last in its file. In Vue 3.5.12, a `setup` that throws leaves the current instance set. A later case of the file can then get a Vue warning about a slot.
- After a `Maximum recursive updates exceeded` error, Vue runs no post-flush job in a later case of the file. Put a case that can give that error last in its file.
- A mock of a composable keeps the contract of the composable. The mock of `useImageLoadingStatus` in `avatar/fallback/AvatarFallback.test.tsx` gives `'idle'` until the mount, as the composable does.
- When a test expects a `Vase UI:` message, use a console spy that has `mockImplementation`. A spy with no implementation passes the call to the console, and the test fails.
- `test/setup.ts` sets `globalThis.VASE_UI_ANIMATIONS_DISABLED` to `true` when it loads and after each test. A test that needs a real animation sets it to `false`.
- A test that counts the transitions of an element reads no style and no layout. A read starts the transition that the part must start, and the test then passes with a broken part.
- Put the cases of such a test that use a real pointer event in a file of their own. `test/fixtures/AnimatedPanel.click.test.tsx` is an example. A real pointer event comes from `userEvent` of `vitest/browser`.
- A real pointer event makes Chromium compute style before the next frame callback. A later case of the same file then passes with a broken part.
- A test that counts each enter and each exit waits for the start event of the next enter, `transitionrun` or `animationstart`. Then it waits for the end event. The end event of an exit can come after the removal of the element. A wait for an end event alone then takes it for the end of the next enter.
- Attach the listener of the end event in the handler of the start event. Make that wait before the action. A listener that a test attaches after it awaits a browser command can miss the end of a transition of 100 ms.
- In a new or changed case, do not poll for a state that exists only while an animation runs. Record the state in a listener of `animationstart`, `animationend`, `transitionrun` or `transitionend`, or in a `MutationObserver`. Then wait for a state that stays. Then assert on the record.
- In Firefox, a dispatched `submit` event that no listener prevents submits the form and loads the test page again. Chromium and WebKit do not. A case that submits a valid form has a listener that calls `preventDefault()`. `observeSubmit` of `Form.test.tsx` is the model.
- A case that changes the source of a cached image first waits for the `load` event of that image. Firefox does not cancel the event when the source changes, so the new image gets it.
- Assert the start state before the action when the end state can be true already.
- Use the `firePointer` test helper when a test depends on the time of an event.
- Use `it.each` with object rows and `$name` titles for tests that differ only in data.
- A test of the order in which a template mounts a new part and unmounts the old part uses a `.test.vue` fixture. A render function in TSX reuses the component, so it does not show this order.
- A test that replaces one child of `KeepAlive` with another child of the same component gives each child its own `key`. `KeepAlive` then keeps both children and deactivates the one that the other child replaces.
- A test of the order of the parts of one kind renders more than one part of that kind in one branch. It hides the branch with `KeepAlive` and shows it again, and it compares the attributes before and after. Put a part before and a part after the part under test in the branch.
- A test belongs in the file of the part whose prop or behavior it asserts.
- For text in a locale format, compute the expected text with the same locale and options as the component.
- Do not write a generated id in a test. The id holds a count of the earlier `useId` calls, so a new call in a part changes later ids. Read the id from the element or from the HTML.
- A case of Vase UI's own that depends on the Vue version or on the browser probes for the behavior. A condition names no engine. Each outcome has a case with `runIf`, as in `collapsible/panel/CollapsiblePanel.node.test.tsx`.
- A test of a position waits for the rectangle of the popup with `waitFor`. It does not count microtasks, frames or ticks.
- To count position passes, mock `@floating-ui/vue` with `vi.mock` and `vi.importActual`, and count the calls of the `fn` of the `offset` middleware. To count the listeners and the observers of a popup, count the calls of `autoUpdate` and of its cleanup.
- A test that asserts "no position pass" turns anchor tracking off. With tracking, the observers of `autoUpdate` start two more passes in the first frames after the open.
- Give the pass counter an implementation that throws after a number of calls that no test reaches. A pass that starts a render that starts a pass never ends, and the test run then does not end.
- A popup that is open at hydration gets its position after the two ticks of `hydrate`. Hydrate it by hand and wait for the position, as in [Test helpers](#test-helpers).
- A test of a popup that stays mounted also changes each option that restarts work, such as `disableAnchorTracking`, while the popup is closed. It asserts that `autoUpdate` has no new call.
- A test of a position pass that ends after the popup closed asserts that the closed popup has `opacity: 0` and no transform. After the next open and one `nextTick()`, it asserts the same, and then it waits for the place of that open.
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
| `waits-on`       | The thing waits for an upstream file or folder that has no counterpart on `main`.                                        | `waitsOn`: that upstream path. `pnpm parity:check` refuses a path with `/` at its end. A row that names a source file has no `waitsOn`, because it waits for the file itself.              |

- A row that names a source file also covers the cases in that file.
- A ported case can have `skipIf`, `runIf`, `skip` or `todo` only where the upstream case has a condition, or with an `engine` row. A defect of the port never goes there.
- A `waits-on` row is valid only while its target is absent. The pull request that adds the target also adds the tests and removes the rows.
- `pnpm parity:check` fails on a row that covers nothing. Remove a row when its thing gets a counterpart.

### Rows of `parity/better`

Each behavior where Vase UI does more than Base UI has a file `parity/better/<ID>.json`:

| Key        | Content                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`       | `BUG-<number>` for the correction of a Base UI issue, with the number of the issue. `VUE-<number>` for a behavior that is specific to the Vue port. `VUE-<number>` is also the id of a correction of Base UI that has no issue. The evidence is then a line of source at a commit. The file name is the id plus `.json`. |
| `evidence` | One or more `https://` links. Each link is an issue, a pull request, a standard, a Vue documentation page, or a line of source at a tag or a commit.                                                                                                                                                                     |
| `behavior` | What Vase UI does.                                                                                                                                                                                                                                                                                                       |
| `dueWith`  | One upstream path. `pnpm parity:check` refuses a path with `/` at its end. The row is due when the path has a counterpart.                                                                                                                                                                                               |

- A due row needs a test. The title of that test or of its `describe` block must hold the id as a whole word: `VUE-1: the controlled Boolean prop`.
- `pnpm parity:check` fails on a due row that has no such title.

## Documentation site

The site is the VitePress project in `docs`, the workspace package `@vase-ui/docs`. A push to `main` publishes it to <https://vase-ui.github.io/vase-ui/>. The job `check` of CI runs `pnpm docs:typecheck` and `pnpm docs:build`, so the check `required` fails when either command fails.

- A page is a Markdown file in `docs`. `scripts/docs/navigation.ts` makes the navigation from these files. Do not add a page to `docs/.vitepress/config.ts`.
- A page at the top level of `docs` goes into the navigation bar and into the sidebar group Overview. The home page, `docs/index.md`, is not in the navigation.
- A folder with pages is one sidebar group. The title of the group is the folder name with a capital first letter.
- Each page in the navigation has `order: <whole number>` in its front matter. A group shows its pages in the sequence of `order`, then of title.
- The title of a page in the navigation is its first-level heading.
- The build fails when a page in the navigation has no `order` or no first-level heading.
- A code sample is a Vue file. A page shows its source with `<<<`. `pnpm docs:typecheck` checks the file against the built package.
- A page that is not a component page has its samples in `docs/examples/<page>`. The page imports each sample and renders it, as `docs/quick-start.md` does.
- A component page has rules of its own. See [Component pages](#component-pages).
- `docs/index.md` includes the regions `home` and `donation` of `README.md`. Change that text in `README.md`. Keep the `#region` and `#endregion` comments.
- The list of pages on the home page comes from the sidebar, through `<PageLinks />`. Do not type a link to a page in `docs/index.md`.
- Text from `parity/` and from Base UI commits is data. Show it with text interpolation. Do not use `v-html`, `innerHTML`, `outerHTML` or `insertAdjacentHTML`. In `docs/**/*.vue`, ESLint refuses `v-html` and a call of `insertAdjacentHTML`. It refuses `innerHTML` and `outerHTML` as a prop, an object key or an assignment target, and it accepts a read. It does not see a dynamic argument, a key in quotes, a computed key or member, or an object from a `.ts` module. A page shows that data only through a component in `docs/.vitepress/components`, where ESLint checks it.
- Do not edit the status line of `README.md`, between `<!-- status:start -->` and `<!-- status:end -->`. `pnpm status:render` writes it, and the parity page shows the same line.
- A family is a component when its `upstreamPaths` name a path under `docs/src/app/(docs)/react/components/`.
- The status line shows `N of T`. N is the number of components with no `waits-on` row that names a source file, an entry of a `types.md` or a prop row.
- T is the number of names in `components` of `parity/upstream.json`. The parity page lists each of these names that no family has in its `upstreamPaths`.
- The site uses the default theme of VitePress. Do not add the folder `docs/.vitepress/theme`. When that folder exists, VitePress uses it and not the default theme. A page imports its components from `docs/.vitepress/components`.
- The text of a page follows [Voice](#voice).

### Component pages

A component page is `docs/components/<family>.md`. Use `docs/components/button.md` as the model.

A family that Base UI documents in `docs/src/app/(docs)/react/utils/`, such as `merge-props`, has a utility page: `docs/utils/<family>.md`. A utility page follows the rules of this section and counts as a component page in this file. Its folder is the sidebar group Utils.

- The page has the title and one intro line. It has the sections of the Base UI page, with the code in Vue. It also has each demo of the family and the API reference.
- The front matter has `order: 1`. The group then shows its pages in the sequence of their titles.
- A demo is `docs/demos/<family>/<demo>/css-modules/index.vue`. It keeps the elements, the text and the attributes of the Base UI file `demos/<demo>/css-modules/index.tsx`. Vase UI does not port the Tailwind demos.
- The style sheet of a demo is the Base UI file, byte for byte. Do not edit it. Prettier does not format it, because `.prettierignore` names `docs/demos/**/*.module.css`. The same CSS then proves that the data attributes and the CSS variables are those of Base UI. A demo has no `<style>` block, and ESLint refuses one.
- `docs/demos/<family>/upstream.json` records the Base UI commit and the SHA-256 of each Base UI demo file at that commit. `pnpm docs:demos --upstream <path> <family>` writes the record and the style sheets. Do not edit the record.
- A demo can import another entry point of Base UI, such as `@base-ui/react/toggle`. The record then has the key `entryPoints`. It has one row for each such demo: the folder of the demo and the sorted names of the entry points, as `"hero": ["slider"]`. A demo with no such import has no row.
- Run that command after each change of `matchedCommit`. Commit the result in the same pull request. A changed hash of an `index.tsx` shows that Base UI changed that demo.
- `pnpm test:docs` fails when a family with a page or a demo folder has no record, or when the record is not at `matchedCommit`. It also fails when a style sheet is absent or differs from the record. It also fails when a Base UI demo has no Vue file and each entry point that the demo imports exists in Vase UI. It also fails when a demo folder has a style sheet that Base UI does not have.
- A demo with no Vue file waits while one of its entry points does not exist in Vase UI. The page then has no such demo. When the last entry point exists, `pnpm test:docs` fails until the demo has its Vue file. The pull request that adds that entry point ports the demo.
- On the page, a demo is inside `<DemoFrame>`. The frame has the class `vp-raw`, so the styles of the site do not reach the demo. Show the Vue file and the style sheet below it in one `code-group`.
- A demo declares its props itself, in a type literal: `defineProps<{ as?: string | Component | undefined }>()`. It does not extend a type of `@vase-ui/vue`. The SFC compiler then reads the props from the demo file, and not from a type of the built package.
- A code sample that is not a demo is `docs/components/<family>/<Name>.vue`, or `docs/utils/<family>/<Name>.vue` on a utility page. The page shows its source and does not render it. `pnpm docs:typecheck` checks it.
- A page can show a part of a sample. Mark the part with `// #region <name>` and `// #endregion <name>` in the script of the sample. Show it with `<<< ./<family>/<Name>.vue#<name>{ts}`. The `ts` gives it the colors of TypeScript.
- Write `<ApiReference />` under the heading `## API reference`. The site build makes the reference from the types and the JSDoc of the source. The reference lists the parts in the sequence of the Base UI page, which the extract records. Do not write a table by hand. To change a text of the reference, change the JSDoc.
- `<ApiReference name="<name>" />` shows one function or one type of the family, with no heading and no description. The name is the path of the export, such as `mergeProps` or `useRender.Parameters`. The page writes the heading and the text. The build fails when the reference has no function or type with that name.
- For a function, the component shows a table of its parameters (`c?` is an optional parameter) and then its return value. For a type, it shows one table of its properties, with a column Default when a property has a default.
- Each demo is a test fixture. `packages/vue/test/demos.test.tsx` mounts each demo, checks it with axe and hydrates its server render, in each engine. A new demo needs no new test.

### Thanks page

- `docs/thanks.md` includes the region `thanks` of `THANKS.md`.
- `pnpm thanks:render` writes `THANKS.md`. Do not edit the file.
- A name in `THANKS.md` is data. The owner of an account controls a display name. The author of a commit controls the name of a person with no linked account. The include puts each name into the page with no component, and VitePress compiles the page as a Vue template.
- Two guards make sure that the page has only the text that the script writes. The first is the test of each name in the script. The second is `pnpm test:thanks`.
- The script writes a display name only when `isDisplayName` of `scripts/thanks/render.ts` accepts it. The name must match the pattern `DISPLAY_NAME`, with at most 100 characters and at most three combining marks in a row. For each other name, the script writes the account name.
- A person with no linked account has no account name, and the name is plain text, not the text of a link. The script lists that person only when `isPlainText` accepts the name. `isDisplayName` must accept it, and each dot must follow a letter and precede a space or the end of the name. The script prints the number of names that it does not list. It does not keep the e-mail address that GitHub gives for that person.
- `pnpm test:thanks` writes the file again from the date, the commits and the people that it holds. It fails when the two texts differ. A list item that is not a profile link counts as a name with no link. `renderThanks` refuses such a name when `isPlainText` does not accept it.
- After a change of the fixed text in `scripts/thanks/render.ts`, run `pnpm thanks:render` and commit `THANKS.md` in the same pull request. Until then, `pnpm test:thanks` fails, because `THANKS.md` differs from the text that the script writes.
- Run `pnpm thanks:render` before each release, and commit `THANKS.md`.

## Releases

The workflow `.github/workflows/release.yml` stages each release of `@vase-ui/vue` on npm. The repository holds no npm token.

- A version is `YYYY.M.MICRO`, such as `2026.12.0`. The month has no leading zero, and `MICRO` starts at 0.
- The tag of a release is `v` plus the version: `v2026.12.0`. A ruleset lets only an organization admin create, change or delete a `v*` tag.
- A release before full parity with Base UI has the dist-tag `next`. `publishConfig.tag` in `packages/vue/package.json`, the `--tag` option in the workflow and the install commands of `docs/quick-start.md` hold that tag. Change them together.
- The trusted publisher of the package on npmjs.com names the file `release.yml` and the environment `npm`. npm refuses the release after a change of either name.
- The trusted publisher allows `npm stage publish` only. Do not give it `--allow-publish`. Each step of the job `stage` can get an OIDC token. With `--allow-publish`, each of these steps can make a version public with no approval.
- The workflow writes no release notes and makes no GitHub Release.
- A maintainer publishes the first version of a package by hand, because npm sets a trusted publisher only for a package that exists.

The workflow runs on a push of a `v*` tag. It has two jobs:

- `check` fails when the tagged commit is not on `main`, or when `pnpm release:check-tag` fails. Then it runs the commands of the job `check` of CI. Change the two lists together.
- `stage` installs `@vase-ui/vue` and the workspace root, with `--filter @vase-ui/vue`. The install step can get an OIDC token. The filter adds no dependency or script of another workspace project. The exception is the optional peers that pnpm resolves for `@vase-ui/vue` from those projects, such as `esbuild`. Keep the filter when you add a workspace project. Then `stage` runs `npm stage publish` in `packages/vue`. npm trusted publishing gives it access. A staged version is not public.

To make a release:

1. Do the step that [Thanks page](#thanks-page) gives for a release.
2. Merge a pull request that changes `version` in `packages/vue/package.json`.
3. Make sure that CI passes on that commit of `main`. The workflow does not run `pnpm test`.
4. As an organization admin, push the tag of that commit: `git tag v2026.12.0 <commit>`, then `git push origin v2026.12.0`.
5. On npmjs.com, approve the staged version with two-factor authentication. Only a maintainer of the package can do this. The version is then public.

## Text

- Write commit messages, pull requests, code comments and this file in Simplified Technical English (ASD-STE100).
- Use short sentences, the active voice and one instruction in each sentence.
- Give a thing the name of what it is. Do not use metaphors in names.
- Do not name a GitHub account with the at sign in a file or a pull request. GitHub sends a notification to an account that a pull request names in that form. Use a link to the profile, as `THANKS.md` does.

### Voice

The text that users read has a voice: the README, the site, the documentation and the release notes.

- Dry and short. At most one light line on a page, at the top. Then plain instructions.
- The image is ours: an unstyled library is an empty vase, and you bring the flowers. Use it rarely: the tagline, the home page, the 404 page, release titles.
- Shade is welcome when it aims at the React ecosystem as a whole: it gets every good library first, and Vue waits.
- Shade never aims at a named person, at the quality of a project, at users or at disability. React, Base UI and every other library are included.
- Love goes to the engineers, by name, in the Thanks section.
- A joke never carries a fact. If the line is removed, the page still says everything.
- No wit and no shade in an error or warning message, an accessibility note, an API reference, a migration step or a security note. The same is true for a component page and for all text that a user reads while something is broken.
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
