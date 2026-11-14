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
- A `types.md` can also have a prop row for a native attribute that the React part does not read. An example is `aria-valuetext` of `Progress.Root`. Do not declare that prop: the attribute goes to the element through `$attrs`, with its type from `HTMLAttributes`. Give the row a `not-applicable` exception row. The part can give such an attribute a default, as `NumberField.Input` does for `aria-roledescription`. The part sets the default before the attributes of the consumer, so the attribute of the consumer wins.
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

A family can land in more than one pull request. Its `index.ts` then comes in the last one, so the package exports nothing of the family before then. The tests of the earlier pull requests import `../index.parts`.

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
- Omit a native attribute that the part declares as a prop with the same key: `Omit<ButtonHTMLAttributes, 'disabled'>`. Do not omit an `aria-*` attribute. See [Props](#props).
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
- A part whose default tag depends on its context, such as `NavigationMenu.Root`, has no default for `as`.
- It decides the tag one time in `setup`. It gives the tag to `useRenderElement` as the first argument.
- Its template binds `:is="as ?? defaultTag"` in the second line.
- Base UI documents the default tag. When the family has an entry point, the family file needs a `not-applicable` exception row for the prop row `render`.
- A part that renders no element has only `<slot />`. It does not set `inheritAttrs`. Vue then shows a warning in a development build when the part gets an attribute or a listener. With `inheritAttrs: false`, Vue drops them and shows nothing.

A part that Base UI writes as another part renders that part and no element of its own. `Toolbar.Separator` and `Input` are the examples:

- Set `inheritAttrs: false`. Bind `{ ...$attrs, ...props }` on that part. The declared props are not in `$attrs`, so the spread gives both.
- Give the `#render` slot to that part, and the default slot when the part has one. A slot does not reach a child unless the template gives it.
- Declare each event of that part with `defineEmits`. Vue then takes the listener out of `$attrs`. Listen to the event on that part. Emit it again at once with the same arguments. That part reads `details.isCanceled` after its emit returns, so a `details.cancel()` still stops `update:x`.
- Expose the `element` of that part.

### Parts with nodes of their own

Some upstream parts put nodes of their own in the element. Examples are the range input of `Slider.Thumb` and the focus guards of `Toast.Viewport`.

- Each such part has one internal SFC, `<Part>Children.vue`.
- That SFC reads the values that its nodes need with `inject`. `ProgressRootChildren.vue` needs none, so it calls no `inject`. A part that is not a root provides these values itself: `Field.Error` provides its message in `FieldErrorContext`.
- It renders the nodes around its default slot, in upstream's order.
- The `#render` slot of the part gets a third slot prop, `children`, which is that component.
- A consumer writes `<a v-bind="props"><component :is="children">…</component></a>`.
- A development build shows a warning when the `#render` slot does not mount `children`. The part makes this check together with the check for the element of the slot.
- The part passes `children: true` to `useRenderElement`. `<Part>Children.vue` calls `markChildrenMounted()` in setup. The warning needs the two calls.
- The Viewport part of a popup family has no `<Part>Children.vue`. Its `children` is `utils/popups/viewport/PopupViewportChildren.vue`. `test/fixtures/PopupViewportPart.vue` is the model.

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
- A part that is its own control declares `aria-label` and `aria-labelledby` as props, because `useAriaLabelledBy` watches them. Each prop gets a `surfaceAdditions` row. A root whose control is another part, such as `NumberField.Root`, declares neither. [Props](#props) gives the form of each prop.
- Vue writes `checked` to an input only when the value changes between two renders. Hydration does not write it. The part thus writes its state to the input after the mount and on each `pageshow` event of the window. Chromium restores the form state of a page after `load`.
- The part also writes its state to the input in the tick after a click that it accepted. A parent that controls the part can keep the old value.
- A part with an `indeterminate` state writes that property to the input in the same function as `checked`, and again after each change of `indeterminate`. A click on the input clears the property, and the write in the tick after an accepted click sets it again. A script that writes `checked` does not clear the property. A server cannot write it, because HTML has no attribute for it.
- A part with a `value` input does not write its state after the mount, because hydration writes `value`. It writes its state on each `pageshow` event, and in the tick after each `input` and `change` event of the input. `NumberField.Root` does this.
- Such a part handles an `input` or a `change` event only when the value of the input is new. A program can send both events in one task, and the part then handles the first one. [What differs from the React source](#what-differs-from-the-react-source) says when a value is new.
- For a change that a listener cancels, the part calls `preventDefault` on the click of the input. The browser then puts the old state back.
- In a group with one input for each item, each item writes its state to its input after each change that no listener cancels. A browser unchecks the other inputs of a named group when one input gets checked. A parent that controls the group can also keep the old value.
- A control whose field can have more than one input registers its input with `validation.registerInput` in the `ref` setter. It keeps the function that `registerInput` returns, and calls it when the input changes or goes away. It does not write `validation.inputRef`.
- `KeepAlive` takes the input out of the document and calls no `ref` setter. The control calls the function that `registerInput` returns in `onDeactivated`. The field then does not validate an input that the user cannot reach.
- The control registers the input again in a `watch` of a flag that `onDeactivated` and `onActivated` set. A registration in `onActivated` would reverse the order of the inputs, because `KeepAlive` runs those hooks from the last part to the first part. `Radio.Root` is the model.
- The part calls `useFormReset(input, onReset)` of `src/internals` in `setup`. The composable listens to `reset` on the root node of the input, because the form of the input can change. It ignores an event whose target is not the form of the input when the event arrives. It calls `onReset` in a 0 ms timeout, after the listeners of the event. It does not call `onReset` when a listener prevented the event. In `onReset`, an uncontrolled part goes back to its default value through its change event, with the `reset` event in `details`. A controlled part does not change. After each reset that the part follows, the part clears the error of its field with `useClearFieldError`, also when its value does not change. The change of a reset starts no validation.
- A group that has one input for each item, such as `RadioGroup` and `CheckboxGroup`, does not call `useFormReset` itself. The input that `RadioGroup` exposes changes with the value, and it can be absent. `CheckboxGroup` exposes no input. `useFormReset` also drops a reset that waits when its input changes. Each item thus calls `useFormReset` with its own input. The group handles the first call for each `reset` event.
- `CheckboxGroup` follows the reset of each form that has an input of one of its items. An uncontrolled item whose state the group does not hold goes back to its default value through its own change event. A checkbox with no `value`, and with no `name` of its own or of its field, is such an item. The group clears the error of the field, so such an item does not.
- A part inside a root can validate each change of the value of the root. The root then sets a flag in its context for the change of a reset, and the part starts no validation while the flag is set. `NumberField.Root` does this with `isResetChangePending`. The root clears the error of the field itself.

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
- The SFC compiler cannot read a type of the DOM library, such as `ValidityState`. In a union with `boolean`, the production build then keeps `Boolean` alone. For any other value, Vue warns in a development build of the consumer. Write the other member with a type of the package, as `Field.Error` does: `boolean | keyof FieldValidityData['state']`.
- A Boolean prop with the default `true` cannot tell an absent prop from `true`. A check of Base UI for a prop that is set thus runs only for `false`. `Menu.Root` does this for `modal` on a nested menu.
- Declare a required prop that can be `null` as `x: T | null`, such as `value` of `Progress.Root`. The SFC compiler then writes `required: true`, and Vue accepts `null` with no warning.
- The props interface of a part can extend an `Omit` of the props interface of another part. The other interface can be in another `.vue` file and can have a type parameter. The SFC compiler reads the kept props, and each keeps its JSDoc. `AlertDialogRoot.vue` is the example.
- Do not give a constant of `setup` the name of a prop. The SFC compiler then reports that name as a constant, and `pnpm parity:check` does not find the prop. `ProgressLabel.vue` declares the prop `id`, so its constant is `labelId`.
- Write the default of a prop that a `types.md` row documents as a literal in `withDefaults`: `delay: 600`. `pnpm parity:check` compares the text of the default, so a constant such as `OPEN_DELAY` fails the check.
- A native attribute that a part must watch is a declared prop. The Vue documentation says that `$attrs` is not reactive. `Avatar.Image` declares `src`, `srcset`, `sizes`, `crossorigin` and `referrerpolicy` for this reason.
- Declare the prop of an `aria-*` attribute in camel case: `ariaLabel` for `aria-label`. Vue gives the attribute `aria-label` to that prop.
- Do not omit the `aria-*` key from the attributes type that the interface extends. vue-tsc keeps an `aria-*` name of a template as it is, because its `htmlAttributes` option names `aria-*`. Without the key, `<Switch.Root aria-label="Wi-Fi">` fails the type check of a consumer that sets `strictTemplates`.
- A template and TSX then accept `aria-label` and `ariaLabel`, each as a `string`.
- Add each such prop to the type tests `packages/vue/test/AriaAttributesInTemplate.spec.vue` and `packages/vue/test/ariaAttributes.spec.tsx`.
- A generic SFC is not assignable to `as` of another part. vue-tsc types it as a function that `as` does not accept, so `<Toolbar.Button :as="ToggleGroup">` fails the type check.
- A part that a consumer must be able to give to `as`, such as `Toggle`, is not a generic SFC. It keeps the type parameter on its exported props interface: `ToggleProps<Value extends string = string>`, with `defineProps<ToggleProps>()`. `ToggleGroup` is a generic SFC, because the type of its `valueChange` event follows `Value`.
- A popup trigger is the exception. It is a generic SFC, because its `payload` must have the type of its `handle`. Give another part to its `as` or to its `#render` slot. Do not give the trigger to the `as` of another part.
- Base UI takes a `React.ReactNode` as the label of an item. A label comes from an `items` record, from an `items` list, or from an object value that has a `label`. Vase UI takes an `ItemLabel`, which `src/internals/resolveValueLabel.ts` exports.
- An `ItemLabel` is a string, a number, `null`, `undefined`, or a function that returns the content of the label. It is not a vnode. A vnode must be unique in the tree, and a label shows in the value part and in its item at the same time. See [Vnodes Must Be Unique](https://vuejs.org/guide/extras/render-function.html#vnodes-must-be-unique).
- On a page that Vue hydrated, a component in a vnode that mounts a second time renders nothing.
- `resolveSelectedLabel` and `resolveMultipleLabels` give a function label as it is. A part renders it with `<component :is="label" />`, and it renders each other label as text.
- Do not call a label function in `setup` or in a `computed`. The result is a vnode, and the next render uses it again.
- The text of an item with a function label is the result of `itemToStringLabel`, or the text of its value. `stringifyAsLabel` gives it.

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
- A consumer writes `v-model:open`, `v-model:value`, `v-model:checked`, `v-model:pressed` or `v-model:snapPoint`. There is no `modelValue` alias.
- One composable does this: `useControlled({ controlled: () => props.x, default: () => props.defaultX, name })`.
- `default` is a getter. A development build then shows a warning when the default of an uncontrolled part changes.
- Do not use `defineModel`. It writes the value before a parent can cancel the change.
- A part whose input holds the uncontrolled value does not call `useControlled`. `Field.Control` is an example: it declares `value` and emits `valueChange` and `update:value`.

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
- Popup roots expose `close()` and `unmount()`. `Field.Root` exposes `validate()`. Its prop `validate` is the validator function. `Form` exposes `validate(name?)`. The types are `DialogRootActions` and so on.
- A ref prop of upstream (`inputRef`) becomes an exposed element (`inputElement`) beside `element`.
- Handles are upstream's objects, with no change: `Dialog.createHandle<Payload>()`, `handle`, `payload`, `triggerId`, `open()`, `openWithPayload()`, `close()`, `isOpen`.
- Function children become a default scoped slot with named props: `{ payload }` on a root, `{ validity }` on `Field.Validity`, `{ item, index }` on list parts, `{ value }` on `Select.Value`.
- Type the slots with `defineSlots`. Write each slot except `#render` as a method, as the Vue documentation does: `default(props: { state: ButtonState }): unknown`. A slot with no slot props is `default(): unknown`. A root with a value type uses `generic="Value"`.
- Give the type parameter the default that Base UI gives it: `generic="Value = any"` on `Accordion.Root`. With no default, the handler of a root that has no `value` and no `defaultValue` gets `unknown[]`. Base UI gives `any[]`, and its type test has a line for it.
- Write the `#render` slot as a property with the shared type: `render: ComponentRenderFn<HTMLProps, ButtonState>`. A part with the `children` slot prop writes a method with the three slot props, because `ComponentRenderFn` has no `children`.
- A part whose default tag has attributes of its own gives them to the slot type. The `a` of `PreviewCard.Trigger` is an example: `render: ComponentRenderFn<HTMLProps & AnchorHTMLAttributes, PreviewCardTriggerState>`. `HTMLProps` has no `href`.
- Hooks keep their names as composables: `useDirection`, `useRender`, `Toast.useToastManager`, `Combobox.useFilter`.
- Where an upstream hook returns a value that can change, the composable returns a ref of that value. `setup` runs one time, so a plain value does not follow a change. Read `.value` where the code uses the value. Do not make a copy of it in `setup`.
- The ref is a `ComputedRef` when the composable computes the value: `useDirection()` returns `ComputedRef<TextDirection>`. It is a `Readonly<Ref<T>>` when the composable writes the value: `useTransitionStatus()` returns `mounted` and `transitionStatus` in this form.
- Where an upstream hook returns a props object with a value that can change, the composable returns a `ComputedRef` of that object. Examples are `useLabel()` and `compositeProps` of `useCompositeItem()`. The part reads `.value` in the function that it gives to `useRenderElement` as `props`. `useCompositeRoot` returns a plain object, because its props are only listeners.
- Where an upstream hook returns an object of functions, the composable returns one plain object. Each function reads the options when it runs, so a `computed` that calls it follows a change of an option. `Combobox.useFilter` does this. It takes its options as one `MaybeRefOrGetter`, as `useMediaQuery` does, because its `value` can be a function.
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
- `useAnchorPositioning` of `src/internals` is the only caller of `useFloating` of `@floating-ui/vue`. A positioner part of a popup family calls `usePopupPositioner` in `setup`. `test/fixtures/PopupPositionerPart.vue` is the model. See [Popup positioning](#popup-positioning).
- To add or change a dependency of the package, run `pnpm --filter @vase-ui/vue add <name>@<range>`. Then commit `pnpm-lock.yaml`. Do not edit the lockfile. `THIRD_PARTY_NOTICES.md` names each run-time dependency.
- When two families import each other, move the shared context or constant to `src/internals`.
- `MenubarContext` and `ContextMenuRootContext` are in `src/internals`, because Menu reads them and Menubar and Context Menu render Menu.
- `src/internals/constants.ts` has a part of the constants of Base UI. The pull request that first needs a constant adds it.
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
- With Vue 3.6, a server stops the effect scope of each component after the render, so a callback of `onScopeDispose` runs on a server. That callback does not touch `window` or `document`. A part that adds a listener to the document in a handler keeps that document in a variable. The callback removes the listener only from that document. `SliderControl.vue` does this.
- Compute labels, `aria-*` attributes and the roving tabindex at render, from props and ids. Do not compute them in `onMounted`. Twelve values are exceptions, and each can change when its component is mounted. Two are an `aria-labelledby`: that of a root with a label part, and that of a control that only a native `<label>` names. Two more are the id of a control that has an `id` prop in a field, and an `aria-valuetext` in a locale format. The fifth is the `tabindex` of an item of a composite. See [Composite](#composite). The sixth is the `aria-controls` of an open `Collapsible.Trigger` or `Accordion.Trigger` whose panel has an `id` prop. The seventh is the pair of `aria-controls` on a `Tabs.Tab` and `aria-labelledby` on a `Tabs.Panel`. The part that renders first has no such attribute in the server HTML, because the other part registers later. It gets the attribute in the first flush on the client. The eighth is the `aria-labelledby` of an `Accordion.Panel` that renders before its trigger, when the trigger has an `id` prop. The server HTML then has the id that the item generates. The first flush on the client replaces it with the `id` of the trigger. The ninth is the `role`, the `aria-hidden` and the `aria-label` of `FocusGuard.vue`. They depend on the engine and the screen reader, which a server cannot know. The tenth is the open state of the trigger that claims an open popup, when the root has no `defaultTriggerId` and no `triggerId`. A server registers no trigger, so no trigger is open in the server HTML. The first trigger that registers claims the popup after the mount. Give the root a `defaultTriggerId` or a `triggerId`, and the server HTML is exact. The eleventh is the open state of a popup trigger that has a `handle`. All server requests can share a handle, so a server render attaches no store to it. A root attaches its store only in a browser. The server HTML has the closed form, and the trigger follows the root after the mount. Put the trigger in the root, with a `defaultTriggerId` or a `triggerId`, and the server HTML is exact. The twelfth is the `aria-controls` of an open popup trigger whose popup has an `id` prop. A portal renders the popup after the mount, so the server HTML has the generated id of the popup. Omit the `id` prop of the popup, and the server HTML is exact.
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
- A portal renders after mount. It does not render while the popup is closed, unless `keepMounted` is set. The server HTML thus has one comment in its place, also for an open popup. See [Popup portal](#popup-portal).
- `NavigationMenu.Content` teleports into its viewport, and the root gets the element of the viewport only after the mount. The server HTML thus has no content, also for an open item. With `keepMounted`, the content is in its item, hidden.
- The server render of some families depends on an id, a locale, a prehydration script or a portal. It can also depend on a state that a server cannot know, such as the loading status of an image. Such a family adds a page and its cases to the Nuxt fixture, `fixtures/nuxt`. While no entry point exports a part, the page imports it by its path in `packages/vue/src`, as the page `portal.vue` does.

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
- A composable that filters text with a locale calls `useFormatLocale` too. The first client render then gives the list that the server HTML has. `Combobox.useFilter` is the example.
- A composable that reads another value of the browser obeys the same rule. It gives the server value in the first client render, and it reads the real value in `onMounted`. `useMediaQuery` does this. A client-only mount thus renders again when the two values differ.
- A part that measures the layout gives no measurement on a server and in the first client render. `Tabs.Indicator` reads the layout in a `computed` that gives `null` while `useIsHydrating()` is `true`. The server HTML and the first client render are then equal.

A part that binds the id of a part that comes after it:

- A server writes the attributes of an element before the `setup` of each part that comes after the element.
- A part that binds the id of such a part calls `useDeferredServerRender()` of `src/internals/labelable-provider` in `setup`. Examples are the id of a label, of a message and of a legend.
- Vue then renders the part on a server in a later microtask. Before that render, Vue runs the `setup` of each part that it reaches in the same synchronous pass. The server HTML has the id, in each order of the parts.
- The part that binds the attribute makes the call. A call in a component around it does not help.
- Make the call with no condition on the environment. Vue makes a component that has the hook a boundary for `useId`, on a server and in a browser. With the hook only on a server, a part below the part gets another id in the browser. Vue then reports a hydration mismatch.
- A part that defers assumes nothing. With no registered id, it has no attribute.
- A later part that is below an async `setup`, or below a component that defers, registers too late for the server HTML. The part that binds the id gets it after the page hydrates.
- A popup trigger does not call it. Each value that the trigger lacks on a server comes from a registration, an attachment or an element. A server has none of them. A deferral adds none of them.

The label of a root:

- A root with a label part calls `useLabelId()` of `src/utils/useRegisteredLabelId.ts`. The root binds `getAriaLabelledBy(attrs)` to `aria-labelledby`, in the `props` function that it gives to `useRenderElement`. It provides `setLabelId` and `defaultLabelId` in its context.
- The label calls `useRegisteredLabelId(() => props.id, setLabelId, defaultLabelId)` and binds the result to `id`. The result is the `id` prop, or the id that the root made.
- A server render writes the attributes of the root before the `setup` of the label runs. The label cannot give its id in time for the server HTML. A root cannot defer for its label, because a deferral moves the attributes and the `setup` of the label together.
- Thus the root assumes a label until it is mounted. The server HTML has `aria-labelledby` with the generated id.
- A root with a non-blank `aria-label` of the consumer assumes no label. The server HTML has no `aria-labelledby`. A root that has a label gets the id of the label when it is mounted.
- The first render in a browser assumes what the server assumed, because Vue does not patch `aria-labelledby` when it hydrates.
- `labelId` of `useLabelId()` is the id of the registered label, with no assumption. `legendId` in the context of `Fieldset.Root` is that id.
- After the mount, a root with no label has no `aria-labelledby`. A root whose label has an `id` prop has that id. Vue gives no warning, and the hydrated DOM is equal to a client-only render.
- Until the page hydrates, the server HTML of those two roots points at the generated id, unless the consumer gives the root a non-blank `aria-label`.
- An `aria-labelledby` of the consumer on the root wins, because the attributes of the consumer merge last.
- Two labels with no `id` in one root get the same id.
- `Slider.Root` is the exception, as in Base UI: its label always has the id `<id>-label`, and `<id>` is the `id` of the root. The root thus calls `createLabelIdRegistry()` and not `useLabelId()`. It assumes that id until it is mounted, under the rules above.

The label, the control and the messages of a field:

- `provideLabelableContext()` of `src/internals/labelable-provider` makes the labelable context and provides it. A root that owns a control and its label calls it in `setup`, such as the root of a field and `Field.Item`. A label and a control in an item pair with each other and not with a control of another item.
- The provider makes one id, for the control. A control with no `id` prop takes that id. The label and the control then agree in the server HTML, in each order of the two parts. A label with no `id` prop makes its own id, so two labels in one provider have two ids.
- A control calls `useLabelableId({ id })` and binds the result to `id`. A label calls `useLabel({ native })`. A native `<label>` gets `for` with the id of the control. An element that is not a `<label>` gets a click handler that focuses the control.
- A control with an `id` prop has the id of the provider until the control is mounted. Then it registers a getter for its own id, and the label follows. With its own id from the start, the control would not match a label that comes before it.
- A label and a message register a getter for their id one time in `setup`. Each part that Vue renders after that `setup` has the id in the server HTML. `useLabel()` registers the label. A message calls `useRegisteredMessageId(id)`. A message that can be hidden gives `undefined` as its id while it is hidden. `Field.Error` does this, so the control names it only while it shows.
- `labelId` of the context is the id of the last label that has one. `messageIds` lists the ids of the messages in the order of the registrations, which is the order of the mount.
- A control gets `aria-describedby` from `getDescriptionProps` of the context. The result also has the messages of the provider above. A control in `Field.Item` that calls `getDescriptionProps` of its context thus names the messages of the item and of the field.
- `Field.Control` gets `aria-describedby` through `getValidationProps` of `useFieldValidation`, which calls `getDescriptionProps` of the labelable context of `Field.Root`, as in Base UI. In an item, the control thus names only the messages of the field.
- A group that is the control of its field and takes its name from `aria-labelledby`, such as `CheckboxGroup`, calls `useLabelableId({ id: null })`. The label then has no `for`. An item of the group does not claim the control id of that scope. It passes `enabled: false` to `useLabelableId` when its `registerControlId` is the function of the group. A `Field.Item` opens a scope that the item owns.
- A control that renders a labelable element, such as `Field.Control`, binds `labelId` of the context to `aria-labelledby`. It does not call `useControlLabelId()`. It calls `useDeferredServerRender()` itself, so that the server HTML has the ids of the label and of the messages that come after it.
- A control calls `useControlLabelId()` when its element is not a labelable element of HTML, such as a `<span>` with a role. It gives the result to `useAriaLabelledBy`, which follows this list. The result is the id of the registered label, and `undefined` with no label. The control defers when it has a provider. A label that comes after it then names it in the server HTML, also with an `id` prop.
- When the field has no label, the control has no `aria-labelledby`, in the server HTML also.
- A control that defers has the id of a message that comes after it in `aria-describedby` in the server HTML. In a client-only mount, it has that id after the first flush, before a paint.
- A control whose element is not a labelable element calls `useAriaLabelledBy` and binds the result to `aria-labelledby`.
- It passes `useControlLabelId()` as `labelId`, the `shallowRef` of its hidden input as the source, and the id of that input as the source id.
- A native `<label>` names the control only after the mount. A server has no DOM, and the label of the consumer has no id.
- The composable writes an id to a label that has none.

The state of a field:

- The root of a field holds `touched`, `dirty`, `filled`, `focused` and the validity data in `shallowRef` values. A part changes one only through a function of the field context.
- The field reads the getters of a registration inside its own computed values. The state of a part can include the state of the field, and the field then reads itself through the getter. A getter thus does not read such a state. It reads the sources of the state, as the getters of `NumberField.Input` read `value` and `disabled` of its root context. With a getter that reads the state, `data-focused` and `data-touched` stay stale.
- A control can call such a function in `setup` with a value that it knows from its props, such as `setFilled`. The server HTML of the control and of each part after it then has the attribute. The root and the parts before the control get it in the first flush on the client. Vue does not compare `data-*`.
- A part below a control that defers runs its `setup` after a server wrote the parts that come after the control. The control thus sets the first state itself, as `RadioGroup` and `CheckboxGroup` do for `filled`.
- A value that can add or remove an element does not come from `setup`. A lazy component runs its `setup` later in a browser than on a server, and Vue reports the difference as a hydration mismatch.
- `focused`, `touched`, the validity and the initial value come after the mount. A control that has focus before the hydration gets `data-focused` when it is mounted.
- The name of a control comes with its registration, after the mount. A form error for a `name` that only the control has thus shows after the mount. A field with the `name` on its root has the error in the server HTML.

### What Vue replaces

- Vue reactivity replaces upstream's `Store`, `ReactStore`, `useStore`, `fastHooks` and `createSelector`.
- A store of Base UI whose purpose is a write that renders nothing stays a plain object with `getSnapshot` and `subscribe`. `nestedSwipeProgressStore` of `Drawer.Root` is an example.
- A popup store is `shallowReactive` state, selector functions and a plain `context`. Each root makes one. See [Popup store](#popup-store).
- `useId` gives the ids.
- `Teleport` puts the portal element, with the popup in it, into the container. It has no `defer`, because the portal renders the `Teleport` after the mount, when the container exists. See [Popup portal](#popup-portal).
- Each context has a plain `Symbol()` key for `provide` and `inject`. Each copy of the library then has its own contexts.
- Only three registries are shared between copies, on `Symbol.for` keys: the scroll-lock count, the modal marks and the Escape stack.
- Each shared registry is a plain object with a `version` field. Fields are only added.
- Direction and CSP stay as `DirectionProvider` and `CSPProvider`. There is no global configuration provider.
- A React ref object that leaves the function that makes it (`React.RefObject`, read as `.current`) becomes a Vue ref, read as `.value`. It can be a member of a context, a member of a registration or a parameter. An example is the list of the elements of a composite.
- A function that only reads such a ref takes `Readonly<Ref<T>>`. The owner makes the ref with `shallowRef` and gives it a new value on each change. It does not change an array in place, because a `shallowRef` does not see that change.
- Base UI sometimes gives a ref object that computes its value on each read, or that it selects at render. A function that only reads such a ref takes `MaybeRefOrGetter<T>` and reads it with `toValue` in a handler or a hook. A function that gives the ref to such a reader takes the same type. Examples are `focusTargetRef` of `useSetFieldFocused` and `controlRef` of `useRegisterFieldControl`, which the form reads.
- A ref that parts write with no function of the context is a `Ref<T>`, made with `shallowRef`. `focusOwnerRef` of the field context is an example.
- A part writes `null` to such a ref only when the ref holds its own element. A compiled template can mount a new part before it unmounts the part that it replaces. The old part then does not clear the element of the new part. `Field.Control` does this for `validation.inputRef`. `Dialog.Viewport` does it for the key `viewportElement` of the popup store.
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
- A context that a part can be without does not throw. `useCompositeListContext()` returns `undefined`, because an item with no list is valid. `useCompositeRootContext(true)` also returns `undefined`. `useRadioGroupContext()` and `useCheckboxGroupContext()` return `undefined`, because a radio or a checkbox with no group is valid.
- A context that Base UI creates with a default value has one default object in its file. `use<Name>Context()` then calls `inject(key, DEFAULT_<NAME>_CONTEXT)`, and a part works with no provider. `useLabelableContext()`, `useFieldRootContext()` and `useFormContext()` do this.
- The default holds no state, because all apps and all server requests share it. Each value that a provider can change is a `computed` with a constant. Each function does nothing, or returns a constant, or returns its argument where the default of Base UI does.
- `DEFAULT_FIELD_ROOT_CONTEXT` has three more forms. A ref that parts write drops each write: `validation.inputRef` is a `customRef` that reads `null`. A member that only a provider can have is `null`: `focusOwnerRef`. A collection is empty and read-only: `registeredInputs`.
- Base UI keeps three things in its default field and form contexts: the fields of the page that have no form, one focus owner and one input. Vase UI keeps none. With no form, `fields` is empty. With no field, `useSetFieldFocused` keeps the owner of its control.
- To find out if a provider is there, compare a function of the context with `NOOP`, as Base UI does: `registerControlId === NOOP`, `setValidityData === NOOP`. `useFieldRootContext(false)` throws when there is no field.
- Where Base UI types a member as a React state setter, the function takes a value. A Vue write is immediate, so a caller that needs the last value reads the ref.
- A component cannot `inject` a value that it provides. A root that needs its own context uses the object that the composable returns: `const labelable = provideLabelableContext()`.
- The context of a provider has another form. `DirectionContext` and `CSPContext` are each one `ComputedRef` of an object, and one composable reads the whole object.
- A context with one value that can change is one `ComputedRef` of that value. `scroll-area/scrollbar/ScrollAreaScrollbarContext.ts` is the model.
- The context of Dialog is its store, as in Base UI. The root provides it, and `useDialogRootContext()` returns it. A part reads the state with `store.select(key)`. See [Popup store](#popup-store).
- A part can provide the context of another family, where Base UI does this. `Accordion.Item` calls `useCollapsibleRoot` and provides `CollapsibleRootContext`. The trigger and the panel of the Accordion then read `useCollapsibleRootContext()`, and the panel uses `useCollapsiblePanel` with no change.
- Such a part gives the context the members that the root of that family gives: the result of the composable, `onOpenChange` and `state`.

### Popup store

The state of a popup is in a store. The code is in `src/utils/popups`. `tooltip/root/TooltipRoot.vue` and `tooltip/trigger/TooltipTrigger.vue` are the models of a popup root and a popup trigger.

- `ReactiveStore` holds `state`, `context` and the selectors. `state` is a `shallowReactive` object. `context` is a plain object for the values that no part renders, such as a callback or a map.
- A selector is a plain function of the state: `(state, ...args) => value`. `store.select(key, ...args)` calls it with the reactive state.
- A part reads a selector in a `computed` in `setup`: `computed(() => store.select('isOpenedByTrigger', id.value))`. The part then renders again only when the value changes.
- A `select` call in a render function makes the part render again on each change of a key that the selector reads.
- A selector of a child store can read the store of its parent. A `computed` that reads the selector follows the parent, so the child store needs no subscription.
- The store makes no `computed` and no watcher. The `computed` of a part stops with the part. Thus code can make a store outside a component, with no `effectScope`.
- Write with `set`, `update` or `setState`. Do not assign to `state`.
- `set` and `update` call `setState` with the full state, so a subclass that overrides `setState` sees each write.
- A family store that must do work when one key of its state changes overrides `setState`, because a store makes no watcher. `MenuStore` shares the mouse-up ref of its parent in this way.
- Vue has no public batch for writes. A watcher with the default flush runs one time for an update of many keys. A watcher with `flush: 'sync'` runs after the write of each key, so it can read a state that is not complete.
- `setState` finds the changed keys before it writes the first key. A sync watcher can write the store during an update, and that write stays.
- `BasePopupStore` writes `open` and `openProp` after the other keys. A sync watcher of the open state then reads the trigger and the reason of the change.
- A function that a render function, a ref callback or the cleanup of a `watch` calls reads `toRaw(store.state)`. That read adds no dependency. Vue runs the cleanup of a part in the render of its parent when the part unmounts. The write methods of a store read the state in this way.
- The state keeps each value as it is: an object, an element, a ref. Do not hold a payload in `ref()` or `reactive()`.
- `NullStore` is a store that takes no write. Give it a frozen state and a frozen context. Vue does not make a frozen object reactive. Code that all apps and all server requests share, such as a handle, holds only such a store.
- A handle holds an inert `NullStore` and a `shallowRef` that points at the store of the root that controls the handle. A `computed` that reads `handle.store`, or a getter such as `isOpen` that reads the state of that store, follows the pointer. A method such as `open()` reads `attachedStoreUntracked`, so an effect that calls it does not run again when a root attaches or detaches. The `isOpen` of a family handle reads `attachedStore`, which is the tracked pointer (`VUE-34`).
- A root attaches its store to its handle in `onBeforeMount`. `attachStore` returns the function that detaches the store. A server does not call `onBeforeMount`, so a server render writes nothing to a handle that all requests share. Do not attach in `setup`.
- A root can call a listener of the consumer when its props change. The close of a disabled root does this. The call runs in `onMounted` and in a `watch` with no `immediate`, so a server render calls no listener.
- A trigger that has a handle calls `usePopupHandleStore(() => props.handle)` in `setup`. The result is the inert store of the handle while the trigger hydrates, and then the store that the handle points at. Hydration does not patch an attribute of a bound object, which is how a part binds its attributes. A trigger that reads the store of the root while it hydrates then keeps the attribute values of the server HTML.
- When two roots take one handle, the newest root controls it. When the newest root unmounts, control returns to the older root. A development build warns when two roots are still attached one frame later.
- `BasePopupHandle` calls `markRaw(this)`. Vue then makes no reactive proxy of a handle. A proxy, from `ref()` or the `data` option, would unwrap the pointer ref and fail at the next write to it.
- A family makes a subclass of `BasePopupStore`. The subclass overrides only the steps where it differs: `isOpenChangeIgnored`, `getCloseTrigger`, `prepareOpenChange`, `prepareUnmount` and `anchorsToActiveTrigger`.
- A family that picks a value from a list makes a subclass of `ValuePopupStore` from `utils/popups/value-popup`. The subclass gives `getAnchorElement`. The store writes that element to `anchorElement` in each write that changes the anchor, the open state or the positioner element.
- A selector of a family that replaces a selector of `popupStoreSelectors` has the parameter type `PopupStoreState<unknown>`. With the state type of the family, the store does not fit a root composable.
- `BasePopupStore` has no `isCommittedSynchronously` step, because Vue has no `flushSync`. A caller that reads the DOM after `setOpen` awaits `nextTick()`.
- A function that works with the store of any family types its parameter as `PopupTriggerDataStore<State>`, or as a `ReactiveStore<State, PopupStoreContext<never>, PopupStoreSelectors>` plus the members that it calls. A parameter of the type `BasePopupStore<…>` refuses a family store with other change event details. It also refuses a family store with a step that returns only keys that the family adds.
- A part with no popup store calls `useFloatingRootStore` in `setup` and gives it `open`, because `setOpen` of the store only calls `onOpenChange`.
- `getEmptyRootStore()` gives a closed `NullStore`, so a module that all requests share can hold it.
- Take the innermost registered trigger that contains an event target, because an inner trigger can register after its outer trigger.
- A trigger part calls `useTriggerDataForwarding(triggerId, store, () => ({ payload: props.payload }))` in `setup`. It gives the `registerTrigger` that the call returns to `useRenderElement` as a `ref`. A trigger that gives no data to the store calls `useTriggerRegistration(triggerId, store)` in the same way.
- `registerTrigger` only writes a `shallowRef`. One `watch` with `flush: 'post'` adds the element to the trigger map. It removes the entry when the element, the id or the store changes and when the part unmounts, but only an entry that holds its element.
- The registration follows the store that a handle gives. A detached trigger moves from the inert store to the store of a root when the root attaches, and back when the root detaches.
- A server render calls no `ref` callback, so it registers no trigger.
- A registration changes `triggerCount` only while the popup is open.
- The registration of the active trigger gives its element to the store, and its data while the popup is open. The registration of another trigger claims an open popup that has no active trigger, unless the popup opened with no trigger. The popup then gets the element and the data of that trigger. The activation of a trigger by `KeepAlive` claims no popup, because the root picks the trigger.
- While a trigger owns the mounted popup, each change of its data goes to the store.
- `KeepAlive` leaves the entry of a trigger in its place. The two hooks of the trigger only set a flag, and a `watch` of the flag calls `setActive` of the trigger map. Each reader of the map then skips the entry while the trigger is deactivated.
- When the flag changes, the registration updates `triggerCount`. After the activation, the active trigger gives its data to the store again.
- A root part calls `usePopupInteractionProps(store, () => ({ activeTriggerProps, inactiveTriggerProps, popupProps }))` in `setup`. It writes the props at once, so each part below the root gets them in its first render. It writes them again when a source of the getter changes, and it clears them when the root unmounts.
- `activeTriggerProps`, `inactiveTriggerProps` and `popupProps` have the type `HTMLAttributes` of Vue. They hold attributes and listeners, and no `ref`.
- A root part calls `usePopupRoot(props, createStore, options)` in `setup`. The call returns `store`, `open`, `mounted`, `payload`, `transitionStatus` and `actions`. The part provides `store` with `provide`, exposes `actions`, and renders `<slot :payload="payload" />`.
- The roots of Dialog, Alert Dialog and Drawer share one composable, `useRenderDialogRoot(mode, props, emit)`. It calls `usePopupRoot`, provides the store and calls `useDialogInteractions`. The root parts of Dialog and Alert Dialog only declare their props, their emits, their slot and their exposed actions.
- `Drawer.Root` also provides `DrawerRootContext`, reports to `Drawer.Provider` and holds the close watcher. It gives the composable a function in place of its `emit`. For `update:open` and `openChangeComplete`, the function only emits the event. For `openChange`, it emits the event and returns when `details.isCanceled` is `true`. For a close of a root that has snap points, it then calls `setActiveSnapPoint` with the default snap point and the reason of the close. The composable then calls the function for `update:open`, so `update:open` comes after `snapPointChange` and `update:snapPoint`.
- `createStore` runs one time, and the props give only the first state. The composable then follows `open` and `triggerId` with watchers that have the default flush. A controlled `open` of `false` also resets the last request in `state.open`.
- A prop of the root that the store also holds, such as `disabled`, goes into the first state in `createStore`. One `watch` writes each later change. The server HTML then has the first state.
- `options.onOpenChange` is a function of the part. It emits `openChange`, and then `update:open` when `details.isCanceled` is `false`. The composable puts it in `context.onOpenChange`. `options.onOpenChangeComplete` emits `openChangeComplete`.
- The composable calls `useControlled` for `open` and for `triggerId` only to give two warnings. One is for a change between controlled and uncontrolled. The other is for a change of the default of an uncontrolled root. The store holds the state.
- `useUnmountAfterClose` runs the transition. A `watch` with `flush: 'sync'` copies `mounted` and `transitionStatus` to the store in the write that changes them. A caller that reads the store after a write of `open` thus reads the new values.
- `context.nested` is `true` when `useFloatingParentNodeId()` gives an id.
- `useImplicitActiveTrigger` keeps the trigger map and the state in step after each DOM update. It does not run while `KeepAlive` holds the root. With `closeOnActiveTriggerUnmount`, the popup closes with the reason `none` when the active trigger unregisters. The close waits one microtask, so that a trigger with the same id can register first.
- When triggers join an open popup that has no active trigger and none claims it, the root picks the first trigger of the trigger map that is in the document. The result is the same as at the mount. `KeepAlive` runs the hooks from the last part to the first part, so a claim by each trigger would pick the last trigger.
- `KeepAlive` detaches the store of a deactivated root from its handle. The store attaches again at the activation.
- A root of a popup with one anchor and no trigger registry, such as Select and Combobox, calls `useSingleAnchorPopupRoot(props, createStore, options)` in `setup`. The call returns `store`, `open`, `mounted`, `transitionStatus` and `actions`. Such a root has no handle, no payload and no trigger id.
- `usePopupRootWithPopupId(props, createStore, defaultPopupId, options)` is `usePopupRoot` for a root that gives its own default popup id. The id is a value, a ref or a getter, and the store follows a change. `Menu.Root` gives the id that its popup registers, or else a generated id.
- `popupRoot.ts` has `usePopupRoot`, `usePopupRootWithPopupId`, `useSingleAnchorPopupRoot`, `useImplicitActiveTrigger` and `usePopupRootSync`.
- `usePopupRootSync(store, open)` clears `openMethod` of the store when `open` becomes `false` and when the root unmounts. A root whose trigger writes `openMethod` with `useOpenMethodTriggerProps` calls it in `setup`. `useOpenInteractionType` clears its own `openMethod`, so a root that uses it does not.
- `types.ts` has a part of the types of Base UI. The pull request that first needs a type adds it.

### Popup tree

A popup tree holds one node for each popup below one root. The code is in `src/utils/popups/tree`.

- `provideFloatingTree(externalTree)` provides a tree to the parts below and returns it as a `ComputedRef`. `externalTree` is a store, a ref or a getter. With no tree, the part provides one `FloatingTreeStore` of its own. `provideFloatingNode(id)` provides the id of a node. Base UI has the components `FloatingTree` and `FloatingNode` for this.
- `useFloatingNodeId()` registers a node in the tree and returns its id. `useFloatingParentNodeId()` gives the id of the node above the part, or `null`. `useFloatingTree()` gives the tree above the part, or `null`.
- `provide` follows the components and not the DOM. A part in a `Teleport` thus gets the tree and the node of the part around it.
- `inject` gives a part the tree and the node of the part above it, also when the part provides a tree or a node itself.
- The tree that a part provides can change. `useFloatingTree()` then gives the new tree at once. Each node below moves to it with its `context` in the next flush. Read `.value` of the tree in a handler, a hook or a `watch`. Do not keep the store in a variable of `setup`. `FloatingTree` of Base UI keeps the tree of its first render.
- Base UI sometimes calls a hook in a component below the `FloatingTree` of the same file, as `PopoverRoot.tsx` and `Menubar.tsx` do. Give the result of `provideFloatingTree()` to that composable as `externalTree`.
- A node registers in `onBeforeMount`. A server render does not call that hook, so a tree gets no node on a server.
- The hook runs before the `setup` of the parts below. Each of them thus finds the node when it is mounted.
- The nodes are in the order of those hooks: a node comes before the nodes below it. In Base UI, it comes after them. Find a node by its id. Do not use its position in the list.
- `nodesRef` is a `shallowRef`. The tree gives it a new array for each node that it adds or removes.
- `parentId` of a node gives the id that the part above provides at the time of the read. When that id changes, the node keeps its place and its `context`.
- `KeepAlive` leaves a node in its place. While the part of the node is deactivated, the `context` of the node is `undefined`. `getNodeChildren` then does not count the node as open. `removeNodeContext(node, context)` removes `context` from a node, also while the part of the node is deactivated. It keeps the context of another popup. Do not compare `node.context` for this, because a deactivated part hides it.

### Popup positioning

The positioning of a popup is in `src/internals/useAnchorPositioning.ts` and in `src/utils/popups/positioning`.

- A positioner part of a popup family calls `usePopupPositioner(store, props, options)` in `setup`. It takes the reactive props of the part, so do not destructure them. The result has `element`, `elementProps`, `state`, `positioning`, `open` and `mounted`.
- `usePopupPositioner` calls `useAnchorPositioning`, `useVaseUIFloating` and `usePositioner`. `options.positioning` replaces the positioning parameters that come from the props. It can also have `nodeId` and `externalTree`.
- The part calls `useFloatingNodeId()` before `usePopupPositioner`, and gives the id as `positioning: { nodeId }`. The positioning context then finds the node.
- `nodeId` and `externalTree` are each a value, a ref or a getter. A part whose popup can move to the node of another part gives getters. The context then moves to the new node, and the old node loses it (`VUE-43`).
- `usePositioner` makes the props of the positioner element: `role="presentation"`, `hidden`, the styles, and `transition: none` while the transition status is `starting`. With `inert`, it adds `pointer-events: none`. The `style` of the consumer wins over these styles.
- A positioner part that `usePopupPositioner` does not fit calls `useAnchorPositioning`, `useVaseUIFloating` and `usePositioner` itself. `test/fixtures/PositionerPart.vue` is the model for `useAnchorPositioning`.
- The positioning context is `store.context.positioning`. The `context` of the node of the popup in the tree is the same object.
- The context is one plain object with five members: `open`, `placement`, `nodeId`, `elements` and `rootStore`. `elements` has `reference`, `floating` and `domReference`.
- `useVaseUIFloating` sets `open` in a `watch` with `flush: 'post'`, so it is the open state of the last DOM update. [Popup dismissal](#popup-dismissal) gives the reason.
- Each other member that can change is a getter, so a read gives the current value. The readers are handlers and the helpers of the tree, such as `getNodeChildren`, so they need no `.value`. A spread of the object gives the values of that moment.
- `floating` and `domReference` come from the store: its positioner element and its `anchorElement`. `reference` is the element that the popup is positioned against. It is the `anchor` of the positioner, or else the anchor of the store.
- The context has no position (`x`, `y`, `isPositioned`, `update`) and no `refs`. A reader that needs the position uses the return value of `useAnchorPositioning`.
- `useVaseUIFloating` writes the context in `onBeforeMount`. A server render thus writes nothing, and each part below the positioner finds the context in `setup`.
- The composable removes its context from the store and from the node when the part unmounts and while `KeepAlive` holds the part. It never removes the context of another positioner. The tree also hides the context of a node whose own part is deactivated.
- While the popup is not mounted, the composable calls `clearPositioning()` of the store. A kept popup then forgets its anchor override, and a `FloatingRootStore` forgets its anchor and its positioner element.
- `rootStore` can be a getter. A part that gets its store after it has mounted gives a getter, and the context moves to the new store.

### Popup viewport

The viewport of a popup, in `src/utils/popups/viewport`, shows the old content while the popup moves to another trigger.

- A viewport part calls `usePopupViewport({ store, side })` in `setup` and gets `state`.
- The container `data-current="true"` holds the content, and the container `data-previous="true"` comes first while the old content shows.
- The old container has `inert` and `position: absolute`, and it has the old size of the popup in `--popup-width` and `--popup-height` when the payload changes.
- The new container has `data-starting-style` in the first DOM update and loses it one frame later, when the old container gets `data-ending-style`.
- The old content is a DOM clone that the composable takes when the trigger changes, before Vue renders the change.
- The clone has no `id` on an HTML element and no `name` on a control.
- The content mounts one time for a change of the trigger, and one more time when the payload of the trigger comes later.
- The composable writes `adaptiveOrigin` in `onBeforeMount` and in `onMounted`, and a server render writes nothing.
- The resize writes the size variables to the popup element and the positioner element, and their rendered style has none of them.
- A `style` of the consumer on the popup replaces an anchoring declaration that has the same property at the next render.
- While `KeepAlive` holds the part, the resize measures nothing and a morph in progress ends.

### Focus helpers

The focus helpers of a popup are in `src/utils/popups/focus`.

- `tabbable()` keeps the order of the document for an element with a positive `tabindex`, as Base UI does. A browser visits that element first.
- `tabbable()` gives a `details`, `audio[controls]`, `video[controls]` or `contenteditable` element the tab index 0 only while it has no integer `tabindex`. A browser can give such an element the default `tabIndex` -1, but the Tab key reaches it. With `tabindex="-1"`, the Tab key skips the element, and so does `tabbable()`. Base UI lists it.
- `FocusGuard.vue` is the guard that a focus trap puts at the edge of its content. It is a `span` with `tabindex="0"`. It exposes its element as `element`. It gives the attributes and listeners of a consumer to the `span`: `<FocusGuard data-type="inside" @focusin="…" />`. Its own attributes win over the same attributes of a consumer, as in Base UI.
- The guard has `aria-hidden="true"`. In WebKit on an Apple system, it has `role="button"` and `aria-label="Focus guard"` instead. VoiceOver moves the focus with its cursor, but in WebKit only onto a focusable element that has `role="button"`. Without a name, axe reports a button with no name.
- The guard reads `platform` in `onMounted`, as [Server render](#server-render) says for a value of the browser. The server HTML thus has `aria-hidden="true"` and no role. The mount adds the role and the label.
- `FloatingFocusManager.vue` moves the focus into a popup when it opens, and it returns the focus when the popup closes. It keeps the Tab key in a modal popup. A popup part renders it around its popup element, in the portal.
- It renders no element. It reads the popup element from `positionerElement` of the store with `getFloatingFocusElement`, and the reference from `anchorElement`.
- It renders two inside guards around its content, unless it is disabled. A modal popup has them. A popup that is not modal has them only in a `FloatingPortal`.
- A modal popup has no guards when `initialFocus` is `false` and its reference is a typeable element with `role="combobox"`. The focus stays in the reference then.
- A `keydown` listener on the document stops the Tab key while the focus is in a modal popup that has no tabbable element. The guards have nothing to focus then.
- `previousFocusableElement` and `nextFocusableElement` take an element, a ref or a getter. They name the element that gets the focus when the Tab key leaves a popup that is not modal. When the value is `null`, or the ref or the getter gives no element, the focus goes to the outside guard of the portal.
- The initial focus moves one animation frame after the DOM update of the open. For a virtual `mousedown`, such as the press of a screen reader, it moves in the same task.
- `initialFocus` is `true`, `false`, an element, a component, a ref of one of them, or a function of the interaction type. `false`, and a function that returns `false` or nothing, move no focus.
- `true`, `null` and an empty ref use the default: the first tabbable element, or else the popup element. A ref is empty when it holds `null` or `undefined`.
- A template gives the value of a ref, so `:initial-focus="field"` gives `null` first and then the element. The part reads the prop in a microtask after the DOM update, and thus gets the element.
- `returnFocus` takes the same forms as `initialFocus`, and the rule for a template is the same. `false`, and a function that returns `false` or nothing, return no focus.
- The default target is the first of these that can take the focus: the reference, the element that had the focus before the open, the popup element of the focus manager above, and the newest element in a list. When `openInteractionType` is `null`, the element that had the focus comes before the reference. The list holds the element that had the focus at each open. When the body had the focus, the list holds the reference, or nothing when `openInteractionType` is `null`. The list keeps the newest 20 elements.
- An element can take the focus when it is in the document, and neither it nor an ancestor has the `hidden` attribute. When a target of the consumer cannot take the focus, the default target applies. The search of the list also skips an element that has the `data-vase-ui-inert` marker, or has an ancestor with it. Such an element is outside an open popup.
- The part focuses the target if it is tabbable, otherwise its first tabbable descendant, otherwise the target itself.
- The popup element above comes from `provide` and `inject`, because a dialog registers no node in the popup tree.
- The part reads the target in a microtask after the cleanup of the effect. Vue can run that cleanup before it removes the reference, so the reference can still be in the document in the cleanup.
- A function of `returnFocus` gets the type of the interaction that closed the popup: `mouse`, `touch`, `pen` or `keyboard`. The type is an empty string when no event of the user closed the popup. After a close with the keyboard, the part calls `focus()` with `focusVisible`.
- A focus that the user moved outside the popup before the close stays there, unless the target is explicit. A `returnFocus` that is not a boolean is explicit. `explicitReturnFocus` can set the value.
- After a press outside the popup, the part returns the focus only when the browser supports the `preventScroll` option of `focus()`. A virtual press, a nested popup and an explicit target do not need that support.
- The part returns no focus after a close that a focus guard caused, and after a `mouseleave` event that closed a hover popup.
- When the `role` of the popup element contains `dialog`, the part sets `tabindex` and `data-tabindex` on it. Both are `0` while the popup has no tabbable element, and `-1` while it has one.
- `data-tabindex` marks a value that the part wrote. A `tabindex` with no `data-tabindex` is the value of the consumer, and the part keeps it.
- The part keeps its effects in one list. `update` runs each effect whose sources changed, in the sequence of the list: first its last cleanup, then its setup. `onMounted` and one `watch` with `flush: 'post'` call `update`.
- Two `watch` calls of one component with `flush: 'post'` run in the sequence of the writes to their sources. They do not run in the sequence of the calls. The list gives the sequence of the effects of Base UI.
- A server calls no `onMounted` and runs no `watch` with `flush: 'post'`, so no effect runs there.
- Under `KeepAlive`, the two hooks only set a flag, because the portal has not put the popup back at `onActivated`. The `update` after the DOM update of the hook then releases the listeners of the document, and takes them back.
- The deactivation moves the focus to `<body>`, so the initial focus moves again at the activation. The popup keeps its open state.
- The deactivation returns no focus. The reference usually leaves the document with the popup, and an older element of the list would get the focus.
- The state for the portal and the guards do not read the flag. `KeepAlive` takes the guards of the portal out of the document with the part, and the same guards must return.

### Popup portal

The portal of a popup is in `src/utils/popups/portal`. `useFloatingPortalNode()` makes the portal element and finds its container. `FloatingPortalLite` is the portal of a popup that takes no focus. `FloatingPortal` is the portal of a popup that takes focus.

- One `Teleport` to the container holds the portal element, and the popup is in that element. Base UI makes two `createPortal` calls for this.
- The part renders its `Teleport` after the mount, so the server HTML has one comment in its place. This is true for each `container` value, and the hydration reports nothing.
- Do not render the `Teleport` on a server. With an element of the page as the target, the server HTML has no popup, and Vue reports a hydration mismatch.
- `container` is an element, a shadow root, a component, or a ref or a getter for one of them. With no `container`, the portal element goes into the portal element that `PortalContext` gives, or else into `<body>`.
- `null` renders no `Teleport` until the container is not `null`, because a `Teleport` with a `null` target fails. A ref or a getter that gives `null` gives the fallback. An empty ref object of Base UI does the same.
- The portal reads its container in a `watch` with `flush: 'post'`, so it follows a ref or a getter. It moves the portal element and does not mount the children again.
- Base UI retries the check of a ref that is empty at first. The Vue portal does not, because Vue sets the ref of an ancestor or a later sibling before it runs that `watch`.
- Updates in the flush of the mount can replace the container. The children then mount in the first container. That container is out of the document when the `onMounted` hooks of the children run. A child that focuses or measures in `onMounted` thus works on an element that is not in the document. Vue then moves the children to the new container. Base UI mounts them one time, in the new container.
- `KeepAlive` leaves the content of a `Teleport` in the target. The portal sets `disabled` on its `Teleport` while `KeepAlive` holds the part. The content then leaves the document, and the same element returns.
- `FloatingPortalLite` does not provide `PortalContext`, so a portal inside it does not render in the portal element of the Lite portal.
- `FloatingPortal` provides `PortalContext`. The context holds the portal element, four guards and `setFocusManagerState()`.
- The focus manager of the popup calls `setFocusManagerState()` with its state, and with `null` when it goes away. It gives a new object for each change, because the portal does not see a change in an object.
- While the state says that the popup is open and not modal, the portal renders two guards and an owner element. The sequence in the place of the part is guard, owner element, `Teleport`, guard. `KeepAlive` takes the guards and the owner element out of the document with the part.
- The first guard sends the focus from outside the popup to the first inside guard. It sends the focus from inside the popup to the tabbable before the guard. When no tabbable comes before the guard, it sends the focus to `domReference` of the state of the focus manager.
- The last guard sends the focus from outside the popup to the last inside guard. It sends the focus from inside the popup to the tabbable after the guard. When no tabbable comes after the guard, it sends the focus to `domReference` of the state of the focus manager. It closes the popup when `closeOnFocusOut` is `true`.
- The owner element has `aria-owns` with the `id` that the portal element has in the DOM. Assistive technology then reads the popup as a child of the owner element. `portalOwnerRole` gives a `role` to the owner element.
- The `id` attribute and the `#render` slot can replace the generated `id`. The portal thus reads the `id` after each DOM update.
- Unless the popup is modal, the portal listens to `focusin` and `focusout` in the capture phase. When the focus moves from the portal to an element outside it, the portal sets `tabindex="-1"` on each tabbable element in the portal.
- The portal restores those elements when the focus comes back from outside, and when the popup opens. Until then, the Tab key skips them, and it enters the popup only through a guard.

### Popup interactions

The interaction composables of a popup are in `src/utils/popups/interactions`.

- A trigger composable returns one plain object of listeners. It makes the object one time, in `setup`. Each listener returns while the composable is not enabled.
- The part puts the object in the `props` of `useRenderElement`, before its own props and `attrs`. A listener of the consumer then runs first, and `event.preventVaseUIHandler()` stops the handler of the composable. A native listener of Base UI cannot be stopped.
- Base UI listens for the first `mousemove` of a hover trigger with `{ once: true }`. The composable keeps a flag instead. A change of `enabled`, `move`, `mouseOnly`, the tree or the store sets the flag again.
- A composable reads the hover intent in a `computed`. A server render reads it in no hook. It thus makes no intent and adds no listener to a store that all requests share.
- A trigger stops its open timer, its rest timer and its safe polygon when it unmounts, when its store changes, when it gets disabled, and when `KeepAlive` deactivates it.
- A trigger that blocks pointer events itself, as `NavigationMenuTrigger.vue` does, calls `restoreOutsidePointerEvents()` of the hover intent at each change of `open`, when it unmounts and when `KeepAlive` deactivates it.
- A trigger that opens on hover reads `:hover` in `onMounted`, because a browser sends no enter event for a pointer that is already over the trigger when the hydration ends. When the trigger matches, hover is enabled and the menu is closed, it calls `onMouseenter` and then `onMousemove` of its hover props, each with a new event. The first call lets a move open the popup. The second call starts the rest timer. Under `KeepAlive`, the trigger reads `:hover` again in `onActivated`, after a deactivation only. This follows the `KeepAlive` rules of [What differs from the React source](#what-differs-from-the-react-source).
- Chromium sends `focusout` when Vue removes the focused trigger, after the scope of the part stopped. A handler that starts a timer thus starts none after the scope stopped.
- A popup that hover or focus opened closes with the reason `trigger-hover` or `trigger-focus` when `KeepAlive` deactivates its trigger. This is the exception to the open state that a popup keeps under `KeepAlive`.
- `useHoverPopupInteraction` takes `store` as a store, a ref or a getter, because a part can get its store after `setup`. A change of the store runs each effect of the part again for the new store.
- `useHoverPopupInteraction` adds its listeners to the positioner element with `addEventListener`, because the element belongs to another part than the popup part that calls it.
- A popup part stops its own timer and the timers of the hover intent. It also gives back the pointer events that the intent blocked. It does both when it unmounts, when its store changes, and when `KeepAlive` deactivates it.
- While `KeepAlive` holds a popup part, the part blocks no pointer events and has no listener on its positioner element.
- A popup that the pointer left closes when the popup below it closes. It looks for an open popup below it in a 0 ms timer, because `open` of a node is the state of the last DOM update.
- `useClientPoint` writes a virtual element at the pointer to `anchorOverride` for each move, and `null` when the part unmounts. A positioner reads it through `store.select('anchor')`.
- While it is enabled, `useClientPoint` adds one `mousemove` listener to the window of the positioner element. A mouse-like pointer keeps the listener while the store has that element, so the popup follows the pointer while it closes. A touch pointer keeps it only while the popup is open. The listener removes itself when the pointer moves over the positioner element. A `mouseenter` or `mousemove` event of the trigger adds it again while the popup is open. A popup that a non-mouse event opened, such as a focus or a key press, gets no listener and keeps the anchor of its trigger. While it is not enabled, `useClientPoint` has no listener. It writes the anchor element of the store to `anchorOverride`.
- `store` of `useClientPoint` is a store, a ref or a getter. When the store changes, the composable removes its window listener. It writes `null` to `anchorOverride` of the old store. It then applies the rules above to the new store.

### Popup dismissal

`useDismiss(store, options)` closes a popup for an Escape press, for a press outside it and for a press of its reference. The code is in `src/utils/popups/interactions/useDismiss.ts`.

- A root calls it one time in `setup`. Base UI mounts a component for the hook only while the popup is open or mounted. The composable needs no such rule. While the popup is closed, it holds no document listener and no timer. It keeps its `openchange` listener on the store from the mount to the unmount.
- The result is one plain object with `reference`, `floating` and `trigger`. `trigger` is `reference`. Base UI gives an empty object while `enabled` is `false`. Here each handler does nothing in that state, so the object is made one time. The root gives the members to `usePopupInteractionProps`.
- `enabled`, `escapeKey`, `outsidePressEvent`, `bubbles` and `externalTree` are a value, a ref or a getter, because a caller of Base UI changes each of them between renders.
- `outsidePress` and `referencePress` are plain members, because `toValue` calls a function. `referencePress` is a function. `outsidePress` is a Boolean that the composable reads one time, or a function that it calls for each press. A caller of Base UI gives a function or nothing, so no caller needs a Boolean that changes.
- A root whose trigger is a link, such as `PreviewCard.Root`, gives no `referencePress`. A press of the link then does not close the popup, and the link navigates.
- The document listeners exist only while the popup is open, enabled and not held by `KeepAlive`. A server render adds none.
- One function, `update()`, removes the listeners of the last run and adds the listeners of the new state. It follows the rule of [What differs from the React source](#what-differs-from-the-react-source) for an effect that reads the DOM: `onMounted` plus a `watch` with `flush: 'post'`. A server calls no `onMounted` and runs no such `watch`.
- The two `KeepAlive` hooks call `update()` themselves. A plain flag, not a ref, tells it that `KeepAlive` holds the popup. The popup keeps its open state. While `KeepAlive` holds it, the composable resets its session state and clears its timers.
- A shallow ref in the source list of a `watch` makes Vue call the callback for each trigger of a source, also when no value changed. Give the list a getter, or call the function in the hook.
- A press in a frame sends no event to the document of the popup (`BUG-5410`). Thus the nine press listeners are also on the document of each same-origin frame below it, at each depth. They leave with the other document listeners. Only presses go to a frame: Escape in a frame does not close the popup, as in Base UI. A frame in a shadow tree is not in the frame list of its window (`window[index]`). It gets no listener, and a press in it does not close the popup.
- A cross-origin frame throws when code reads its document. The composable skips that frame and reads the frames after it. A press in a cross-origin frame does not close the popup.
- A frame gets a new document when it loads, and `load` does not bubble. Thus a capture listener for `load` on the document of the popup and on each frame document starts the search for frames again. Only the `load` of an `iframe` does this.
- A press in a frame counts as a press on the frame element. A popup element that holds the frame element holds the press. The checks for a trigger and for an injected element use the frame element too. The check for a scrollbar uses the real target, because the offsets of the event are relative to it.
- React gives an event of a portal child to the handlers of the popup around the component. Vue does not: an event of content that `Teleport` moved does not reach the popup element. Thus each `useDismiss` call provides two functions with a plain `Symbol()` key, and it injects the two functions of the call above it.
- `markInsideComponentTree()` sets `context.insideComponentTree`, and a 0 ms timer clears it. The check for an outside press ignores a press while the marker is set. The capture listeners of the popup element call the function, and it calls the function of the popup above. They are DOM listeners, so they also work in a closed shadow root. There they are the only signal.
- A press in a frame that a popup element holds reaches no capture listener of that element. Thus the composable calls the function of the popup above for it, and the popups above count the press as inside.
- `handleKeydown()` gives a `keydown` that no handler stopped to the popup above. The popup above does nothing when its popup element holds the target, because the DOM gives it the event. Without this function, `details.allowPropagation()` in a teleported child popup does not reach the popup above, as it does in React.
- The popup tree stays as in Base UI. It cannot replace the marker, because Dialog, Select, Combobox and Tooltip register no node, and a Select in a Popover must not close the Popover.
- Three differences from Base UI follow from this form:
  - The boundary is the root that calls `useDismiss`, not the popup element. A popup root below the root of another popup counts as inside it, also when it is not in the popup element. Base UI counts only the React children of the popup element.
  - Content that a `Teleport` of the consumer moves out of a popup is outside it, and so is content in a portal that has no popup of its own. In React that content is inside. A child Vase UI popup is inside, also when its portal moves it.
  - A component calls `useDismiss` one time. A second call in the same component replaces the two functions that the first call provides.
- `onTouchmoveCapturePassive` is the key of the `touchmove` listener of the popup element. Vue reads the suffixes `Capture` and `Passive` of a key. React adds its `touchmove` listener as passive. A listener that is not passive makes the browser wait for it before each scroll step.
- Each open popup has a number, and an Escape press that reaches the document closes the newest popup first. The counter and the record of each event are in one registry on `globalThis[Symbol.for('vase-ui.escape-layers')]`. Two copies of the library share it.
- A popup takes its number in `onBeforeMount` when it is open at the mount, and in a `watch` of `open` with the default flush when it opens later. `onBeforeMount` runs for a parent before its child, and `onMounted` does not. A server does not call `onBeforeMount`, so a server render takes no number.
- `open` of the context of a tree node is the open state of the last DOM update. The popup above reads it in the event in which the child closes, and it must still see the child as open. Thus the writer of the context sets `open` in a `watch` with `flush: 'post'`. With a getter that reads the state at the moment of the read, the listener of the child runs first and closes the child. The popup above then finds no child that blocks it, and it closes in the same press.
- Base UI ignores Escape for a short time after `compositionend`: 5 ms in WebKit, and a 0 ms timer in the other engines. Only WebKit sends `compositionend` before the `keydown` that ends a composition. The other engines send that `keydown` first, with `isComposing`, and the handler checks it. A window there drops an Escape press that comes before its timer (`BUG-6158`). Thus the window exists only in WebKit.

### Popup click

`useClick(store, options)` opens or closes a popup for a press of its trigger. The code is in `src/utils/popups/interactions/useClick.ts`. It follows the rules of [Popup interactions](#popup-interactions).

- A trigger part calls `useClick` in `setup`. `store` is a store, a ref or a getter, because the store of a trigger with a handle changes.
- The result is one plain object with `reference`.
- Each option is a value, a ref or a getter. A getter of `stickIfOpen` is read at each press, as the function of Base UI.
- The frame and the touch timer stop when the part unmounts and when `KeepAlive` deactivates the part. A frame or a touch timer that waits still opens its popup when `enabled` becomes `false` or the store changes, as in Base UI.
- `useOpenInteractionType(open)` returns `openMethod` as a `Readonly<Ref>` and `triggerProps`, a plain object of listeners. `open` is a ref or a getter.
- A store that keeps the type uses `useOpenMethodTriggerProps(open, setOpenMethod)`.

### Toast store

The toasts of one `Toast.Provider` are in a `ToastStore`. The code is in `src/toast/store.ts`.

- `ToastStore` is a `ReactiveStore`. Code can make one with no component.
- A reader calls a selector of the store in a `computed`. `useToastManager()` does this for `toasts`, so it returns `toasts` as a `ComputedRef`. Its four methods are plain functions.
- The store derives the place of each toast from `toasts`, so one write changes the list and the places.
- `ToastStore` writes `toasts` after the other keys. A sync watcher of the toasts then reads the limit and the interaction state of the same change.
- A method of the store reads the state with `toRaw`. An effect of a consumer that calls `add`, `update`, `close` or `promise` thus does not run again when the toasts change.
- `closeToast` reads a document only when the store has a viewport element. A call on a server thus does not throw (`VUE-30`).
- A toast keeps no vnode in its data, because a vnode that mounts a second time on a page that Vue hydrated loses its components. The `title`, the `description` and the `children` of `actionProps` are a text, a number, or a function that returns the content.
- `actionProps` of a toast has the attributes of a `<button>` and `children`, which is the content of the button.
- `ref` of a toast object is a Vue ref of an element. Read it as `.value`.

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
- `Radio.Root` is an item only in a `RadioGroup`.
- `NavigationMenu.List` is a composite root only when its root is not nested. A nested list also leaves out its key handler, so that the arrow keys reach the outer root. `navigation-menu/list/NavigationMenuList.vue` is the model.
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
- `RadioGroup` sets `hasActiveItem` only when it has a value.
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
| `onChange` on a text input                | `onInput`. A part also listens to `onChange`.     |
| `onChange` on a checkbox or a radio input | `onClick`                                         |
| `onKeyDownCapture`                        | `onKeydownCapture`. The `Capture` suffix stays.   |
| `onOpenChange` (a component event)        | `onOpenChange`. A component event keeps its name. |

- The rule applies to the handler keys of a part and to a ported test.
- React implements `onFocus` and `onBlur` with `focusin` and `focusout`.
- React calls `onChange` of a text input on each `input` event, and on a `change` event that has a new value.
- React calls `onChange` of a checkbox or a radio input on the `click` event. A check of `event.nativeEvent.defaultPrevented` in such a handler becomes a check of `event.defaultPrevented`.
- React calls `onChange` of a radio input only for a click that checks it. A part thus ignores the click of a radio input that its state has as checked.
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
- `isPositioned` of `useAnchorPositioning` and the copy of `mounted` and `transitionStatus` in `usePopupRoot` are exceptions: their watchers have `flush: 'sync'`.
- `useFloating` sets `isPositioned` from the `open` option that it read when the position pass started. A pass can start while the popup is open and end after the popup closed. `useFloating` then gives `true` for a closed popup, and the part shows an old position.
- The composable keeps its own `isPositioned` in a `shallowRef`. One `watch` on `middlewareData` and on the `isPositioned` of `useFloating` writes it. The value is `true` only when the `isPositioned` of `useFloating` is `true` and `open` is not `false` at that time.
- Each reader of `isPositioned` reads this ref. A reader outside a render, such as the microtask of a function ref, needs the value in the write that ends the pass.
- Where a handler of Base UI reads the state of the last render after a state write, keep that value in a variable that a `watch` with the default flush writes. A direct read in the handler gives the value after the write. `useFieldValidation` does this for the validity of the field: `renderedValid`. `useMenuRoot` does this for the open state, and it gives the state to the store only while the root is mounted. `NavigationMenuTrigger.vue` does this for the active state of its item, because its own `click` handler writes the item before the handler of `useClick` reads `toggle`.
- `useValueAsRef(value)` of Base UI becomes a variable that a `watch` of the value writes with `flush: 'sync'`. A handler then reads the value of the last change. `SliderControl.vue` does this for `values`.
- `useValueChanged` calls its callback after the DOM update, because the callback of a field control reads the validity of the input. Under `KeepAlive` it waits for the activation and gives the value before the deactivation.
- A consumer can change an object prop in place, because a `ref` of the consumer gives a reactive proxy. `errors` of `Form` is such a prop. A `computed` that reads the proxy with `Object.hasOwn` does not see a new key, because Vue tracks no `Object.hasOwn` of a proxy.
- Watch such a prop with `deep: true`, and keep a plain copy of it in a `shallowRef`. Each change then gives a new object, and a `computed` that reads the copy runs again.
- `CheckboxGroup` gives a copy of its `value` to `useControlled`: `controlled: () => props.value?.slice()`. The copy reads each item. A change in place thus gives the watchers of the part a new array.
- Do not use `watchPostEffect` for an effect. It runs again for each value that the effect reads, and an effect of upstream runs again only for the dependencies that it names. A dependency that the effect does not read, such as `restartKey` in `useOpenChangeComplete`, then starts no run.
- An internal component of Base UI that only provides a context and renders its children becomes a composable that the root calls. `LabelableProvider.ts` exports `provideLabelableContext()`.
- An internal root component of Base UI that more than one root part renders also becomes a composable. `useMenuRoot` does the work of `MenuRootInternal`.
- A registration that the server HTML needs runs one time in `setup`. Register a getter for the value, so that a later change needs no new registration. Remove the registration in `onScopeDispose`. `useLabel` and `useRegisteredMessageId` do this.
- Do not register with a `watch` that has `immediate` and a cleanup. A server render stops that watcher directly after its first run, and the stop runs the cleanup.
- A registration from which a provider picks one value among many parts runs in `onMounted`. A control that replaces another control then registers after the old control left the registrations. `useLabelableId` does this for the id of a control, with a `watch` for a later change. `useRegisterFieldControl` does it for the control of a field. It registers one getter for all the values of the control. A `watch` registers the same getter again when the `id`, the `name`, the value or `enabled` of the control changes.
- `Collapsible.Panel` registers its id in `setup` with `useRegisteredId`, and the root takes the id of the last registration. A panel that replaces another panel then registers after it.
- `Dialog.Title` and `Dialog.Description` register their ids in `setup` with `useRegisteredId`. `useDialogInteractions` makes one registry for each kind. It writes the id of the last registration to `titleElementId` or `descriptionElementId` of the store. Base UI clears that id when any part of the kind unmounts, also when another part of the kind stays.
- Where Base UI removes a registration in the cleanup of a layout effect, use `onScopeDispose`. It runs while Vue unmounts the component. The `onMounted` of a part that replaces it runs after that.
- A compiled template can mount a new part before it unmounts the part that it replaces. A removal by value then removes the value of the new part.
- Thus register a value that two parts can have by source: a `Map` with one entry for each part. `createIdRegistry()` of `src/internals/labelable-provider` does this for the controls, the labels and the messages, for the controls of a field, for the panels of a collapsible, for the triggers of an accordion item, and for the titles and the descriptions of a dialog.
- A `#render` slot can give an element with attributes that no prop of the part shows. An effect that depends on such an attribute runs in `onMounted` and `onUpdated`. It compares the values that it reads with the values of its last run, and it stops when they are equal. `AvatarImage.vue` reads the rendered image in this way.
- The transition status runs on a `flush: 'sync'` watcher. It replaces a state write during render.
- A state that React writes during render, to keep the value of an earlier render, also becomes a `watch` with `flush: 'sync'` and `immediate`. `Field.Error` keeps its last message in this way, for its exit animation.
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
- Vue before 3.5.14 sets the key `autocorrect` as the boolean DOM property of the element, so the string `'off'` turns autocorrect on. A part that turns autocorrect off gives the key `autoCorrect`. Vue sets that key as an attribute in each version, and a server writes it in lower case. The part takes `autocorrect` out of the attributes of the consumer and gives its value to that key, because two keys for one attribute give two attributes on a server. The part gives `'off'` when the consumer gives `undefined`.
- Where upstream takes a native attribute out of its props and does not use it, the part takes the key out of `attrs` in the `props` function of `useRenderElement`. It does not declare a prop for it. `Toggle` does this for `type` and `form`: `const { form, type, ...elementAttrs } = attrs`.
- Where an element can lack the DOM property, a part gives a Boolean attribute the value `true` or `undefined`, never `false`. On an `<svg>`, which has no `hidden` property, Vue writes `false` as `hidden="false"`.
- For `hidden="until-found"`, the props hold the string `'until-found'` as `hidden`. A server with Vue 3.5.41 or later writes that value. An earlier server writes a bare `hidden`.
- Hydration does not patch an attribute, so the part also writes `hidden="until-found"` to the element at mount.
- A transition continues when an element gets `hidden="until-found"`, because the element has no `display: none`. When the element becomes hidden, the part first writes a plain `hidden` and reads the computed style one time. The browser then cancels the transitions.
- Base UI adds some listeners to the element of the part with `addEventListener`. Give such a handler in the props of the part. An example is `onBeforematch` of `Collapsible.Panel`. The element of a `#render` slot then gets the listener too.
- A listener that Base UI adds with `{ passive: false }` also goes in the props. An example is the `wheel` listener of `ScrollArea.Scrollbar`. Vue adds the listener of an element with no `passive` option. A browser makes a `wheel` listener passive by default only on the window, the document, the root element and the body.
- A listener that Base UI adds with `{ passive: true }` also goes in the props, with the suffix `Passive` on its key. An example is `onTouchstartPassive` of `Slider.Control`. Vue reads the suffix and adds the listener with that option.
- An `<input>` part gives an uncontrolled default value with the key `value` on a server and with the key `defaultValue` in a browser. A server needs the key `value` to write the `value` attribute. In a browser, Vue sets the DOM property `value` again on each render, and that replaces the text that the user typed. The DOM property `defaultValue` is the `value` attribute, and Vue sets it only when its value changes. The key `^value` does not help, because a server of Vue 3.5.12 writes the attribute `^value`. `Toolbar.Input` and `Field.Control` are the examples.
- A controlled `<input>` part writes the value of its prop to the input in `nextTick` after an event, when the two differ. Vue writes the DOM value only when the part renders. The part does not render when a listener cancels the change or the consumer keeps its value. React writes the prop back after each event. `Field.Control` is the example.
- A text input part can refuse a change. `NumberField.Input` is an example. No render follows a refused change, so the part writes the text of its state to the input in the `input` handler. The part does not write while the event has `isComposing`, because a write stops the composition. After `compositionend` it writes in a 0 ms timeout, because WebKit sends the last `input` event of a composition after `compositionend`.
- A text input part listens to `input` and to `change`. It handles `change` only when the value of the input is new. A value is not new when the input had it after the last event that the part handled. A value is also not new when the input had it after the last write of Vue, of the part or of a reset. React's `onChange` does the same, because its value tracker also follows the writes of React. A program that fills a form can send only `change`. A range input follows the same rule, as the input of `Slider.Thumb` does.
- Vue writes `value` of an input when it hydrates, so a part with a range input needs no write at the mount. Chromium restores the form state of a page after `load`, with no event on the input. The part thus writes its state to the inputs on each `pageshow` event, as `Slider.Root` does.
- A native reset of a form changes the value of an input and sends no `input` event. A part that holds state for that value follows the reset with `useFormReset` of `src/internals`. The part gives it the input and a callback. The composable listens on the root node of the input. A `reset` event does not leave a shadow root, so a listener on the document does not get it. `Field.Control` is the example.
- The listener ignores an event whose target is not the form of the input. The callback runs in a 0 ms timeout, because the browser resets the controls after the listeners of the event. It does not run when a listener prevented the event.
- After a reset the error of the field is out of date. The function that `useClearFieldError` returns cancels the pending validation and removes the message that the field put on the input. It also clears the validity of the field, and the error of the form for the name of the field.
- Base UI can decide in a microtask that runs after the handlers of the ancestors. React runs all its handlers in one native listener, so its microtask comes after them. For a real key press, the browser runs the microtasks after each listener. Use a 0 ms timeout. `Checkbox.Root` does this for Enter. Its handler keeps the default prevented, and it gives the event own properties `defaultPrevented` and `preventDefault` until the timeout. A listener of an ancestor then reads `false`, and it can still prevent the submit.
- A teleported child popup has two links to its parent: the popup tree and the `provide` chain of `useDismiss`. See [Popup dismissal](#popup-dismissal).
- An outside press and a focus-out treat the popup of a descendant node as inside.
- `KeepAlive` is the counterpart of `React.Activity`. Under `KeepAlive`, a part keeps its state. In `onDeactivated` it releases the scroll lock, the modal marks, the document listeners and the timers. In `onActivated` it takes them back.
- A dialog reports its open state to the dialog above it. While `KeepAlive` holds the dialog, it reports that it is closed. The dialog above is then the top dialog again, so Escape closes it. The report comes back at the activation.
- A drawer in a `Drawer.Provider` reports its open state to the provider, and a drawer can hold a close watcher. While `KeepAlive` holds the drawer, it reports to the provider that it is closed, and it destroys its close watcher. Both come back at the activation.
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
- A file with a name that ends in `.spec.ts`, `.spec.tsx` or `.spec.vue` is a type test. vue-tsc checks it, and no test runner runs it.
- A `.spec.vue` file is the type test of a template. Its first line is `<!-- @strictTemplates true -->`. vue-tsc then reports an unknown prop in that file, as it does for a consumer that sets `strictTemplates`.
- In this package, vue-tsc reports no unknown prop on a generic SFC, in a `.spec.vue` file also. The files that are not strict give each generic SFC a type that accepts each unknown prop. For such a part, write a line that must fail: `<!-- @vue-expect-error -->` before an element that gives the prop a value of a wrong type.
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
| `minLength` or `readOnly` as a prop or as a key of a props object                                          | `minlength` or `readonly`. A DOM property keeps its name.                                                                                                                                                                                                 |
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
| `actionsRef` and `actionsRef.current?.validate()`                                                          | A function ref on the root in a function for `render`, then `root.validate()`                                                                                                                                                                             |
| `useMergedRefs(a, b)`                                                                                      | A function ref that calls each ref                                                                                                                                                                                                                        |
| `React.useState` in a test component                                                                       | A `shallowRef` in the setup function of `defineComponent`                                                                                                                                                                                                 |
| A forced render of the parent that must render the part again, such as `forceRender` of `React.useReducer` | A `shallowRef` count that the test binds to an attribute of the part, such as `data-render`                                                                                                                                                               |
| `setProps({ children: <Part … /> })`                                                                       | A `shallowRef` that the test component reads                                                                                                                                                                                                              |
| `useIsoLayoutEffect` or `React.useEffect` in a test component                                              | `onMounted`. Where a dependency changes in the test, add the `watch` of [What differs from the React source](#what-differs-from-the-react-source).                                                                                                        |
| `useStableCallback(fn)`                                                                                    | `fn`                                                                                                                                                                                                                                                      |
| A case that compares the result of `React.useCallback` or `React.useMemo` in two renders                   | No counterpart. `setup` runs one time, so a function or an object that it makes keeps its identity. Give the case a `not-applicable` row.                                                                                                                 |
| A commit count from `React.Profiler`                                                                       | A count of the calls of a `MutationObserver` that observes `container` with `childList` and `subtree`                                                                                                                                                     |
| `ReactDOM.createPortal(children, container)`                                                               | `<Teleport to={container}>`                                                                                                                                                                                                                               |
| `render(node, { container })`, with a container in a shadow root                                           | `render(<Teleport to={container}>{node}</Teleport>)`. `render` has no `container` option.                                                                                                                                                                 |
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
| `toasts` of `Toast.useToastManager()`, such as `toasts.map(…)` or `toasts[0]`                              | `toasts.value`, because the composable returns a ref                                                                                                                                                                                                      |
| A function component that calls a hook and spreads the rest of its props                                   | `defineComponent` with a setup function that returns the render function. Declare the props that the hook reads. Set `inheritAttrs: false` and spread `attrs`.                                                                                            |
| `useTestInteractions([useX(…), …])` in a test component                                                    | The same call in `setup`. In the render function, call the functions of the result that the upstream test component calls. A call of these functions in `setup` reads the props only one time.                                                            |
| `useTestInteractions([useX(…)])`, where `useX` returns listeners with no `reference`, such as `useFocus`   | Call `useX(…)` in `setup`, and spread the object that it returns on the trigger: `<button {...props} />`. The object has the listeners and no `reference` member.                                                                                         |
| `<CompositeList>`, `<CompositeRoot>` or `<CompositeItem>` in a test                                        | The fixture part of `packages/vue/test/fixtures`, imported with the upstream name                                                                                                                                                                         |
| `useFloating` of `test/floating-ui-tests`                                                                  | `useFloating` of `test/fixtures`. It makes a `FloatingRootStore` and calls `useVaseUIFloating`, so the store and the popup tree get the positioning context.                                                                                              |
| `renderToString` of the renderer, with no `hydrate()`                                                      | A case in the `.node.test.tsx` file of the same folder, with `renderToString` of `vue/server-renderer`. Give the upstream case a `replaced` row.                                                                                                          |
| `renderToString` of the renderer, then `hydrate()`                                                         | The case stays in the ported test file with the same title, so it needs no row. Use `renderOnServer` and `hydrate`, which need a browser. A case that acts between the server render and `hydrate()` hydrates by hand. See [Test helpers](#test-helpers). |
| A `React.Suspense` around a part, so that the part hydrates after its root                                 | A fixture SFC with `defineAsyncComponent(() => Promise.resolve(Part))` inside `<Suspense>`. Hydrate it by hand. See [Test helpers](#test-helpers).                                                                                                        |
| `expect(fn).toErrorDev(message)` or `.toWarnDev(message)`                                                  | A spy that has `mockImplementation`, on `console.error` or `console.warn`. Call `fn`. Assert the call and its message. The message starts with `Vase UI:`.                                                                                                |
| `toErrorDev` for a warning that React DOM gives, such as the warning for a `NaN` value                     | No counterpart, because Vue gives no such warning. The case runs with no wrapper and keeps its other assertions. State the removal in the body of the pull request.                                                                                       |
| `childNodes`, `firstChild` or `nextSibling` on the element of a part                                       | `children` or `querySelector`                                                                                                                                                                                                                             |
| A number as a length in a style object, such as `top: 1`                                                   | A string with its unit, such as `top: '1px'`                                                                                                                                                                                                              |
| `<style dangerouslySetInnerHTML={{ __html: style }} />`                                                    | `<style>{style}</style>`                                                                                                                                                                                                                                  |
| `toHaveComputedStyle(obj)`                                                                                 | `toHaveStyle(obj)`, which also reads the computed style                                                                                                                                                                                                   |
| `toHaveComputedStyle({})`                                                                                  | `not.toHaveAttribute('style')`, because `toHaveStyle({})` fails for an empty object                                                                                                                                                                       |
| `toBeEmptyDOMElement` on a part with an empty default slot, or on the old target of a `Teleport`           | `expect(element.innerHTML).toBe('')`, because the slot leaves empty text nodes. Vue 3.5.12 leaves an empty text node in the old target of a `Teleport`.                                                                                                   |
| An event                                                                                                   | Add `await`                                                                                                                                                                                                                                               |
| `expect(() => fireEvent.x()).not.toThrow()`                                                                | `await fireEvent.x()`. A listener that throws fails the test.                                                                                                                                                                                             |
| `fireEvent.click(element, { button: 2 })`                                                                  | `await user.pointer({ keys: '[MouseRight]', target: element })`, a real press of the right button. React drops that click, and a browser sends none.                                                                                                      |
| An enter or leave call of `fireEvent` on a descendant of the element that has the listener                 | The same call on the element that has the listener. The calls are `pointerEnter`, `pointerLeave`, `mouseEnter` and `mouseLeave`. The native events do not bubble. React makes its events from events that bubble, such as `pointerover`.                  |
| `fireEvent.change(input, { target: { value } })` on a text input                                           | `fireEvent.input(input, { target: { value } })`. It is the event of real typing.                                                                                                                                                                          |
| `fireEvent.focus(element)` and `fireEvent.blur(element)` on a part that has a focus handler                | `fireEvent.focusIn(element)` and `fireEvent.focusOut(element)`. The part listens to `focusin` and `focusout`, and a dispatched `focus` event is not one of them.                                                                                          |
| `event.preventDefault()` in an `onFocus` or `onBlur` handler of a consumer                                 | `event.preventVaseUIHandler()` in the `onFocusin` or `onFocusout` handler. See [DOM event names](#dom-event-names).                                                                                                                                       |
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
- A helper component of a test can spread its props on a part. Give these props the type of the props of the instance, such as `InstanceType<typeof NumberField.Root>['$props']`. The type `NumberField.Root.Props` has no listener of an emit, such as `onValueChange`.
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
- A case that upstream skips with a `skip()` call in its body runs when it passes in each engine. Remove the call, and state the removal in the body of the pull request.
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
- `createFormDataSpy(name)` returns a `vi.fn` for a `submit` listener. The spy calls `preventDefault()` on the event. It returns the entry of the form for `name`, or `null` when the form has no such entry. Read the last result with `spy.mock.results.at(-1)?.value`.
- `hiddenInputSizeTests({ render, createComponent })` is a shared suite for a part with a hidden input that has no `name`. `createComponent` gets `{ required }` and returns a vnode. The suite makes the input invalid and asserts that it has zero size. After `reportValidity()` and `await flushMicrotasks()`, it asserts that the input is 1px by 1px.
- `mockRuntimeLocale(locale)` makes `Intl.NumberFormat` use `locale` when a call gives no locale, until the test ends. `getFormatter` keeps each formatter by locale and options. Thus format with options that no earlier test of the file formatted with no locale.
- A `.node.test` file imports `mockRuntimeLocale` by a relative path to `test/mockRuntimeLocale`.
- `test/animation.ts` has the helpers for a test of a transition or an animation. `nextEvent(target, type, { after, action })` resolves with the next event of that type. With `after`, it ignores each event of that type that comes before the next event of the type `after`. With `action`, it runs the function after it attached its listeners, and the 3 seconds start when the function ends. It rejects after 3 seconds with no event. `createTransitionRunCounter(isOpen)` returns `counts` and the handler `onTransitionrun`. The handler counts the `transitionrun` events of the element itself. An event counts as an enter when `isOpen()` is `true` at the event, and as an exit when it is `false`. `probeFrameAfterExit(panel, isGone)` tells if a frame ran between the end of the exit and the removal of the panel. It rejects when the animation is over before it starts, so a late frame can fail it. `openInTimerTask(open)` and `closeInTimerTask(open)` change a ref in a timer task.
- `useTestInteractions(propsList)` merges the props that the interaction composables return. It returns `getReferenceProps`, `getFloatingProps`, `getItemProps` and `getTriggerProps`.
- An entry of `propsList` is a props object, or a ref or a getter that gives one. A composable can return a ref of its props, and the list takes that ref. Each of the four functions reads the entries when it runs.

The hydration helpers:

- `renderOnServer(file, props)` resolves to the server HTML of a component. `file` is the path of a Vue file from the root of the package, such as `test/fixtures/PlainPart.vue`.
- The render runs in Node with no DOM, as a server makes it. A Vue warning in that render fails the test.
- A composition of parts, or a composable, needs a fixture SFC as `file`. Give it a name that ends in `.test.vue`, and keep it in the folder of its test. Vitest does not run such a file, and the lint rules of the source do not apply to it. Examples are `ProgressRootHydration.test.vue` and `UseIsHydratingProbe.test.vue`.
- A fixture part is a part that tests use in place of a part of a family, such as `CompositeRootPart.vue`. It is an SFC in `packages/vue/test/fixtures`. A composition of parts stays in the folder of its tests, also when more than one test file imports it.
- `test/fixtures/FocusManagerPart.vue` is a focus manager with a store of its own. The tests of the portal use it.
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
- A test that counts each enter and each exit waits for the end event of the next enter, with `after` set to the start event, `transitionrun` or `animationstart`. The end event of an exit can come after the removal of the element. A wait for an end event alone then takes it for the end of the next enter.
- A test that counts transitions gives the handler of the counter to the part as the attribute `onTransitionrun`. A listener on a parent misses an event that the browser sends after the part removed the element. A phase that the test sets after the completion can be wrong, because the browser can send `transitionrun` after the completion. For the same reason, the test waits until the count of the last exit is complete before it asserts the counts.
- Start the wait for the end event before the action: `nextEvent(target, endType, { after: startType, action })`. A late frame can end a transition in the same update that starts it. In Chromium, a listener that the handler of `transitionrun` attaches then gets no `transitionend`, and a listener that exists before the action gets it. A listener that a test attaches after it awaits a browser command can also miss the end of a transition of 100 ms.
- Give a real click to `nextEvent` as its `action`. The click is a command of the browser, and on a busy machine it can take more than 3 seconds. The 3 seconds of a wait that started before the click then end before the transition starts.
- In a new or changed case, do not poll for a state that exists only while an animation runs. Record the state in a listener of `animationstart`, `animationend`, `transitionrun` or `transitionend`, or in a `MutationObserver`. Then wait for a state that stays. Then assert on the record.
- In a listener of `animationstart` or `transitionrun`, read the fields of the event or a state that stays. Do not read `getAnimations()`. A late frame can end the animation before the browser sends the event, and the list is then empty.
- In Firefox, a dispatched `submit` event that no listener prevents submits the form and loads the test page again. Chromium and WebKit do not. A case that submits a valid form has a listener that calls `preventDefault()`. `observeSubmit` of `Form.test.tsx` is the model.
- A case that changes the source of a cached image first waits for the `load` event of that image. Firefox does not cancel the event when the source changes, so the new image gets it.
- Assert the start state before the action when the end state can be true already.
- Use the `firePointer` test helper when a test depends on the time of an event.
- A case that dispatches hover events gives the element `pointer-events: none`. The real pointer can rest on the element and send events of its own. A dispatched event still reaches the element.
- A case that asserts that a part ignores a scroll isolates the part from the real pointer with `pointer-events: none`. When the part renders under the pointer, the browser sends pointer events, and the part can take the next scroll for a user scroll.
- A case that dispatches hover events gives the element `pointer-events: none`. The real pointer of the browser can rest on the element, and a dispatched event still reaches it.
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
- A `types.md` can repeat an entry of another family. Give that entry a `not-applicable` row. The reason names the family that ports the entry. An example is the `types.md` of Radio Group, which repeats the entries of Radio.
- A `waits-on` row is valid only while its target is absent. The pull request that adds the target also adds the tests and removes the rows.
- A row for a test file that imports the entry point of its family can name that entry point in `waitsOn`. A pull request that ports some cases of the file keeps the row. The row goes when each case of the file has a counterpart.
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
- An upstream case can assert the behavior that a row corrects. Give that case a `replaced` exception row. Its `test` is the file of the case that tests the corrected behavior, and its reason names the id of the row.

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
- A `types.md` can repeat the parts of another family. The `types.md` of Radio Group repeats `Radio.Root` and `Radio.Indicator`. The reference reads such a part from the entry file of the family that exports it. The page of Radio Group thus shows both parts.
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
