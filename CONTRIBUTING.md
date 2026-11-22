# How to contribute to Vase UI

Vase UI is a port of [Base UI](https://base-ui.com) to Vue 3. The first section is for people outside the project. The other sections give the rules of the code to the maintainers and to the agents that write the code.

## Bug reports and ideas

Mathematic uses AI agents to maintain this repository. We write all of the code. GitHub lets only collaborators open a pull request.

- Report a bug in [Bugs](https://github.com/vase-ui/vase-ui/discussions/new?category=bugs). Give the versions, the browser and the steps. Include a reproduction if you can.
- Request a change or a new feature in [Ideas](https://github.com/vase-ui/vase-ui/discussions/new?category=ideas).
- Ask a question in [Q&A](https://github.com/vase-ui/vase-ui/discussions/new?category=q-a).

[Contributing](https://vase-ui.com/contributing) gives the full process of a report. If Base UI has the same bug, you can also report it to [Base UI](https://github.com/mui/base-ui).

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

`package.json` has each command. The table gives only what a script line does not show: what a command writes, what it needs first and when it fails.

| Command | Function |
| --- | --- |
| `pnpm parity:check` | Checks each family against its extract of Base UI, each row of `parity/better` and each record of `parity/own`. It reads only the repository. |
| `pnpm parity:extract --upstream <path> [family]` | Writes `parity/families/<family>.upstream.json` from a local clone of Base UI. With no family, it writes each extract. With `--check`, it writes nothing and fails when an extract is absent or differs. With `--counts` alone, it prints the counts of Base UI at the tracked commit. |
| `pnpm parity:track <sha> --upstream <path>` | Writes `parity/upstream.json` for a Base UI commit. The commit is the tracked commit or a descendant of it. |
| `pnpm docs:demos --upstream <path> [family]` | Writes the demo style sheets and the record `docs/demos/<family>/upstream.json` of a family from a local clone of Base UI. With no family, it does this for each family with a page or a demo folder. With `--check`, it writes nothing and fails when a file is absent or differs. |
| `pnpm thanks:render` | Writes `THANKS.md` from the contributor lists of Base UI, Floating UI and aria-hidden on GitHub. It uses your `gh` login. |
| `pnpm check:package` | Builds the package with the fixture families and packs it through `prepack`. It runs publint, Are the Types Wrong and a consumer project. It fails when the pack lacks the license, the notices, the readme or `dist/module.json`. |
| `pnpm release:check-tag <tag>` | Fails when the tag is not `v` and the version in `packages/vue/package.json`, or when that version does not have the form `YYYY.M.MICRO`. |
| `pnpm docs:typecheck` | Runs vue-tsc on the site, its data loaders, the samples and the demos. Then it compiles with the SFC compiler each Vue file of `docs` outside `.vitepress`, and each Vue file that a page shows from another folder. |
| `pnpm docs:build` | Builds the site into `docs/.vitepress/dist`. It fails when `pnpm parity:check` fails. `pnpm docs:preview` serves the built site. |
| `pnpm docs:axe` | Runs axe-core in Chromium on each built page, in both themes, at 1440 and 320 pixels, and in each styling method of the demos. Each page gets the day 2026-11-14 as today. It fails on a violation that `KNOWN_FAULTS` of `scripts/docs/axeSite.ts` does not list, and on a row that matches no violation. Run `pnpm docs:build` first. |
| `pnpm docs:search-focus` | Checks the focus of the search box of the built site in Chromium and Firefox, and on macOS also in WebKit. Run `pnpm docs:build` first. |
| `pnpm docs:ios-backdrop` | Opens the first demo of the Dialog, Alert Dialog and Drawer pages on the built site, with the page scrolled. It applies the rules that only Safari on iOS applies, and it fails when the backdrop does not cover the view. It runs in Chromium, Firefox and WebKit. Run `pnpm docs:build` first. |
| `pnpm test:vapor` | Runs the browser tests in Chromium. `createRenderer` of `#test-utils` then mounts each test in a Vapor app. It needs Vue 3.6. |
| `pnpm test:vapor-parts` | Compiles the parts as Vapor components and runs the files of `packages/vue/test/vaporParts/expectedFailures.json` in Chromium. It needs Vue 3.6, and it runs alone. |
| `pnpm --filter @vase-ui/vue test:vue-3.6` | Runs the browser tests of the `.test.ts` files of `src` and `test/measurements`, and of `test/as.test.ts`, with Vue 3.6. Each file runs in four setups: a virtual DOM app or a Vapor app, with the parts compiled in either mode. |
| `pnpm test:nuxt` | Tests the Nuxt fixture, `fixtures/nuxt`, which uses the Nuxt module of the package. It runs a production build, then the development server, in Chromium. Then it runs a production build with no `Temporal` in Chromium, Firefox and WebKit. Run `pnpm build` first. |
| `pnpm --filter @vase-ui/nuxt-fixture typecheck` | Runs `nuxt prepare`, then the vue-tsc of `packages/vue` on the app of the Nuxt fixture. Run `pnpm build` first. |

To run one test file, add a part of its name: `pnpm test:chromium Collapsible`.

The site imports the built package. Run `pnpm build` before `pnpm docs:typecheck`, `pnpm docs:build` or `pnpm docs:dev`.

Before `pnpm test:vapor`, `pnpm test:vapor-parts` or `pnpm --filter @vase-ui/vue test:vue-3.6`, run `pnpm install:vue-3.6`, which installs Vue 3.6 as CI does. To return to Vue 3.5 after the run, run `git restore pnpm-lock.yaml packages/vue/package.json fixtures/vite/package.json && pnpm install`.

### Tool versions

- The lowest version of Vue that the package supports is 3.5.46.
- `typescript` stays at version 6. The parity scripts and the API reference use its compiler API, and the main export of `typescript` 7 gives only its version.
- `vue-component-meta` and `vue-tsc` have the same version, so that both read an SFC with the same `@vue/language-core`.
- `vitepress` stays at exactly `2.0.0-alpha.21`. The stable release, 1.6.4, installs a second Vite from the 5.x line, which has advisories that no 5.x release corrects. Install the stable 2.0 release when VitePress publishes it.
- ESLint renders each page with the VitePress of `docs`. Do not add `vitepress` to the root `package.json`. The release job `stage` installs the root dependencies in a step that can get an OIDC token.
- `postcss` in `docs/package.json` has the version that Vite uses, as `pnpm why postcss -r` shows. The workspace then has one copy. Change the version when Vite uses another one.
- `tailwindcss` of `docs` and `@tailwindcss/vite` of `docs` and `packages/vue` have the same exact version. The plugin depends on that exact version, so another version installs a second copy.
- A tool in `benchmarks/package.json` that `packages/vue` also has, such as `vite` or `vue-tsc`, has the version of `packages/vue`. The workspace then has one copy of the tool.
- The CI jobs that start a browser run in the image `mcr.microsoft.com/playwright`, which has the browsers of one Playwright version. When you change the version of `playwright`, change the tag of each image in `.github/workflows/ci.yml` and `.github/workflows/benchmarks.yml`.
- Do not add a `minimumReleaseAgeExclude` line or an `allowBuilds` entry to `pnpm-workspace.yaml` without a comment that gives the reason.
- To add or change a dependency of the package, run `pnpm --filter @vase-ui/vue add <name>@<range>`. Then commit `pnpm-lock.yaml`. `THIRD_PARTY_NOTICES.md` names each run-time dependency.
- Import the middleware, `computePosition`, `autoUpdate` and the types of Floating UI from `@floating-ui/vue`. pnpm does not link `@floating-ui/dom` or `@floating-ui/core`, because the package does not depend on them.

Each pnpm patch in `patches` corrects a fault of a dependency. When a release of the dependency has the correction, run `pnpm patch-remove <name>@<version>` and install that release. A check fails when the release lacks the correction:

| Patch | Fault | Check |
| --- | --- | --- |
| `vue-component-meta` | The package lists no exposed member of an SFC that has `generic`. | `pnpm test:parity` |
| `@vue/language-core` | The package changes `//` in an attribute value of a component into a comment ([vuejs/language-tools#6241](https://github.com/vuejs/language-tools/pull/6241)). | `docs/examples/type-check/AbsoluteUrlAttribute.vue` in `pnpm docs:typecheck` |
| `@vitest/browser-playwright` | A real click, key press or drag that is the first browser command of a test file can fail ([vitest-dev/vitest#11876](https://github.com/vitest-dev/vitest/issues/11876), [vitest-dev/vitest#11928](https://github.com/vitest-dev/vitest/issues/11928)). | `test/browserFrame.test.ts`. Delete it, `test/server/inspectBrowserFrame.ts` and the command `inspectBrowserFrame` of `vitest.config.ts` with the patch. |
| `rolldown-plugin-dts` | A bundled declaration file loses its `/// <reference lib="…" />` line, so a date or time entry point loses the `Temporal` types. Remove the patch when `tsdown` uses a release with the correction. | "Check the declarations that name Temporal" in `pnpm check:package` |
| `vitepress` | The search box returns the focus to `<body>` when it closes, and the Tab key of some browsers leaves the open box. | `pnpm docs:search-focus` |
| `@floating-ui/dom` and `@floating-ui/core` | A CSS `zoom` on `<html>` or `<body>`, or on an ancestor with `positionMethod: 'fixed'`, moves the popup away from its anchor. The patches hold [floating-ui/floating-ui#3492](https://github.com/floating-ui/floating-ui/pull/3492). Remove them with the 1.8.1 releases ([floating-ui/floating-ui#3495](https://github.com/floating-ui/floating-ui/pull/3495)). | The cases of a `zoom` on `<html>` and `<body>` in `src/popover/Popover.test.ts` and `src/navigation-menu/NavigationMenu.test.ts` |

For a release without the correction, make the patch again. pnpm refuses an install when a patch names a version that the dependencies do not have.

When you change the version of a tool, do these checks too:

- `vitepress`: compare the two expressions of `localSearchPlugin.ts` with their copy in `scripts/docs/searchIndex.test.ts`. When they differ, change the copy and the headings that `apiReferenceSearchHtml` writes. Then run `pnpm docs:dev`, open a component page and edit a JSDoc description of its API reference in `packages/vue/src`. The open page must show the new text, through `docs/.vitepress/viteFollowSource.ts`.
- `vitest`: search the `dist` folder of the new version for `VITEST_CHROMIUM_GC_DISK_THRESHOLD_GB`. When the version does not read the variable, find another way to collect the garbage of Chromium after each test file. [Where a test runs](#where-a-test-runs) gives the reason. When a release keeps the modules in the cache of the browser ([vitest-dev/vitest#11914](https://github.com/vitest-dev/vitest/pull/11914)), delete the variable from `.github/workflows/ci.yml`.
- Node.js: `common/date-time-field/layout.node.test.ts` makes the layouts of `my`, `ksh` and `sc` in Node.js. When `.node-version` names a release with the correction of [nodejs/node#67076](https://github.com/nodejs/node/issues/67076), its cases and `test/measurements/date-time-field.node.test.ts` fail. Change those cases and each page of the docs that gives these layouts. Keep the check of `getSegmentLayout`, because Firefox and WebKit have no `year` in `resolvedOptions()` for these formats either.

## Pull requests

- Make one change in each pull request.
- Write the title as a Conventional Commit with the family folder as the scope: `feat(separator): add Separator`. GitHub squashes each pull request, and the title becomes the commit on `main`.
- Write the body in three parts: Why, What and Tests.
- The check `required` must pass.
- On a pull request, CI runs only the test files that the changed files can affect. [Where a test runs](#where-a-test-runs) gives the rules.
- A pull request merges through the merge queue, which runs each check and each test file on the pull request on top of `main`. `main` then moves to the commit that the merge queue tested. A push to `main` starts no CI run.
- When a pull request changes the package, the `Package size` workflow compares the sizes at the base and at the merge. It measures the tarball and each public import. Read its report in the comment of the pull request.

## Base UI parity

`parity/upstream.json` records the Base UI commit that Vase UI tracks and its release. Port from Base UI at that commit. The other sources are the code and the documentation of Vue, the web standards and the libraries that Vase UI depends on.

Code that comes from another project keeps its "License:" comment. `THIRD_PARTY_NOTICES.md` has the copyright notice and the license of each project that such a comment names.

`--upstream <path>` is the path of a local clone of Base UI. The scripts read the clone through git at the commit that they need, so the clone can be at another commit.

### To port a Base UI change

1. Run `pnpm parity:track <sha> --upstream <path>` for the new Base UI commit.
2. The parity page then shows each family that a new commit changes as queued. Read each such commit.
3. Port each change that a user or a developer can see, with a test that fails without it. Write it in the form of Vue, as [Parts](#parts) says.
4. Give a commit that does not apply to Vue a row of `notApplicableCommits` in the family file, with the reason.
5. Set `matchedCommit` to the newest commit of `parity/upstream.json` at which the family matches Base UI.
6. Run `pnpm parity:extract --upstream <path> <family>`.
7. For a family with a page or a demo folder, run `pnpm docs:demos --upstream <path> <family>`. Port each changed demo and each change of the Base UI page.
8. Run `pnpm parity:check`. Give each new thing of Base UI its counterpart or an exception row.

### Family files

Each family has a file `parity/families/<family>.json` and an extract, `parity/families/<family>.upstream.json`. The extract holds the facts of Base UI at `matchedCommit`: the source files, the type tests, the test cases and the rows of each `types.md`. `pnpm parity:extract` writes it. Do not edit it.

| Key | Content |
| --- | --- |
| `upstreamPaths` | The Base UI paths that the family ports, as globs. A family with a docs folder names it too: `docs/src/app/(docs)/react/components/<family>/**`. |
| `matchedCommit` | The Base UI commit that the family matches. |
| `exceptions` | The exception rows. See [Exception rows](#exception-rows). |
| `surfaceAdditions` | Each member of a part that Base UI lacks, with its reason. A member is a prop, an emit, a slot, an exposed member, a change reason, a state field or a constant. |
| `returnTypeDifferences` | Each function that returns another type than Base UI documents, with the Vase UI type and the reason. |
| `notApplicableCommits` | Each Base UI commit that changes these paths and does not apply to Vue, with the reason. |
| `relocations` | Optional. Each Base UI file whose counterpart is in another file: `merged-into`, `inlined-into` or `moved-test`, with its destination and the test that shows it. |

- A `surfaceAdditions` row names one member of one part: `{ "entry": "Button", "prop": "disabled", "reason": "…" }`. `entry` is the title of the part in the `types.md`.
- Give `"nativeAttribute": true` to the `prop` row of a native attribute of the element, such as `id`. A developer gives that attribute to the Base UI part in the same way. The page of the family does not list such a row.
- A `types.md` can have a prop row for a native attribute that the React part does not read, such as `aria-valuetext` of `Progress.Root`. Do not declare that prop. It goes to the element through the attributes. Give the row a `not-applicable` exception row.
- `parity/scope.json` lists the Base UI paths that are out of scope, and what Vase UI does not port, each with its reason. Add an `except` glob to an `outOfScope` rule only for a path that a family ports.
- Write a reason in the present tense, with the form of Vue or of the browser first. The docs page of a family shows the reasons of the rows of its parts and its functions.

### Exception rows

`pnpm parity:check` compares each family with its extract. Each Base UI thing of the extract needs its counterpart or an exception row in `exceptions`. These things are the source files, the type tests, the test cases, the calls of a shared suite, and the entries and prop rows of each `types.md`.

| Kind | Meaning | The row gives |
| --- | --- | --- |
| `replaced` | A Vase UI test covers the thing. | `test`: the path of that test. |
| `not-applicable` | The thing is for something that only React has, or the form of Vue makes it unnecessary. | Only the reason. |
| `engine` | The case does not run in one engine because of the browser. | `engine`: `chromium`, `firefox` or `webkit`. `link`: an `https://` link to a browser bug or an issue. |
| `waits-on` | The thing waits for a Base UI file or folder that has no counterpart on `main`. | `waitsOn`: that path. |

- A row names one Base UI thing with `upstream`, and `describe`, `title`, `suite`, `entry` or `prop` where the thing is inside the file.
- A row that names a source file also covers the cases in that file.
- A `types.md` can repeat an entry of another family, as Radio Group repeats Radio. Give that entry a `not-applicable` row whose reason names the family that ports it.
- A `waits-on` row is valid only while its target is absent. The pull request that adds the target removes the rows.

### Rows of `parity/better`

Each behavior where Vase UI does more than Base UI has a file `parity/better/<ID>.json`:

| Key | Content |
| --- | --- |
| `id` | `BUG-<number>` for the correction of a Base UI issue, with the number of the issue. `VUE-<number>` for each other behavior. The file name is the id and `.json`. |
| `evidence` | One or more `https://` links: an issue, a pull request, a standard, a Vue documentation page, or a line of source at a tag or a commit. |
| `behavior` | What Vase UI does, in the present tense. |
| `dueWith` | One Base UI path. The row is due when the path has a counterpart. |
| `families` | The families whose page shows the row, beside the family of `dueWith`. `[]` names no page. A row whose `dueWith` is in no family with a page needs the key. |

- A Base UI case can assert the behavior that a row corrects. Give that case a `replaced` exception row whose reason names the id of the row.

### Components that Base UI does not have

A component of Vase UI's own has no family file, no extract and no exception row. It has one record, `parity/own/<name>.json`. A utility of Vase UI's own has the same record, with `functions` and no `parts`.

| Key | Content |
| --- | --- |
| `standard` | The `https://` links to the standards that the behavior follows, such as a pattern of the WAI-ARIA Authoring Practices Guide. |
| `reason` | Why Vase UI has the component. |
| `parts` | The titles of the parts, in the sequence of the API reference, such as `Root`. A record needs `parts` or `functions`. |
| `functions` | Optional. The titles of the functions and classes that the entry point exports, such as `createHandle`. |
| `types` | Optional. The paths of the types that the entry point exports, such as `Calendar.Root.View`. |

- The sources of such a component are the standards in `standard`, the code and the documentation of Vue, and the libraries that Vase UI depends on.
- Add the record in the pull request that adds the `index.ts` of the component.

## Source layout

The package is `@vase-ui/vue`, in `packages/vue`. It is ESM only.

- Each family has a folder of `packages/vue/src` with the name of its Base UI folder, such as `dialog`. A component of Vase UI's own has the name of its record in `parity/own`.
- A family folder holds an SFC for each part, such as `DialogPopup.vue`, and `types.ts` with the types of each part. A family with more than one part has `parts.ts`.
- A module of the family holds each contract between its parts, such as `root.ts` for the context of the root.
- Code that two or more families use goes in `src/common`. The popup layer is `src/popup`, and the list of a listbox or a menu is `src/list`.
- The vocabulary is that of the `GLOSSARY.md` of Base UI: Popup, Root, Trigger, Anchor, Positioner.
- A state attribute and a CSS variable of a part have the name and the values of Base UI, such as `data-open`. [The public form](#the-public-form) says which state attributes a part writes.
- A component of Vase UI's own names a state attribute `data-` and the state in kebab case: `data-dragging`. It names a CSS variable `--`, the family, the part and the value, in kebab case: `--resizable-panel-size`.
- A marker of the library has `vase-ui` in the place of `base-ui`, such as `data-vase-ui-swipe-ignore`. A page can then hold the two libraries. A message starts with `Vase UI:`.

The entry points:

- Each folder of `src` with an `index.ts` is an entry point of the same name: `@vase-ui/vue/dialog`.
- `package.json` has the export pattern `./*` and the export `./nuxt`. The build and `pnpm typecheck` write the barrel `src/index.ts`, which is `@vase-ui/vue`.
- `src/nuxt.ts` is the Nuxt module, `@vase-ui/vue/nuxt`. It runs in Node.js when Nuxt starts, and it reads the entry points from `dist`. The build writes its `meta` to `dist/module.json`, which the module list of nuxt.com reads.
- The barrel leaves out an entry whose `index.ts` starts with `/// <reference lib="esnext.temporal" preserve="true" />`. That line gives a consumer the `Temporal` types, and the consumer needs TypeScript 6.0 or `skipLibCheck`.
- `index.ts` exports the namespace of the parts and the flat types: `export * as Field from './parts'`, then `export type { FieldRootProps, … } from './types'`.
- `parts.ts` declares the constant of each part with the type `typeof` its SFC, and a type-only namespace beside it. A family with one part declares them in `index.ts`:

```ts
export const Root: typeof FieldRoot = FieldRoot;
export namespace Root {
  export type Props = FieldRootProps;
  export type State = FieldRootState;
}
```

- Without the type `typeof FieldRoot`, the declaration build writes an expanded type, and a consumer project that checks library files reports an error.
- The JSDoc of the constant says what the part is, then names its element: "Renders a `<div>` element." The API reference shows both.
- A part that Base UI takes from another family is exported again and not copied: `export { Separator } from '../separator'`. `index.ts` exports its props type and its state type with the prefix of the family: `OTPFieldSeparatorProps`.

## Parts

Each part follows the rules of this section.

### Lifetime

- Each part works in `<Transition>` and `<Teleport>`, and when a `v-if` replaces one part with another. No listener or registration of a removed part stays.
- A part keeps no state about a hold of `KeepAlive` and has no code for one. The browser takes a held control out of its form. A control or a field counts for a form when the form of its element is that form (`element.form`).
- A composite whose tab stop can be in a held branch is the exception. `Toolbar` marks its held items with `onDeactivated` and `onActivated`, because Tab would skip the whole toolbar. Such code has a test that fails without it.
- Nuxt removes each call of a client hook, such as `onUnmounted`, from its server build, with its arguments. Call a registration before the hook, and give the hook the function that the registration returns: `const removeLeaving = root.addLeaving(() => element.value); onUnmounted(removeLeaving);`.
- Give each listener, observer and registration to the watcher or the scope that creates it. Release it in the cleanup of the watcher (`onCleanup` or `onWatcherCleanup`), or in `onScopeDispose`. Register the cleanup before the first `await`.
- Keep state in the smallest component or composable that owns it. Use `shallowRef` for an element, an outside object or a list that changes by replacement.
- Derive a value with a pure `computed`. Read a prop, a ref or a getter in the handler that needs it. Do not copy it in `setup`.
- Use `watch` for a change between two values or for an explicit source. Use `watchEffect` for an effect whose synchronous reads are its sources. Use `flush: 'post'` for work that needs the patched DOM. Use `flush: 'sync'` only for a deadline in the same task, with a case that fails under the default flush.
- A composable takes `MaybeRefOrGetter<T>` for a live input and reads it with `toValue` where it needs the value. A callback has its own type, because `toValue` calls a function.

### The element of a part

- A part renders one root element. Scoped styles, `v-show`, directives, `<Transition>` and the attributes of the developer reach it.
- A part with a form value is the native input itself, or holds its form inputs in its element. With the `element` slot, the part renders its form input after the element of the slot, or gives the input to the slot. A part that renders a node of its own in its element, such as the pointer target of `Resizable.Handle`, gives the props of the node to the slot.
- Each part that renders an element takes `as`: a tag or a component, as `<component :is>` takes. A native form control, a form element, a native label, an image and a hidden input take no `as`, such as `Input`, `Checkbox`, `Field.Label` and `Avatar.Image`. The part keeps its content, its own nodes and its attributes on the element of `as`.
- The named slot `element` gets `{ props, elementRef, state }` of the type `ElementSlotProps<State>` of `src/common/element.ts`. The developer renders an element with `v-bind="props"` and `:ref="elementRef"`. The slot wins over `as`. The default slot is the content of the part.
- The template has the slot, then `as`, then the default element in a branch of its own. A tag in `<component :is>` can render a component of the same name that the app registers:

```vue
<slot
  v-if="$slots.element"
  name="element"
  :props="elementProps()"
  :elementRef="setElement"
  :state="state"
/>
<component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
  <slot :state="state" />
</component>
<button v-else v-bind="elementProps()" :ref="setElement">
  <slot :state="state" />
</button>
```

- `useElement` of `src/common/element.ts` gives `element` and `setElement`. A component in `as` or in the slot gives its element as an exposed `element`, else as its `$el`. A Vapor component has no `$el`, so it exposes `element`.
- A template ref on a part has `element`.
- A part sets `inheritAttrs: false` and binds `mergeProps` of Vue with its own props first and `useAttrs()` last. The value of the developer wins, `undefined` too.
- The control of a field gives `joinDescribedBy(attrs, field)` of `src/field/control.ts` to `mergeProps` in place of `useAttrs()`. Its `aria-describedby` then has the ids of the developer and the ids of the field, each id one time. `null` of the developer removes the ids of the field.
- The props type of a part extends `AsProps` and the attributes of its element with `/* @vue-ignore */`, so that a template can give them. It omits from the attributes each attribute that the part declares as a prop, and `as`, because motion-v adds an `as` to `HTMLAttributes`.
- A part that reads its element in its render reads a tag in `as` before the mount with `useAsTag`. The server HTML then has the attributes of the client. `Tabs.Tab` writes `type="button"` only on a `<button>`.
- A part that acts as a button takes `useButton` of `src/common/button.ts`. A `<button>`, an `<input>` of a button type and an element that the part does not know yet are native buttons. Each other element gets `role="button"`, a tab stop, and a click from Enter and Space.
- A disabled button that keeps the focus has `aria-disabled="true"` and no `disabled`. While a button is disabled, the part stops `click`, `mousedown` and `mouseup`, as the browser does for a native disabled button.
- A part that renders a `<button>` gives it `type="button"`, so that it does not submit its form. A `type` of the developer wins.
- A part that the user drags takes `usePointerPress` of `src/common/pointerPress.ts`. The press captures its pointer, so the element of the part gets each move and the release, also outside the element.
- Two families share a contract through `provide` and `inject`. Each contract has a typed key in one module, such as `field/control.ts` for a control and its field. A reader calls `inject(key, null)`, so it gets `null` with no provider.

### The public form

1. A prop that mirrors a native attribute has the name of the attribute in a Vue template: `readonly`, `autocomplete`. An ARIA attribute is a plain attribute, not a prop.
2. No prop says what element the developer renders. A part reads its element after the mount, and a tag in `as` before the mount.
3. The `id` prop names the element that has the role and takes the focus. A native `<label for>` names that element. A blank `id` counts as absent: read it with `givenId` of `src/common/id.ts`.
4. The main state of a part is `v-model`. A second state is a named model, such as `v-model:open`. An uncontrolled state starts from a `default*` prop with the name of the DOM property, such as `defaultChecked`. Give a Boolean model prop the default `undefined` in `withDefaults`. Vue otherwise gives an absent Boolean prop the value `false`, and the part is controlled.
5. A change event comes before the update of its model, in the same task. Its last argument is the details object, `ChangeEventDetails<Reason, E>` of `src/common/changeEventDetails.ts`, with `reason`, `event`, `cancel()` and `isCanceled`. `details.cancel()` is the one way to cancel a change. The details of an event that a listener cannot cancel are `GenericEventDetails<Reason, E>`.
6. A native reset is not a change of the user. The part takes `resetValue` of `useModel` in `src/common/model.ts`: the model of the mount, else the `default*` prop at the reset. It emits only its `update:*` event, and its field is not dirty after it.
7. `<Transition>` animates a part that appears and goes. Content that a user or a developer would lose, such as a closed panel, stays in the DOM with `hidden` when the part has `keepMounted`.
8. A component is `Family.Part`, or the family name when the family has one part. Its types are on the part and also flat: `Field.Root.Props` and `FieldRootProps`. A part with events declares them in its `Emits` interface, such as `FieldRootEmits`, and gives it to `defineEmits`. No constants hold the names of data attributes.
9. A part gives a form what the native control of the same kind gives. It has the same name and value rules, constraint validation, implicit submit and reset.
10. A disabled part is out of the tab order and out of the form data. A read-only part stays in both, and the user cannot change it.
11. A part writes a `data-*` attribute only when no CSS selector on the same element gives the same answer. No part has a `focused` state: use `:focus`, `:focus-visible` and `:focus-within`. A native form element has no `data-disabled`, `data-checked`, `data-required` or `data-readonly`. An ARIA attribute that the part writes for accessibility is the hook for its state, such as `[aria-invalid="true"]`.
12. The moments of validation are `'submit'`, `'blur'` and `'change'`.
13. A part ships no English text. A label that a part needs comes from the developer.
14. A part that formats a text in a locale gets the locale from `useLocale` of `locale-provider/part.ts`: the `locale` prop of the part, else the nearest `LocaleProvider`, else `en-US`.
15. A part reads the text direction of its own element. No provider gives it.

### Measure before you write a defense

Write no code that guards, tracks, repairs or copies a behavior on an assumption:

1. Build the smallest case with plain Vue and native elements, and see what Chromium, Firefox and WebKit do. Keep the case as a test, as [Measurements](#measurements) says.
2. When the browser or Vue does the right thing in the three browsers, write no code.
3. When the browsers differ and a person notices it, write the least code that makes them agree. The target is the HTML Standard and the WAI-ARIA Authoring Practices. A preference of the user, such as the macOS preference for the Tab key, is not a difference to smooth over.
4. A comment at such code names its measurement file, such as `(test/measurements/dialog.test.ts)`. To name one case of the file, add the title of the case: `(test/measurements/dialog.test.ts, "an inert element that covers the page")`.

A part handles the events that the browser sends. It detects no value that an element got with no event. Examples are text before the hydration, a press on a label before the hydration, and form state that the browser restores.

### Platform and parity

- A behavior of a part rests only on features that MDN marks "Baseline Widely available". The build supports the browsers of [Compiler flags](#compiler-flags).
- `Temporal` is one exception: the date and time families need it, and an app loads a polyfill where a browser lacks it. The `focusVisible` option of `focus()` is the other: a part can give it where Base UI gives it, and a browser without it decides the focus ring.
- Each feature of Base UI stays, in the form of Vue. A feature is cut only for a better way that gives the developer or the user the same thing. The family file names that way.
- Where Vase UI agrees with Base UI, match Base UI. Where another behavior is better for the user and the developer, keep it. Give it a row of `parity/better` and a test.
- The library uses `@floating-ui/vue` only to place a popup beside its anchor.

### Popups

`src/popup` holds what each popup family shares. A popup family writes its parts, its root contract and the rules of its layer. `popover/root.ts` is the model of a root contract.

- `usePopupRoot` of `root.ts` holds the open state of a root: its models, its triggers, the active trigger, the payload, the popup element and the change events. A root calls it in `setup` and gives the result to its parts.
- `useLayer` of `layer.ts` puts an open root in the stack of open popups. Its rules give what the root does, such as the close on Escape, the trap of the Tab key, `inert` on the rest of the page and the scroll lock.
- `usePopupTrigger` of `trigger.ts` registers a trigger with its root while it is mounted. A trigger outside its root has a `handle`, a subclass of `PopupHandle` such as `PopoverHandle`.
- `usePlacement` of `placement.ts` places a positioner beside its anchor with `useFloating` of Floating UI.
- `focus.ts` moves the focus into a popup at the open and returns it at the close. `hover.ts` opens a popup for a hover of its trigger. `press.ts` handles the press, the drag and the release of a popup that a press opens.
- `portal.ts` renders the portal of a popup, and `viewport.ts` gives the sizes of a popup that moves to another trigger.
- A popup part renders its element while the root is open, or while the portal has `keepMounted`. A developer animates the popup with `<Transition>`. The root is `leaving` until Vue removes the element of the closed popup.
- The JSDoc of each export of `src/popup` gives its contract.

### Dates and times

The date and time families call `Temporal` and `Intl` directly, with the shared functions of `src/common/date-time`. They have no date adapter.

- No module reads `Temporal` when it loads: no constant and no default of a prop. The first read is in a function that a part calls after `assertTemporal` in `setup`.
- Compare two values with `compareDates`, or with `compareMoments` of `src/common/date-time-field/limits.ts`. Make an emitted value with `withDate` or `withTime`, which keep the kind, the calendar and the zone of the value.
- `displayCalendar` gives the calendar in which a part shows a value. The locale gives only that calendar, never the calendar of a value.
- No render reads the clock. With no `today` prop, a part reads today after the mount.
- Make the days of a list with a step of one day, never of 24 hours. A change of the clock in a time zone then does not repeat or skip a day.
- Watch a `Temporal` prop by its text, not by its object. A consumer can make a new object for the same day in each render.
- A picker root renders `Popover.Root` and no element. `usePicker` of `src/common/picker/root.ts` gives it the value, the template of a new value, today and the state of the picker.
- A part that renders a part of another family is a wrapper in the form of the Vue guide. It declares only the props that it reads, sets `inheritAttrs: false`, and binds `mergeProps(attrs, owned)` to the inner part. `owned` comes last: the values that the wrapper gives, and `undefined` for each prop that it keeps out.

### Server render and hydration

- Each part renders with `renderToString` in Node with no DOM. Start browser work after the mount. Keep mutable server state local to each request.
- The server HTML and the first client render are the same. A value that a server cannot know, such as a measure or today, gets one fixed default on both sides. The part reads the browser value after the mount.
- Read `localStorage` only after the mount. Node.js prints a warning at the first read of `localStorage` in a process with no `--localstorage-file`.
- With Vue 3.6, a server stops the effect scope of each component after the render, so a callback of `onScopeDispose` runs on a server. It does not touch `window` or `document`.
- Give `data-allow-mismatch` only for an expected difference, with its category. The `Intl` data of a server and a browser can differ, so a part that writes a date or a time as text allows a mismatch of that text.
- Vue allows a text mismatch only for an element whose only child is a text. Such an element binds the category `text`. An element that holds such elements, such as `DateField.Input`, binds `children`.
- A part that binds the id of a part that can render after it calls `useDeferredServerRender()` of `src/common/deferredServerRender.ts` in `setup`. Its JSDoc gives the reason.
- A root whose label renders after its attributes assumes a label until the mount, as `Progress.Root` and `Fieldset.Root` do. The server HTML then names the label.
- While Vue hydrates, it keeps the attributes and the style of the server HTML on each element that it keeps. A later render writes a value only when it differs from the first client render. A part whose attributes depend on the `Intl` data writes them again after the mount with `useAttributesAfterMount` of `src/common/writeAttributes.ts`.
- `useIsHydrated` and `useIsHydrating` of `src/common/hydration.ts` give the hydration state of the component that calls them. Their JSDoc says when each is `true`.
- One SFC, `PrehydrationScript.vue`, renders each script that runs before the hydration. It writes the text only on a server. The text is a constant of the library, never a value of a consumer.
- A family whose server render depends on an id, a locale, a script or a portal has a page and its cases in the Nuxt fixture, `fixtures/nuxt`.

### Vapor mode

The source compiles in the Vapor mode of Vue 3.6 with no change. ESLint refuses the forms that Vapor breaks in `packages/vue/src`, and each report gives the form to use. If a line must break a rule, put a disable comment on that line with the reason.

- A slot of a Vapor component is not a vnode, and its props are getters.
- A function ref can run before the element is in the document. Act on the element in `onMounted`.

## TypeScript

Run `pnpm lint:fix`, then `pnpm typecheck` and `pnpm lint`. The last two show the reports that need hand work. Read the diff of `pnpm lint:fix`, because a fix can change what the code does.

### Compiler flags

- The root project, `benchmarks`, `docs` and `packages/vue` extend `@tsconfig/strictest`. A flag of the preset is off only for a reason that this section gives.
- `packages/vue` has two projects: `tsconfig.build.json` for the source, and `tsconfig.test.json` for each file of the package. The build, `pnpm parity:check` and the API reference read the first.
- The test project has `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals` and `noUnusedParameters` off. A ported test can then keep the text of the Base UI test.
- `exactOptionalPropertyTypes` is off in the package. With the flag, the built declarations give a listener no `| undefined`. The consumer project of `pnpm check:package` sets the flag and passes `undefined` to an optional prop and to a listener.
- `noPropertyAccessFromIndexSignature` is off. A bundler replaces `process.env.NODE_ENV` only in that form, and the Vue documentation writes `slots.default`.
- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are also off in the root project and in `docs`, because the scripts do not obey them.
- `lib` and `target` of the package are ES2024. The build has the target `baseline-widely-available`, which tsdown reads as Chrome 111, Edge 111, Firefox 114, Safari 16.4 and iOS 16.4. The build changes only the syntax for that list, and it adds no polyfill.
- In the source of the package, use only a JavaScript built-in that each browser of that list has. The compatibility table of the MDN page of the built-in gives the versions. `Temporal` is the exception.
- `Temporal` is the one API above ES2024 that the source needs. Its types come from `lib.esnext.temporal`, which the Temporal reference line of an entry point loads.
- A file that runs in Node.js, such as a script or a `.node.test` file, can use each built-in of the Node.js version in `.node-version`. A test file that runs in the browsers can use only a built-in that each of the three engines of Playwright has. In both cases, the `lib` of the project must have its types.

### ESLint

- `eslint.config.js` gives the reason for each rule that is off or has an option.
- A disable comment has the form `// eslint-disable-next-line <rule> -- <reason>`. For a block, write `/* eslint-disable <rule> -- <reason> */` before the block and `/* eslint-enable <rule> */` after it.

### Index reads and `!`

`noUncheckedIndexedAccess` adds `undefined` to the type of an index read, and `no-non-null-assertion` refuses `!`. In the source, use the first of these rules that applies:

1. Write the code so that no read can be absent, when the result is as short and does the same. Use `for...of`, a destructure or `.at(-1)`.
2. If an algorithm needs the index, keep the read and write `!`. Disable `@typescript-eslint/no-non-null-assertion` for the line, or for the block when a function has many such reads. The reason says why the index is in range.
3. Do not add a guard or a default that cannot run. Do not write `as T`.

### Idioms

- Write `??` where the left operand is an object, `null` or `undefined`. Where `''`, `0` or `false` must give the default, write `||`.
- Write `.at(-1)` for the last item of a list.
- Write `void` before a promise that the code does not wait for.
- Write `import type` on its own line.
- An optional parameter has no `| undefined`. An optional prop has it, so that a consumer with `exactOptionalPropertyTypes` can pass `undefined`.
- Keep `protected` for a class member that a subclass uses.
- A reactive proxy of an object breaks its `#` members: a method that reads one throws a `TypeError`. Do not put such an object in `ref()`, `reactive()` or `readonly()`. Give it to other code with `provide`, a `shallowRef` or a prop, or call `markRaw(this)` in its constructor.
- Write a development check as `process.env.NODE_ENV !== 'production'`.
- Put each call of `warn` and `error` of `src/common` behind a development check. A production build then has no text of it.
- Write the description of a `Symbol` as `process.env.NODE_ENV !== 'production' ? 'description' : undefined`. Only Vue Devtools shows it.

## Error messages

Each error message of the package says three things:

1. What occurred.
2. Why it is a problem.
3. How to correct it.

Example:

```text
Vase UI: <Dialog.Trigger> must be inside <Dialog.Root>, or it must have a `handle`. Without a root the trigger has no dialog to open. Put the trigger inside <Dialog.Root>, or pass a `handle`.
```

A production build has no error texts:

- `errorMessages` in `src/common/createError.ts` holds the text of each error, by its code. Throw `createError(code, ...values)`. ESLint refuses `new Error` in the source.
- A text writes each value as `{0}`, `{1}` and so on, in order. `createError` takes one value for each.
- In a production build, the error gives the code, the values and the address of the text: `Vase UI error #3 ["Image"]: https://vase-ui.com/errors#3`. The page `docs/errors.md` shows `errorMessages`.
- Give a new text the next code. Do not give a code to another text, because an error of an earlier release links to it.

## Comments

- The code is the documentation. Correct a name or the structure before you add a comment.
- A comment stays only where it gives a reason that the code cannot show: a decision, an outside constraint, a measurement or an upstream link.
- Do not write the history of the code in a comment or in a doc.
- `scripts/repo/history.test.ts` refuses a word that tells the history of the code, a plan label and a pull request number of this repository in each file. Its allow-list holds only lines that tell no history, such as a Conventional Commit type or the title of a Base UI case.
- Write the reason for a node of a template as a comment in the script block. A comment in a template becomes a DOM node in a development build.

## Tests

### Where a test runs

- A file `*.test.ts` or `*.test.tsx` runs in Chromium, Firefox and WebKit. A file `*.node.test.ts` or `*.node.test.tsx` runs in Node.js with no DOM, for the server render and for logic with no DOM. There is no jsdom.
- A file `*.spec.ts`, `*.spec.tsx` or `*.spec.vue` is a type test. vue-tsc checks it, and no test runner runs it. A `.spec.vue` file starts with `<!-- @strictTemplates true -->`, so vue-tsc reports an unknown prop as it does for a consumer that sets `strictTemplates`.
- [Setup](#setup) gives the commands that run the tests with Vue 3.6. Only an SFC compiles in Vapor mode, so a test of a family mounts SFC fixtures.
- Each file of `test/vaporParts/expectedFailures.json` lists the cases that fail in the project `vapor-parts` for a cause in Vue. Each cause has an issue link. A fault of Vase UI gets no entry.
- The jobs that run Vue 3.6 install a prerelease, so `required` does not need them.
- `test/server/engineInstances.ts` runs the test files of Firefox one at a time, because Firefox has one mouse for all its windows. Its comments give the reasons for the preferences of Firefox.
- The job `test-browser` of CI runs the Firefox tests and the WebKit tests in shards. To run one shard on your machine, add its flag: `pnpm test:firefox --shard=1/3`. Add a WebKit shard when the files of a shard pass about 400.
- On a pull request, the job `select` runs `scripts/ci/selectTests.ts` on the changed files. Each test job then runs only what those files can change. The merge queue skips `select`, so each test job there runs each test file.
- A test can read a file by its path and not import it. Keep such a file in the folder of the test or below it. For a file elsewhere, add its path to the files of `scripts/ci/selectTests.ts` that run each test file.
- Set the `timeout-minutes` of a job to 1.5 times the 95th percentile of its passed runs in the merge queue. Round it up to a multiple of 5 minutes. For a job with a matrix, use the slowest entry. When a passed run takes more than two thirds of the limit, measure the job again.
- On macOS, `test/server/engineInstances.ts` starts WebKit with full keyboard access through `test/webkitFullKeyboardAccess.sh`. Full keyboard access does not put a link in the order of the Tab key. So a case that tabs to a link fails in WebKit on macOS.
- On Linux, Chromium keeps a block of shared memory for each module that a new test frame loads, until a garbage collection. CI sets `VITEST_CHROMIUM_GC_DISK_THRESHOLD_GB`, so Vitest collects the garbage after each test file. Without it, a long run loses its connection with `Browser connection was closed`.
- The tests of `fixtures/nuxt` run in Node and read the pages of the Nuxt app in Chromium. The cases of an engine with no `Temporal` also run in Firefox and WebKit. The job `test-nuxt` runs them, and `required` needs that job.

### Test helpers

The helpers are in `packages/vue/test`. The types and the JSDoc of a helper are its contract.

- `mount` of `test/render.ts` mounts a fixture in the app of the test project: a virtual DOM app or a Vapor app. The fixture is an SFC of `test/fixtures` that composes the parts, such as `CollapsibleParts.vue`. The helper unmounts the app after the test.
- `renderOnServer(fixture, props)` of `test/render.ts` renders a fixture of `test/fixtures` in Node, and `hydrate` hydrates that HTML in the app of the project. The props go to Node as JSON, so a prop cannot be a function.
- `test/render.ts` prevents each submit of a form, so that Firefox does not load the test page again. `submitsPrevented` records whether a listener of the form prevented the submit first.
- `waitFor` of `test/waitFor.ts` gives up after 180 frames, not after a time. A busy machine can stall the page for some seconds, and a stall uses no frame.
- `test/setup.ts` fails a test when Vue warns, or when a call to `console.warn` or `console.error` reaches the console. It moves the real pointer off the page after a test that put it there. It refuses a pointer lock, so a test that needs one mocks `requestPointerLock`. A test ends when `<body>` is empty: in a Vapor app, an element that leaves in a `<Transition>` stays after the unmount until its leave ends.
- `takeReportedMessages()` of `test/reportedMessages.ts` takes the messages that a test expects. Assert the whole list that it returns.
- `nextEvent` of `test/animation.ts` waits for an event of a transition or an animation. It gives up after 180 frames.
- `finishAnimations` of `test/animation.ts` waits for an animation of an element, and ends each one with `finish()`.
- `readAfter` of `test/wait.ts` reads a value some milliseconds after an event of an element. `readWhen` reads a value in the task of a change of the DOM, such as the start of a leave.
- `expectNoAxeViolations` of `test/axe.ts` runs axe-core on an element.
- A `.node.test` file does not import `#test-utils`, because that index loads the libraries of the DOM helpers. It imports `renderToString` from `vue/server-renderer`.

### Test rules

- A test exists for a behavior that a user or a developer meets, a contract or a real fault. Do not test a fact of Vue, of the browser or of a library.
- A test title names the behavior that it checks. It has no label of a plan or of a list.
- A test must fail when the behavior in its title breaks. Break the behavior in the source, make sure that the test fails, then put the source back.
- A test belongs in the test file of the family whose prop or behavior it asserts. A file with a scenario of its own is `<Family>.<scenario>.test.ts`.
- Use only the Vitest APIs and the matchers of `@testing-library/jest-dom`. `toHaveTextContent` passes when the text contains the string: to compare the whole text, use `expect(element.textContent).toBe(text)`.
- Put one assertion in each `waitFor`. Assert the start state before the action when the end state can be true already.
- A case passes each time that Vitest runs it again in one page: `pnpm test:chromium Collapsible --repeats 1`. A case that replaces a method of a prototype or of a global object restores the method when the case ends.
- When a test expects a Vue warning or a `Vase UI:` message, assert the whole list of `takeReportedMessages()`. A case with a console spy asserts each call of the spy.
- Put a case that throws in `setup` last in its file. A `setup` that throws leaves the current instance of Vue set, and a later case can get a warning about a slot.
- For a mouse, the browser sends `pointerdown` and `mousedown` in one task, and `pointerup`, `mouseup` and `click` in a later task. A case that depends on a 0 ms timer of a part dispatches the events of one task in one `Promise.all`.
- A case that asserts what a part does when an element loses the focus moves the real focus, with `blur()` or `focus()` on another element. A dispatched `focusout` does not move the focus.
- To assert that a timer did no work, call `await wait(0)` after the action. One frame is not a wait for a 0 ms timer.
- Press Tab with `userEvent.keyboard('{Tab}')`. `userEvent.tab()` runs no script in the frame of the test before its key, so after a focus that a script moved into the frame, WebKit can send its `keydown` to the page of Vitest.
- A command of `userEvent` can take some seconds on a busy machine. A check before the end of a delay starts at the event that starts the delay, with `readAfter`. An action that must come in a delay, a press window or a leave comes in the task where it starts, with `readWhen` or a listener of the event.
- Do not poll a state that exists only while an animation runs. Read the state of a short animation in the task where it starts: a slow command of `userEvent` or a stall of the page can end the animation before a later task. Record the state in a `MutationObserver`, for example with `readWhen`, or record the events of the animation. Then wait for a state that stays, such as `hidden` or the removal of the element.
- Give a duration of 100 s to each animation that a case ends with its own call, such as `finish()`. A late frame can end a short animation before the part reads it. A command or a check that must come during an enter or a leave in a later task also needs this duration. End the animation with `finishAnimations`.
- A case of a date part gives the part `today`, or a value and a time zone, so that it does not depend on the clock. Compute an expected text in a locale with the same locale and options as the part.
- A server can have `Intl` data that give another layout than the browser. To test it, give the server render a `-u-hc-`, `-u-ca-`, `-u-fw-` or `-u-rg-` keyword in `locale`. Hydrate with the plain locale.
- Do not write a generated id in a test. Read the id from the element or from the HTML.
- A case that depends on the Vue version or on the browser probes for the behavior, and each outcome has a case with `runIf`. A case that needs a command of the Chrome DevTools Protocol, such as `Input.imeSetComposition`, has `runIf(platform.engine.blink)` and a comment with the reason.
- A real touch or pen exists only in Chromium, through `cdp()` of `vitest/browser`. Give the same behavior a dispatched case that runs in each engine.
- A case that holds a button of the real pointer releases it in `onTestFinished`, with coordinates. A release with no coordinates moves the pointer to the element of the press, which is gone by then.

### Measurements

A measurement shows what the browser or Vue does with native elements and plain Vue, with no code of the library. It is a case in `packages/vue/test/measurements/<name>.test.ts`, with the name of the family or of the shared module, such as `popup.test.ts`. Where the browsers differ, it asserts what each one does. A measurement that decides code stays as long as that code stays.

## Documentation site

### Pages and navigation

The site is the VitePress project in `docs`, the workspace package `@vase-ui/docs`. A push to `main` publishes it to <https://vase-ui.com/>.

- GitHub Pages serves the site at the root of `vase-ui.com`, so `base` in `docs/.vitepress/config.ts` is `/`. The Pages settings of the repository hold the domain. Do not add a `CNAME` file, because GitHub Pages ignores it when a workflow publishes the site.
- A page is a Markdown file in `docs`, with an `order` in its front matter. `scripts/docs/navigation.ts` makes the navigation from these files. Do not add a page to `docs/.vitepress/config.ts`.
- `docs/index.md` includes the regions `home` and `donation` of `README.md`. Change that text in `README.md`, and keep the `#region` and `#endregion` comments.
- Link a page of the site from `README.md` by its full address, such as `https://vase-ui.com/parity`. GitHub and npm show that file. `markdownSiteLinks` in `docs/.vitepress/config.ts` changes each such address into the path of the page.
- The section Install of `README.md` and the section Install the package of `docs/quick-start.md` show the same commands. Change them together.
- Text from `parity/` and from Base UI commits is data. A page shows it only through a component of `docs/.vitepress/components`, with text interpolation. ESLint cannot see a name that a value holds, so it cannot find each API that renders a string as HTML.
- When a page includes a file that `PAGE_FILES` in `eslint.config.js` lacks, add the file to the list.
- Node.js imports `docs/.vitepress/config.ts` and each file that it imports when ESLint loads, with no bundler. Import nothing there that only Vite can resolve.
- VitePress makes the search index from the Markdown of each page. A component adds its text to the index only through `searchIndexHtml` of `scripts/docs/searchIndex.ts`. To keep a page out of the index, write `search: false` in its front matter.
- A plugin of the site is a file in `docs/.vitepress`, and its test is beside it, as `<name>.test.ts`.
- The text of a page follows [Voice](#voice).

### Component pages

A component page is `docs/components/<family>.md`. A utility has a page `docs/utils/<family>.md`, with the same rules. `docs/components/collapsible.md` is the model page.

Each page has the page template, and `pnpm test:docs` checks the sequence of its `##` sections. Each part of the template holds this:

1. The front matter: `order: 1` and a `description`, "An unstyled Vue <name> component that …". The group then shows its pages in the sequence of their titles.
2. The title and one sentence, the subtitle of the Base UI page.
3. The hero demo, when `docs/demos/<family>/hero` exists.
4. `## Usage guidelines`, only when the Base UI page has it, or on the page of a component of Vase UI's own when a misuse is likely. Port only the bullets that are true for Vase UI.
5. `## Anatomy`: "Import the component and assemble its parts:", or "Import the component:" for one part, and the sample `<<< ./<family>/Anatomy.vue`.
6. The topic sections of the Base UI page, with its titles. `TOPIC_SECTIONS` in `scripts/docs/pageSections.ts` lists them for each family.
7. `## Examples`: one `###` section for each demo of the record other than `hero`, with its frame. The Base UI page gives the text and the order. Port an example with a code sample and no demo only when Vase UI has its feature. An example of Vase UI's own shows an API that Base UI lacks, or a form of Vue that only this component has.
8. `## Keyboard`, only on the page of a component of Vase UI's own: one table, Key and Action.
9. `## API reference`: `<ApiReference />`. Then, for each function, class or type that the page shows, a `###` heading, one sentence and `<ApiReference name="…" :heading-level="4" />`.
10. `## Differences from Base UI`: `<BaseUiDifferences />` alone. The rows of the parity files give its text. To change a text there, change its row.

- A general rule for each component, such as a rule of portals, of the server render or of animation, goes in the handbook. A duty of the developer for one component stays on its page as an example, such as "Render on the server".
- A text about one prop or event goes in its JSDoc.
- A page tells no history and no decision.

### Demos and samples

- A demo is `docs/demos/<family>/<demo>/<variant>/index.vue`, with one folder for each variant that Base UI has: `css-modules` and `tailwind`. It keeps the elements and the attributes of its Base UI file.
- The demos of a family of Base UI are the demo folders of Base UI at the `matchedCommit` of the family. `docs/demos/<family>/upstream.json` records them with the SHA-256 of each file. `pnpm docs:demos` writes the record and the style sheets. Do not edit them.
- In a Tailwind demo, write `class` in place of `className`, and an array in `:class` in place of `clsx`. A constant that holds class names ends with `Class`, `ClassName` or `Classes`.
- The text and the links of a demo are about Vase UI. A link to a page of this site starts with `import.meta.env.BASE_URL`, because VitePress does not add the base to a link in a demo.
- Give each landmark of one role on a page its own name with `aria-label`. The viewport of a toast is such a landmark. The name says what the demo shows: "Undo notifications".
- A popup with the role `dialog` and no title part has `aria-label`. A scroll container that holds no control has `tabindex="0"`, because WebKit gives it no keyboard focus.
- A demo of a date or time component sets `locale="en-US"` and gives a calendar no `today`. A value that follows today is an empty `shallowRef` that `onMounted` sets. Make each `Temporal` value in the script, because a template cannot read `Temporal`.
- A demo of a component of Vase UI's own has the two variants. Its class strings follow the Tailwind demos of Base UI and the colors of `docs/demos/tailwind.css`. `packages/vue/test/demos.ownVariants.test.tsx` compares the two variants.
- A Base UI demo can import a library from npm. The Vue demo imports the same library or its Vue counterpart, at an exact version in the `devDependencies` of `docs/package.json`. Add each library that renders on the server to `server.deps.inline` of `packages/vue/vitest.config.ts`.
- On the page, a demo is in `<DemoFrame>`. A demo with two variants gives its Tailwind component to the slot `#tailwind`. Show the source of each variant in its own `<DemoSource>` with one `code-group`. `docs/components/button.md` is the model.
- Each demo is a test fixture. `packages/vue/test/demos.test.tsx` mounts each demo of both variants, checks it with axe and hydrates its server render. `packages/vue/test/demos.popups.test.tsx` opens the popup of each demo whose folder names a `Portal` part. A new demo needs no new test.
- A sample is `docs/components/<family>/<Name>.vue`, or `docs/utils/<family>/<Name>.vue`. The page shows its source with `<<<` and does not render it.
- A page can show a part of a sample. Mark the part with `// #region <name>` and `// #endregion <name>`, and show it with `<<< ./<family>/<Name>.vue#<name>{ts}`.
- A sample that imports a router, such as `RouterLink` or `NuxtLink`, is a component of `fixtures/nuxt/app/components`. The page shows it with `<<< ../../fixtures/nuxt/app/components/<Name>.vue`.
- A demo declares its props in a type literal, not with a type of `@vase-ui/vue`. The SFC compiler then reads the props from the demo file.
- A sample that wraps a part gives each optional Boolean prop that it declares the default `undefined`. Vue otherwise changes an absent Boolean prop to `false`.

### API reference

The site build makes the API reference from the types and the JSDoc of the source. Do not write a table by hand. To change a text of the reference, change the JSDoc.

- The reference lists the parts in the sequence of the Base UI page.
- The Default column shows the `@default` tag of a prop in the exported props interface of the part. A property that an interface declares again does not get the tag of the base interface.
- `@ignore` keeps a prop out of the reference.
- The description of an event is its JSDoc in the `Emits` interface of the part. Write a JSDoc for each event, `update:*` too.
- Write each selector and each CSS variable of a part as a tag in the JSDoc of its constant. Put the tags after the line that names the element: ``@selector `[hidden]` The panel is closed.`` or ``@cssVariable `--collapsible-panel-height` The height of the content of the panel, in pixels.`` The reference shows them in the tables Selectors and CSS variables.
- Write one selector for each state that a developer styles, as CSS writes it for the element of the part. Write no selector for `:hover`, `:focus`, `:focus-visible` or `:active`.
- The slots `default` and `element` and the exposed `element` share one description when their JSDoc is empty. Each other prop, slot and exposed member needs a JSDoc.
- `<ApiReference name="…" />` shows one function, class or type, such as `Dialog.createHandle`, with no heading. The page writes the heading.
- A Base UI page can end a heading of its reference with `[New]` or `[Preview]`. The extract records the word, and the reference shows a badge. Do not write the word on the page.
- `pnpm docs:dev` makes the reference again after a save of a file in `packages/vue/src`. After a change in `parity` or of an installed package, start the server again.

### Handbook pages

- `docs/handbook` holds the handbook pages. Their `order` follows the Base UI handbook. A page that Base UI does not have comes after them.
- A handbook page shows its samples from `docs/examples/<page>` and does not render them. It renders only the demos that Vase UI ports from its Base UI page, in the family `handbook-<page>`.
- A handbook page that has a Base UI page ends with `## Differences from Base UI`: one table, Base UI and Vase UI, with only the rows of its subject.
- Before you move `matchedCommit` of a handbook family, compare the page with the Base UI page at the new commit. `pnpm parity:check` does not read the text of a page.
- Base UI has some handbook demos only as a Tailwind variant, such as the demos of Forms. The page gives such a demo to the slot `#tailwind` and shows its source in a `code-group` below the frame, with no `<DemoSource>`.
- A wrapper module of `demos/components` of Base UI goes to `docs/demos/handbook-<page>/components/<module>.ts`, made with `withProps`.

### Look of the site

- The site extends the default theme of VitePress with the look of the Base UI docs. `docs/.vitepress/theme` holds that extension and nothing else. A page imports its components from `docs/.vitepress/components`.
- Take each color, size and space from the style sheets of the Base UI docs. Where a value gives text less than the AA contrast of WCAG, use the nearest Base UI value that passes.
- The site uses Hanken Grotesk for text and Geist Mono for code, from their npm packages. Do not load a font from another server.
- The theme of the site is the class `dark` of the root element. `docs/.vitepress/postcssFollowSiteTheme.ts` changes each `@media (prefers-color-scheme: dark)` rule into a rule for that class.
- `postcssIsolateStyles` keeps each style sheet of `docs/.vitepress/theme` out of the demos. Put a rule for the frame of a demo in `DemoFrame.vue`.
- A copied style sheet can give text less than the AA contrast of WCAG. Do not edit the sheet. For a popup, add a rule to `look.css`. For text in the frame, add a rule with `:deep()` to `DemoFrame.vue`. Use the nearest value that passes. Name the part and its state in the selector, not the demo. Give each selector a row in `packages/vue/test/demos.contrast.test.tsx`.
- A class string or a style sheet of a demo can make a list cut the text of an option. Add a rule to the part "Popups of demos" of `look.css` that lets the text wrap.
- A component of the site that shows a table puts it in `<ScrollBox>` with a `label` that names the table. The box takes the focus only while it scrolls.
- A heading that a component of the site writes is one level below the page heading above the component.
- `docs/public` holds the files that the site serves as they are. The words of the wordmark are `vase uı`, with the dotless i (U+0131). They are outlines of Inter Bold, with the `u` of the feature `cv06` and a letter-spacing of -0.02 em. An SVG file in an `<img>` cannot load a font, so do not write the words as text.
- When you change the mark, change each SVG file and render the PNG and ICO icons again. `README.md` names the wordmark files by their address on `main`, so do not move or rename them.
- `og-image.png` is the link preview. Change `og:image:alt` in `docs/.vitepress/config.ts` when you change the image.

### Thanks page

- `docs/thanks.md` includes the region `thanks` of `THANKS.md`. `pnpm thanks:render` writes `THANKS.md`. Do not edit the file.
- A name in `THANKS.md` is data. `isDisplayName` and `isPlainText` of `scripts/thanks/render.ts` decide which names the script writes.
- After a change of the fixed text of `scripts/thanks/render.ts`, run `pnpm thanks:render` and commit `THANKS.md` in the same pull request.

## Benchmarks

The workspace project `benchmarks` measures the size and the render time of Vase UI and of other component libraries. Its `package.json` pins each library and each framework.

- An app renders one scenario of one library, such as Dialog, in one setup. `benchmarks/scenarios.ts` lists the setups, the libraries and the scenarios.
- The scenario `AllComponents` of a library renders each of its other fixtures one time.
- The setup `vdom` is a Vue app of `createApp`. The setup `vapor-interop` is a Vapor app of Vue 3.6, and it renders the components of each library through `vaporInteropPlugin`. The setup `react` is for Base UI.
- In `vapor-interop`, the build compiles the SFCs of the harness and of the fixtures in Vapor mode. The components of each library stay virtual DOM components.
- Each setup has an empty app: the harness with one button. The empty app of `vapor-interop` has no interop plugin, so the app of each library in that setup also counts the runtime of the plugin.
- Each app has one copy of its framework and one JavaScript file. The build uses the defaults of Vite for production, with no module preload polyfill.

| Command | Function |
| --- | --- |
| `pnpm benchmarks:build` | Builds each app into `benchmarks/dist/<setup>/<library>/<scenario>`, and each empty app into `benchmarks/dist/<setup>/EmptyApp`. It also renders `AllComponents` of each library on the server, and builds the page that hydrates that HTML into `benchmarks/dist/hydration/<setup>/<library>`. When the server render throws or reports an error, that folder holds only the reason, in `server-render-error.txt`. Run `pnpm build` first. |
| `pnpm benchmarks:size` | Builds each app. Then it writes all of `benchmarks/results.json` except the part `time`: the raw, gzip and Brotli bytes of the JavaScript and CSS files of each app, the date, the commit, and the version of each library, framework and tool. A library with no fixture for a scenario gets `null`. The compressed bytes depend on the zlib and the Brotli of Node.js, so the file also records their versions. Run `pnpm build` first. |
| `pnpm benchmarks:time --engine <engine> --setup <setup> [--rounds <count>]` | Times the apps of `benchmarks/dist` in a Playwright browser: `chromium`, `firefox` or `webkit`. The setup is `vdom` or `vapor-interop`, and `vdom` also times Base UI. In each round, each visit opens the page of each library once, in a new browser context. The sequence of the libraries is random in each visit. The default is 30 rounds. After each round, it writes the samples to the part `time.<engine>.<setup>` of `benchmarks/results.json`. Run `pnpm benchmarks:build` first. |
| `pnpm test:benchmarks` | Tests the statistics of the results. `pnpm lint` runs it. |
| `pnpm benchmarks:typecheck` | Runs vue-tsc on the Vue files and tsc on the React files. The job `check` of CI runs it, so a pull request that changes the API of Vase UI also corrects the fixtures. Run `pnpm build` first. |

`pnpm benchmarks:time` gives each library the same input:

- A mount visit starts 100 instances of each component. In Chromium, it also gives the heap that the mount adds, after a garbage collection.
- A popup visit opens and closes Dialog, Popover, Menu, Select and Combobox five times, then times one more pair. A click on the trigger opens Dialog and Popover. ArrowDown on the focused trigger opens Menu and Select. ArrowDown on the focused input opens Combobox. A real Escape press closes each popup.
- Each timed open starts from a closed popup. When the focus on its input opens a Combobox, an Escape press closes it before the timed ArrowDown.
- A list visit does the same with 1,000 options in Select and Combobox. Then it times one ArrowDown, and for Combobox the filter `9`, which leaves 271 options.
- A hydration visit times the hydration of the server HTML of `AllComponents`.
- A console error, a console warning or an uncaught error fails the sample. The cell then shows the reason, and the run goes on without the cell.
- Chromium runs with its CPU four times slower. Firefox and WebKit run with no slowdown, because Playwright has no such control for them.

A fixture is `benchmarks/libraries/<library>/<Scenario>.vue`, or `.tsx` for Base UI. Each fixture follows these rules, so that each library gets the same conditions:

1. Use the parts and the import form of the anatomy, or of the first example, in the documentation of the library at the pinned version.
2. Use the default props of the library. Set a prop only for the start state of the scenario, such as the value 50 of the Slider, or where the documentation tells you to set it. A Combobox uses the filter of the documentation, which is the built-in filter where the library has one.
3. Give each fixture of a scenario the same text. Select and Combobox take the labels of their options from `benchmarks/harness/options.ts`: `Option 1` to `Option N`, where N is the URL parameter `options`, else 5.
4. Do not add CSS, icons, animations or virtualization. Do not add a part that only holds an icon, such as `Checkbox.Indicator`, `Select.Icon` or the indicator of an item. A button that holds an icon in the example, such as the Clear button of a Combobox, stays, with a text in place of the icon.
5. Put `data-bench="trigger"` on the trigger button, `data-bench="input"` on the input of a Combobox, and `data-bench="popup"` on the popup element. When the library gives no popup element, put `data-bench="popup"` on an element inside the popup.
6. Read the documentation of a library and install its npm package. Do not copy its source.

The page [Benchmarks](https://vase-ui.com/benchmarks) shows `benchmarks/results.json` and `benchmarks/features.json`. Its list of the rows where Vase UI is larger or slower comes from the results, so do not write that list by hand.

- `features.json` has a row for each feature and a cell for each library. A cell has a `value`, an optional `note` and a `source`.
- The `source` is a page of the docs, of the package or of the code of the library, at the pinned version. A reader must find the fact there.
- In a row of the kind `support`, the value is `yes`, `no`, `partial` or `not-applicable`. Use `not-applicable` for a feature that the framework of the library does not have, such as a Nuxt module for a React library. In a row of the kind `fact`, the value is a text, such as a count or a date.
- A note that starts with "Our check" gives the result of our own check: of the example in the docs in Chromium, or of the apps of `benchmarks` in Chromium, Firefox and WebKit. Use such a check only where the docs do not give the fact, or for the result of a hydration or of an app.
- `pnpm test:repo` fails when `results.json` has another version of a library or a framework than `benchmarks/package.json`. Record a run in the pull request that moves a pin.

`benchmarks/results.json` holds only the results of the workflow `Benchmarks`, not of a run on your machine. To record a run:

1. Start the workflow on `main`, or on the branch of the pull request that moves a pin: `gh workflow run benchmarks.yml --ref <branch>`.
2. When the run is complete, delete `benchmarks/results.json`.
3. Download the artifact `results` of the run: `gh run download <run> --name results --dir benchmarks`.
4. Commit `benchmarks/results.json` as `docs(benchmarks): record the results of <date>`.

After each release, record a run in a pull request of its own.

## Releases

The workflow `.github/workflows/release.yml` stages each release of `@vase-ui/vue` on npm. The repository holds no npm token.

- A version is `YYYY.M.MICRO`, such as `2026.12.0`. A month below 10 has one digit, and `MICRO` starts at 0.
- The tag of a release is `v` and the version: `v2026.12.0`. A ruleset lets only an organization admin create, change or delete a `v*` tag.
- Each release has the dist-tag `latest`. `CHANGELOG.md` has one section for each version, and it lists first each change that a consumer must make. The GitHub Release of a tag has the text of its section.
- The comments of `release.yml` give the rules of the trusted publisher. Do not give `npm stage publish` the option `--allow-publish`.
- The job `check` of `release.yml` runs the commands of the job `check` of CI. Change the two lists together.
- The job `stage` installs only `@vase-ui/vue` and the workspace root. Keep the filter when you add a workspace project.

To make a release:

1. Run `pnpm thanks:render`, and commit `THANKS.md`.
2. Merge a pull request that changes `version` in `packages/vue/package.json` and adds the section of that version to `CHANGELOG.md`.
3. Make sure that the check `required` passed on that commit of `main`. The workflow does not run `pnpm test`.
4. As an organization admin, push the tag of that commit: `git tag v2026.12.0 <commit>`, then `git push origin v2026.12.0`.
5. On npmjs.com, approve the staged version with two-factor authentication. Only a maintainer of the package can do this. Approve more than one staged version in order, from the lowest version.
6. Make the GitHub Release of the tag with the section of that version in `CHANGELOG.md`.

## Text

- Write commit messages, pull requests, code comments, docs and this file in Simplified Technical English (ASD-STE100).
- Use short sentences, the active voice and one instruction in each sentence.
- Give a thing the name of what it is. Do not use metaphors in names.
- Do not name a GitHub account with the at sign in a pull request, because GitHub then sends a notification. Use a link to the profile, as `THANKS.md` does.

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

- "Oops! Your Dialog lost its Root". Write the error message of the example in [Error messages](#error-messages).
- A line about a person, or about how good another project is.
