# How to contribute to Vase UI

Vase UI is a port of [Base UI](https://base-ui.com) to Vue 3. The first section says what is open to people outside the project. The other sections give the rules of the port to the maintainers and agents that write the code.

## Bug reports and ideas

Mathematic uses AI agents to maintain this repository. We write all of the code. GitHub lets only collaborators open a pull request.

- Report a bug in [Bugs](https://github.com/vase-ui/vase-ui/discussions/new?category=bugs). Give the versions, the browser and the steps. Include a reproduction if you can.
- Request a change or a new feature in [Ideas](https://github.com/vase-ui/vase-ui/discussions/new?category=ideas).
- Ask a question in [Q&A](https://github.com/vase-ui/vase-ui/discussions/new?category=q-a).

An AI agent reads each new discussion in Bugs and Ideas. See [Contributing](https://vase-ui.com/contributing) for the full report and response process.

If Base UI has the same bug, you can also report it to [Base UI](https://github.com/mui/base-ui). Vase UI includes every improvement of a Base UI release within two weeks.

Watch the repository for pull requests and releases.

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
| `pnpm thanks:render` | Writes `THANKS.md` from GitHub's contributor lists of Base UI, Floating UI and aria-hidden. It uses your `gh` login. |
| `pnpm parity:check` | Checks each family against its extract of Base UI. It also checks the rows of `parity/better` and each record in `parity/own`. It reads only the repository. |
| `pnpm parity:extract --upstream <path> [family]` | Writes `parity/families/<family>.upstream.json` from a local clone of Base UI. With no family name, it writes each extract. With `--check`, it writes nothing and fails when an extract is absent or differs. With `--counts` alone, it prints the counts of Base UI at the tracked commit. |
| `pnpm parity:track <sha> --upstream <path>` | Writes `parity/upstream.json` for a Base UI commit. The commit must be the tracked commit or a descendant of it. |
| `pnpm docs:demos --upstream <path> [family]` | Writes the demo style sheets of a family and the record `docs/demos/<family>/upstream.json` from a local clone of Base UI. With no family name, it does this for each family with a page or a demo folder. With `--check`, it writes nothing and fails when a file is absent or differs. |
| `pnpm check:package` | Builds the package with the fixture families and packs it through `prepack`. It fails when the pack lacks the license, notices or readme. It runs publint, Are the Types Wrong and a consumer project. The project fails when a prehydration script is in a client bundle or not in Node. |
| `pnpm release:check-tag <tag>` | Fails when the tag is not `v` plus the version in `packages/vue/package.json`, or when that version does not have the form `YYYY.M.MICRO`. |
| `pnpm docs:typecheck` | Runs vue-tsc on the site configuration, the site components, the data loaders, the code samples and the demos in `docs`. Then it compiles each Vue file in `docs` outside `.vitepress` with the SFC compiler. It also compiles each Vue file that a page shows from another folder. |
| `pnpm docs:build` | Builds the site into `docs/.vitepress/dist`. It fails when the check of `pnpm parity:check` fails. `pnpm docs:preview` then serves the built site. |
| `pnpm docs:axe` | Runs axe-core in Chromium on each built page, in both themes, at 1440 and 320 pixels, and in each styling method of the demos. It gives each page the day 2026-11-14 as today, so the result does not change with the day of the run. It fails on a violation that `KNOWN_FAULTS` in `scripts/docs/axeSite.ts` does not list, and on a row that matches none. Run `pnpm docs:build` first. |
| `pnpm docs:search-focus` | Checks where the focus of the search box is on the built site, in Chromium and Firefox, and on macOS also in WebKit. Run `pnpm docs:build` first. |
| `pnpm --filter @vase-ui/nuxt-fixture dev` | Starts the development server of the Nuxt fixture, `fixtures/nuxt`. Run `pnpm build` first. |
| `pnpm --filter @vase-ui/nuxt-fixture typecheck` | Runs `nuxt prepare`. Then it runs the vue-tsc of `packages/vue` on the app of the Nuxt fixture. Run `pnpm build` first. |
| `pnpm test:vapor` | Runs the browser tests in Chromium in a Vapor app. It needs Vue 3.6. See [Where a test runs](#where-a-test-runs). |
| `pnpm test:vapor-parts` | Compiles the parts as Vapor components and runs the listed files in Chromium. It needs Vue 3.6 and runs alone. See [Where a test runs](#where-a-test-runs). |
| `pnpm test:nuxt` | Runs the tests of the Nuxt fixture, `fixtures/nuxt`, in Chromium. It tests a production build and then the development server. The cases of the page `form-state` also run in Firefox and WebKit. Run `pnpm build` first. |
| `pnpm test:vite` | Builds the client app of `fixtures/vite` and runs its test in Chromium. Run `pnpm build` first. |

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
- `@vitest/browser-playwright` has a pnpm patch in `patches`. Without the patch, a real click, key press or drag that is the first browser command of a test file can fail ([vitest-dev/vitest#11876](https://github.com/vitest-dev/vitest/issues/11876), [vitest-dev/vitest#11928](https://github.com/vitest-dev/vitest/issues/11928)). The patch first compares the only child frame with the only test iframe element in one protocol message. In each other condition, it finds the frame from the iframe element. `test/browserFrame.test.ts` checks the lookup of the installed provider.
- When a release of `@vitest/browser-playwright` corrects the two issues, run `pnpm patch-remove @vitest/browser-playwright@5.1.0`. Then install that release. Delete `test/browserFrame.test.ts`, `test/server/inspectBrowserFrame.ts` and the command `inspectBrowserFrame` of `vitest.config.ts` with the patch. Their cases count the element lookups of the patch. For a release without the corrections, make the patch again. pnpm refuses an install when a patch names a version that the dependencies do not have.
- `rolldown-plugin-dts` has a pnpm patch in `patches`. `tsdown` uses it to bundle the declarations. Without the patch, it does not keep a `/// <reference lib="…" />` line at the start of a bundled declaration file. A date or time entry point then loses the line that gives a consumer the `Temporal` types.
- The patch adds `lib` to the expression `REFERENCE_RE` of `rolldown-plugin-dts`, which keeps only `path` and `types`. When a release of `tsdown` uses a `rolldown-plugin-dts` that keeps the `lib` line, run `pnpm patch-remove rolldown-plugin-dts@0.30.1`. Then install that release of `tsdown`. The step "Check the declarations that name Temporal" of `pnpm check:package` fails when the release lacks the correction.
- `vitepress` stays at exactly `2.0.0-alpha.21`, a prerelease. The stable release, 1.6.4, installs a second Vite from the 5.x line. `pnpm audit` lists advisories for that line, and no 5.x release corrects them. The prerelease uses the Vite of `packages/vue`. Install the stable 2.0 release when VitePress publishes it.
- ESLint renders each page with the VitePress of `docs`. Do not add `vitepress` to the root `package.json`. The job `stage` installs the root dependencies in a step that can get an OIDC token.
- `scripts/docs/searchIndex.test.ts` holds a copy of the two expressions with which `localSearchPlugin.ts` of VitePress splits a page into sections. When you change the version of `vitepress`, compare the copy with that file. When they differ, change the copy and the headings that `apiReferenceSearchHtml` writes.
- `docs/.vitepress/viteFollowSource.ts` needs VitePress to send new page data to the browser when the development server transforms a page. When you change the version of `vitepress`, run `pnpm docs:dev`. Open a component page. In `packages/vue/src`, edit a JSDoc description that appears in its API reference. The open page must show the new text.
- `vitepress` has a pnpm patch in `patches`. It corrects two faults of the search box in `VPLocalSearchBox.vue`.
- Without the patch, the focus goes to `body` when the box closes with Escape, with a click on the backdrop or with the Back key of the browser. The box puts the focus in the search field before its focus trap starts. The trap thus stores that field as the element to return to, and the field is gone when the box closes.
- Without the patch, the Tab key of some browsers moves the focus out of the open box when the box has results. The trap moves the focus only at its first and last element, and the browser moves it between them. A browser that skips a result link does not get to the last element. On macOS, WebKit skips a link, and it skips a button without full keyboard access. Firefox skips a link when its preference `accessibility.tabfocus` does not include the value 4. [Where a test runs](#where-a-test-runs) describes the Tab key of WebKit on macOS.
- The patch lets the trap put the focus in the field. It stops the return of the focus when the router opens a result, because the router puts the focus on the heading.
- The patch moves the focus for each Tab key and each Shift+Tab key that the trap does not handle. It uses the order of the visible, enabled buttons, the search field and the result links in the document. When the focus returns to the search field, the patch selects its text, as the Tab key of a browser does.
- The patch leaves a Tab key with Alt, Control or Meta to the browser. It also leaves a Tab key in a composition to the input method.
- When a release of `vitepress` has the corrections, run `pnpm patch-remove vitepress@2.0.0-alpha.21`. Then install that release. `pnpm docs:search-focus` fails when the release lacks the corrections. For a release without the corrections, make the patch again.
- `postcss` in `docs/package.json` has the version that Vite uses. `pnpm why postcss -r` shows it. The workspace then has one copy, and the tests of the site plugins run the PostCSS of the build. Change the version when Vite uses another one.
- `tailwindcss` and `@tailwindcss/vite` have the same exact version. The plugin depends on that exact version of `tailwindcss`, so another version in `docs/package.json` installs a second copy. `packages/vue/package.json` has the plugin too, because `vitest.config.ts` loads it. The job `stage` installs `packages/vue`, so it also installs the plugin, in a step that can get an OIDC token. No package of the plugin tree has an install script.
- `docs/demos/tailwind.css` nests the import of `tailwindcss/preflight.css` and `@tailwind utilities` in a style rule. The Tailwind documentation does not describe that form. The style sheet case of `packages/vue/test/demos.test.tsx` fails when a release of `tailwindcss` drops it.
- The test `scripts/docs/demoClassRules.test.ts` calls `compile` of `tailwindcss`, and it fails when a release changes that function.
- The test `scripts/docs/socialPreview.test.ts` calls `build` of `vitepress` with the options `mpa` and `onAfterConfigResolve`, and it fails when a release changes them.
- The workspace denies the install script of `esbuild` with the `allowBuilds` entry `esbuild: false`. The release job `stage` also installs `esbuild`, as an optional peer of `vite` in `packages/vue`. That job can get an OIDC token.
- The workspace also denies the install script of `vue-demi` with the entry `vue-demi: false`. `@tanstack/vue-form` of the docs depends on `vue-demi` through `@tanstack/vue-store`. The script only selects the build for Vue 2 or for Vue 3, and the package ships the build for Vue 3.
- The lowest version of Vue that the package supports is 3.5.12. Before that version, `useId` can give different ids on the server and in the browser below a component that has `onServerPrefetch` ([vuejs/core#12128](https://github.com/vuejs/core/pull/12128)).
- The CI jobs that start a browser run in the image `mcr.microsoft.com/playwright`, which has the browsers of one Playwright version. When you change the version of `playwright`, change the tag of each image in `.github/workflows/ci.yml`. `pnpm test:repo` fails when a tag has another version.
- When you change the version of `vitest`, search the `dist` folder of the new version for `VITEST_CHROMIUM_GC_DISK_THRESHOLD_GB`. When the new version does not read the variable, find another way to collect the garbage of Chromium after each test file. [Where a test runs](#where-a-test-runs) gives the reason.
- When a release of `vitest` keeps the modules in the cache of the browser ([vitest-dev/vitest#11914](https://github.com/vitest-dev/vitest/pull/11914)), delete the variable from `.github/workflows/ci.yml`.
- `segmentLayout.node.test.ts` makes the layouts of `my`, `ksh` and `sc` in a child process of the Node.js that runs Vitest. When `.node-version` names a release with the correction of [nodejs/node#67076](https://github.com/nodejs/node/issues/67076), `my` gets the order and the Japanese era names of its own format. Both cases of the file then fail. Change the cases, the section "Servers" of `docs/handbook/dates-and-times.md` and the section "Server render" of `docs/components/date-field.md`.
- Keep the check of `getSegmentLayout` after that change. Firefox and WebKit have no `year` in `resolvedOptions()` for these formats either. Without the check, the case `shows a year segment` of `DateFieldInput.test.tsx` fails in WebKit.

## Pull requests

- Make one change in each pull request.
- Write the title as a Conventional Commit, with the family folder as the scope: `feat(separator): add Separator`.
- GitHub squashes each pull request, and the title becomes the commit on `main`.
- The job `pr-title` of CI fails when the title is not a Conventional Commit. It does not compare the scope with a family folder. After a change of the title, run the job again.
- Write the body in three parts: Why, What and Tests.
- The check `required` must pass.
- On a pull request, CI runs only the test files that the changed files can affect. [Where a test runs](#where-a-test-runs) gives the rules.
- A pull request merges through the merge queue, which runs each check and each test file on the pull request on top of `main`.
- When the checks pass, `main` moves to the commit that the merge queue tested. That commit thus has the checks of the merge queue.
- A push to `main` starts no CI run. A commit that goes to `main` without the merge queue thus has no CI run.

## Source of the port

- `parity/upstream.json` records the Base UI commit that Vase UI tracks.
- `parity/scope.json` lists what Vase UI does not port, each with its reason. It also lists the Base UI paths that are out of scope.
- An `outOfScope` rule can have the key `except`. Its globs name the paths below `paths` that stay in scope.
- Add an `except` glob only for a path that a family ports or will port.
- A `notPorted` row names its files as globs in `upstream`. An entry with a line range, such as `packages/react/package.json:74-108`, matches no file.
- Each Base UI file that [Layout and names](#layout-and-names) maps is in the `upstreamPaths` of a family, or a `notPorted` row names it. A file is in no family only where Vase UI ports nothing of its folder, or where the repository cannot hold its counterpart.
- Where one family holds each file directly in a folder, name those files with one glob, such as `packages/react/src/internals/*`. A new Base UI file in that folder is then in the family.
- For the docs, an `except` glob names the page folders of a group: `docs/src/app/(docs)/react/components/*/**`.
- Do not name the group folder. Its `page.mdx` is an index that Base UI generates from the pages, and no family ports it.
- Port from Base UI at the tracked commit.
- The other sources are the code and documentation of Vue, the web standards, and the libraries that Vase UI depends on.
- A ported file keeps the "Modified" or `@see` comment of its upstream file.
- A ported file also keeps the "License:" comment of its upstream file. `THIRD_PARTY_NOTICES.md` has an entry for each project that such a comment names, with the copyright notice and the license of that project.

Each family has a file `parity/families/<family>.json`. `pnpm parity:check` requires the six keys in this table.

| Key | Content |
| --- | --- |
| `upstreamPaths` | The Base UI paths that the family ports, as globs. A family with a docs folder also names that folder: `docs/src/app/(docs)/react/components/<family>/**`, or `docs/src/app/(docs)/react/utils/<family>/**`. |
| `matchedCommit` | The Base UI commit that the family matches. |
| `exceptions` | The exception rows of the family. See [Exception rows](#exception-rows). |
| `surfaceAdditions` | The props, emits, slots, exposed members, change reasons, state fields and constants that Base UI lacks, each with its reason. |
| `returnTypeDifferences` | The functions that return a different type from the type that Base UI documents, each with the Vase UI type and the reason. |
| `notApplicableCommits` | The Base UI commits that touch these paths and do not apply to Vue, each with its reason. |

- Record each relocated upstream file once in the owning family's optional `relocations` list. Give its exact `upstream` path, `relation` (`merged-into`, `inlined-into` or `moved-test`), `destination`, retained `member` or `behavior`, and `witness` test path. For a split, name every destination, including any file kept at its default path. Put the other `destination` and `member` pairs in `additional`.
- A `surfaceAdditions` row names one member of one part: `{ "entry": "Button", "prop": "disabled", "reason": "…" }`.
- `entry` is the title of the part in the `types.md`. The key of the member is `prop`, `emit`, `slot` or `exposed`.
- A row can name one change reason instead: `{ "entry": "Root", "changeEventReason": "none", "reason": "…" }`. It accepts a reason that the `ChangeEventReason` type of the part has and Base UI lacks. `pnpm parity:check` reports the row as stale when Base UI has that reason, or when the type does not have it.
- A row can name one state field: `{ "entry": "Trigger", "stateField": "disabled", "reason": "…" }`.
- A row can name one constant: `{ "entry": "TooltipTriggerDataAttributes", "constant": "disabled", "reason": "…" }`. Its `entry` is the name of the export that holds the constant.
- These rows accept only the named member. A row is stale when Base UI has the member, or Vase UI lacks it.
- A `types.md` has no row for a native attribute that the React part reads, such as `disabled` of Button. The prop of the Vase UI part then needs a `surfaceAdditions` row.
- A `types.md` can also have a prop row for a native attribute that the React part does not read. An example is `aria-valuetext` of `Progress.Root`. Do not declare that prop: the attribute goes to the element through `$attrs`, with its type from `HTMLAttributes`. Give the row a `not-applicable` exception row. The part can give such an attribute a default, as `NumberField.Input` does for `aria-roledescription`. The part sets the default before the attributes of the consumer, so the attribute of the consumer wins.
- The extract reads the rows of the surface only from the `types.md` of the docs folder. Without that folder, `pnpm parity:check` does not compare the props, emits, slots, exposed members and return types of the family.
- A family also names the folder of its context, where upstream has that folder under `internals`: `packages/react/src/internals/direction-context/**`. `pnpm parity:check` then checks the files of the context as part of the family that provides it.

Each family also has an extract, `parity/families/<family>.upstream.json`. It holds the facts of Base UI at `matchedCommit`: the source files, the type tests, the test cases and the rows of each `types.md`.

- `pnpm parity:extract` writes the extract. Do not edit it.

A Base UI commit that changes a path of a family is queued for the family while `matchedCommit` is older than the commit. The parity page shows this state. To mirror a queued commit in a family:

1. Port the changes of the commit to the source and the tests at the mapped paths.
2. Set `matchedCommit` to the newest commit of `parity/upstream.json` at which the family matches Base UI.
3. Run `pnpm parity:extract` for the family.
4. Run `pnpm docs:demos` for a family that has a page or a demo folder.

## Components that Base UI does not have

Vase UI can add a component that Base UI does not have. This is a component of Vase UI's own. It is not a family: it has no family file, no extract and no exception row. It has one record, `parity/own/<name>.json`. `pnpm parity:check` refuses a record that lacks a required key or has another key:

| Key | Content |
| --- | --- |
| `standard` | The links to the standards that the behavior follows, such as a pattern of the WAI-ARIA Authoring Practices Guide. Each link starts with `https://`. |
| `reason` | Why Vase UI has the component. |
| `parts` | The titles of the parts, in the sequence of the API reference, such as `Root`. Each title is a component that the entry point exports. A record needs `parts` or `functions`. |
| `functions` | Optional. The titles of the functions and classes that the entry point exports, such as `createHandle`. |
| `types` | Optional. The paths of the types that the entry point exports, such as `useRender.Parameters`. |

A utility of Vase UI's own has the same record, with `functions` and no `parts`.

- The component is not a port, so no file of Base UI is its source. The sources are the standards in `standard`, the code and documentation of Vue, and the libraries that Vase UI depends on.
- The API follows the [API convention](#api-convention), as in each other component. The entry point exports the four things of [Entry points](#entry-points).
- Add the record in the pull request that adds the `index.ts` of the component.

## Layout and names

| Base UI                       | Vase UI                     |
| ----------------------------- | --------------------------- |
| `packages/react/src/<folder>` | `packages/vue/src/<folder>` |
| `packages/utils/src`          | `packages/vue/src/common`   |
| `packages/react/test`         | `packages/vue/test`         |

- Keep upstream part names. At default paths, keep upstream folder and file names. Use the Vase UI form of the library name in every part name and path.
- A file's mapped paths come from its relocation row or, by default, from the table above. The counterpart of a `.ts` or `.tsx` file can be a `.ts`, `.tsx` or `.vue` file. The counterpart of a test or a type test must be a `.ts` or `.tsx` file.
- The counterpart of an upstream folder is the folder at the mapped path.
- `pnpm parity:check` maps `useBaseUiId.ts` to `useVaseUiId.ts` and `createBaseUIEventDetails.ts` to `createVaseUIEventDetails.ts`. The rule also applies to paths under `docs/demos`.
- The vocabulary is that of upstream's `GLOSSARY.md`: Popup, Root, Trigger, Anchor, Positioner.
- A family is one upstream folder.
- State attributes (`data-open`) and CSS variables keep upstream's names and values. Upstream CSS then works with no change.
- A family that Base UI does not have names a state attribute with `data-` and the name of the state in kebab case: `data-dragging`. It names a CSS variable with `--`, the family, the part and the value, in kebab case: `--resizable-panel-size`.
- The default of `getStateAttributesProps` writes `data-` and the lower case of the state key. A state with more than one word in its key, such as `atMin`, gets a `stateAttributesMapping` entry that writes `data-at-min`.
- Internal names change `base-ui` to `vase-ui`: `data-vase-ui-*`, `event.preventVaseUIHandler()`, `VASE_UI_ANIMATIONS_DISABLED`, `new Event('vase-ui')`, the class `vase-ui-disable-scrollbar`.
- A page can then hold the two libraries, and they do not share markers.
- Messages start with `Vase UI:`.

## Entry points

The package is `@vase-ui/vue`. It is ESM only.

- Each upstream folder that has a package export is one entry point with the same name: `@vase-ui/vue/dialog`, `@vase-ui/vue/merge-props`, `@vase-ui/vue/use-render`.
- A component of Vase UI's own has no upstream folder. Its entry point has the name of its record in `parity/own`.
- `@vase-ui/vue` is a barrel of the entry points.
- A folder `packages/vue/src/<name>` that has an `index.ts` file is an entry point.
- No list names the entry points. `package.json` has the one pattern `./*`. The build and `pnpm typecheck` write the barrel `src/index.ts`. Do not commit the barrel.
- `internals`, `utils` and `common` are not entry points.
- A folder with a name that starts with `unstable-` is an entry point, but the barrel does not include it.
- A folder whose `index.ts` starts with the Temporal reference line, `/// <reference lib="esnext.temporal" preserve="true" />`, is an entry point, but the barrel does not include it. Its declarations name `Temporal` types, so a consumer needs TypeScript 6.0, or `skipLibCheck`.

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

A family can land in more than one pull request. Its `index.ts` then comes with the last part of the family, or in a later pull request, so the package exports nothing of the family before then. The exception is an entry point that a demo of another family imports. That `index.ts` comes with the last part that the demo renders, as in Slider. The tests of the pull requests before the `index.ts` import `../index.parts`.

A part that Base UI takes from another family is exported again and not copied: `export { Separator } from '../separator'` in `index.parts.ts`. `index.ts` exports the component, the props type, the state type and the data attributes of that part under the prefix of the family: `OTPFieldSeparator`, `OTPFieldSeparatorProps`, `OTPFieldSeparatorState` and `OTPFieldSeparatorDataAttributes`. `pnpm parity:check` needs the last two, because the `types.md` of the family names them.

## API convention

### Parts that render an element

| API | Function | Base UI form |
| --- | --- | --- |
| `as` prop: a tag, or a component. The default is upstream's tag. | Sets the element or the component that the part renders. | `render={<a />}` |
| `#render` slot with the slot props `{ props, state }` | Replaces the element. Bind `props` on your element: `<a v-bind="props">`. | `render={(props, state) => …}` |
| Default slot with the slot props `{ state }` | Holds the content. | `children` |
| `class` and `style` attributes | The part merges them with its own class and style. The class of the consumer comes first. The style of the consumer wins over the ordinary style of the part. | `className`, `style` |
| `nativeButton` prop, where upstream has it | The same as upstream. | `nativeButton` |
| Exposed `element` | Gives the DOM element through a template ref. | `ref` |

- `docs/handbook/composition.md` gives the rules of the `#render` slot for a consumer. A development build shows a warning for a slot that gives the part no element, and for `as` together with `#render`. `useRenderElement` makes these checks.
- A disabled `Fieldset.Root` passes `disabled: true` to its render slot or component, including a component selected by name. A tag gets an empty `disabled` attribute.
- Select a state with its `data-*` attribute in CSS. To calculate a class or style from state, bind it on the element in the `#render` slot.
- A part whose declarations must win over the `style` attribute gives them to `useRenderElement` as `overridingStyle`. `Collapsible.Panel` does this. See [What differs from the React source](#what-differs-from-the-react-source).
- Each part that renders an element sets `defineOptions({ inheritAttrs: false })`. Each attribute and listener goes to the element through `mergeProps`.
- An attribute with the value `undefined` is not given. The part keeps its own value, as Vue keeps the default of a declared prop. `null` removes the value of the part (`VUE-103`).
- An `aria-label` or an `aria-labelledby` that is blank is not given: an empty string, or a string of white space only. Such a value names nothing, so the part keeps its own value (`VUE-106`). In Base UI, the blank value replaces the value of the part.
- An ID reference attribute that is blank is not given either: `aria-activedescendant`, `aria-controls`, `aria-describedby`, `aria-details`, `aria-errormessage`, `aria-flowto`, `aria-owns` or `for`. Such a value refers to no element, so the part keeps its own value (`VUE-110`). In Base UI, the blank value replaces the value of the part. A blank `form` attribute stays, because HTML gives it a meaning: the control then has no form owner.
- The exported props interface of a part extends `VaseUIComponentProps<State>`. That interface declares `as`.
- The interface also extends the attributes of its default tag through `/* @vue-ignore */`: `interface SeparatorProps extends VaseUIComponentProps<SeparatorState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes>`.
- `WithVaseUIEvent` adds `preventVaseUIHandler()` to the event that each native listener gets.
- `WithVaseUIEvent` adds `null` to the type of each attribute that is not a listener. Vue types an attribute with no `null`, so without it vue-tsc refuses `:aria-hidden="null"` on a part.
- A part that types an attribute in an interface of its own adds `null` to that type: `autocomplete?: string | null | undefined` of `Combobox.Input`.
- Name each attribute that reaches a declared prop in the second type argument: `WithVaseUIEvent<HTMLAttributes, 'aria-label'>`. The type adds no `null` to such an attribute, because Vue gives its value to the prop, and such a prop takes no `null`.
- TSX and templates then accept the native attributes and listeners, with their types.
- `WithVaseUIEvent` leaves out the key `as`. The part declares `as` itself, and a library can add another `as` to the attributes of each element. `motion-v` does this. Without the omit, TypeScript reports TS2320 for the props interface of each part.
- `WithVaseUIEvent` adds the attribute `aria-description`. WAI-ARIA 1.3 defines it for each element, and the types of Vue do not list it. Without the key, `<Combobox.Chip aria-description="…">` fails the type check of a consumer that sets `strictTemplates`. Do not add the key to the types of Vue with a module augmentation. That changes the type of each element in the project of the consumer.
- The SFC compiler ignores the extended type, so the run-time props are only the declared props. A native attribute stays in `$attrs`.
- Omit a native attribute that the part declares as a prop with the same key: `Omit<ButtonHTMLAttributes, 'disabled'>`. Do not omit an `aria-*` attribute. See [Props](#props).
- A consumer handler runs before the handler of the part. `event.preventVaseUIHandler()` stops the handler of the part. The exception is a native event that the part declares as an emit. See [Other callbacks](#other-callbacks).
- There is no `asChild` prop, and no part clones a vnode.
- These native button parts read `useFieldsetDisabled` with their own element (`VUE-112`): `Button`, `Toggle`, `Accordion.Trigger`, `Collapsible.Trigger`, `Tabs.Tab`, and the triggers of Dialog, Menu, Popover and Navigation Menu. The triggers of Alert Dialog, Drawer, Date Picker, Date Range Picker and Time Picker render one of them. A fieldset disables such a part only while its `nativeButton` prop is `true`, because a browser disables only a form control. The part is then disabled as by its `disabled` prop. It has `data-disabled` and the `disabled` slot state, `useButton` stops its handlers, and a hover does not open its popup. `Tabs.Tab` gives only its `disabled` prop to the metadata that the root reads for the selection, so a disabled fieldset does not change the selected panel.
- `Tooltip.Trigger` checks whether its element is a native button, because it has no `nativeButton` prop. Before the mount it has no element. It is then a native button when `as` is `button` and it has no `#render` slot, so the server HTML follows `Fieldset.Root`. A fieldset that disables that button adds `data-disabled` and the `disabled` slot state, and prevents a tooltip open on hover or focus. The `disabled` prop still suppresses only the tooltip. The attribute `data-trigger-disabled` describes that suppression from a prop, the root, or a fieldset.

The template of each such part has the `#render` slot, then the element, and no wrapper component:

```vue
<slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
<component :is="as" v-else v-bind="elementProps()" :ref="setRef">
  <slot :state="state" />
</component>
```

- `elementProps` is a function that the template calls. It is not a `computed`.
- Call `usesRenderSlot()` of `useRenderElement` as the last condition of the `v-if` of a `#render` slot that gets `elementProps()`. It tells whether the consumer gave the slot, and in a development build it marks that the part renders the slot. A slot of a part compiled as a Vapor component reads `props` only when it uses `props`. A slot that uses no prop thus never calls `elementProps()`. ESLint refuses a `#render` slot that gets `elementProps()` without the call.
- Bind `setRef` of `useRenderElement` by name beside the spread, because [Vapor mode applies a `ref` only when the template binds it by name](https://github.com/vuejs/core/pull/15900). Vapor mode ignores the `ref` key of a bound object. ESLint refuses a spread of `elementProps()` without `:ref`.
- When the element with its content exceeds 100 columns on one line, put the content on its own line. Vue removes white space between a tag and an element or a slot, so the render code stays the same. Prettier keeps this form. In the one-line form, Prettier breaks the line in the tags.
- Keep text content, such as `{{ text }}`, on the line of its tag. White space beside text stays in the text.
- When the attributes start empty, a spread reads no key. A `computed` then does not see an attribute that comes later.
- The render function runs again on each change of the attributes.
- A part with a void default tag (`img`, `input`) has no default slot.
- A part whose default tag depends on its context, such as `NavigationMenu.Root`, has no default for `as`.
- It decides the tag one time in `setup`. It gives the tag to `useRenderElement` as the first argument.
- Its template binds `:is="as ?? defaultTag"` on the element.
- Base UI documents the default tag. When the family has an entry point, the family file needs a `not-applicable` exception row for the prop row `render`.
- A part that renders its element only in some states puts the condition in both forms: `<slot v-if="shouldRender && usesRenderSlot()" name="render" … />`, then `<component :is="as" v-else-if="shouldRender" … >`. Put a condition that has `||` in parentheses in the first form. The part then renders one comment while it has no element.
- Do not put the two forms in a `<template v-if>`. The root of the part is then a fragment. Vue gives the scope id of a consumer, `v-show`, a custom directive and `<Transition>` only to a root element. ESLint refuses this form.
- `Tabs.Indicator` with `renderBeforeHydration` is the exception. The script of Base UI reads the indicator as the element before it. Thus one form of the template has the element and the script. The form with only the element comes last.
- When a `<template v-if>` holds another node beside the `#render` slot, end that `v-if` with `usesRenderSlot()`. The slot inside it has no `v-if`. `Select.Positioner` and `Tabs.Indicator` are the examples.
- `describeConformance` asserts that a rule of `<style scoped>` of a consumer matches the element of the part. Give `elementIsRoot: false` only for a part with a hidden input or with its element in a `Teleport`. The suite then asserts that the rule does not match.
- A provider whose only output is its children renders `<slot />`. It does not set `inheritAttrs`. Vue then shows a warning in a development build when the part gets an attribute or a listener. With `inheritAttrs: false`, Vue drops them and shows nothing.

A part that Base UI writes as another part renders that part and no element of its own. `Toolbar.Separator` and `Input` are the examples:

- Set `inheritAttrs: false`. Bind `{ ...withoutPropsOf($attrs, InnerPart), ...props }` on `InnerPart`. Vue gives an attribute to a declared prop of the inner part when their names match after camelization. The filter drops that attribute, so it sets no prop and reaches no element. To accept a prop of the inner part, declare it on the wrapper. For example, `Input` declares `id`, `name` and `disabled`.
- ESLint refuses `$attrs` on a component tag outside a call of `withoutPropsOf`. `src/internals/withoutPropsOf.coverage.node.test.ts` checks three rules in each SFC. A part tag with an object `v-bind` has `withoutPropsOf($attrs, <that tag>)` in the bound expression. When each root node of a template is a part tag, each root has such a `v-bind`. A part with such a `v-bind` or such roots sets `inheritAttrs: false`.
- Give the `#render` slot to that part, and the default slot when the part has one. A slot does not reach a child unless the template gives it.
- Write the template in two forms, one for `#render` and one for the content. The first form has `v-if="$slots.render"` and gives only the `#render` slot. The second form has `v-else` and gives only the default slot: `<template #default="slotProps"><slot v-bind="slotProps" /></template>`. The slot props come from that part. A part with a render condition adds it to both forms: `v-if="shouldRender && $slots.render"`, then `v-else-if="shouldRender"`. A part that has no default slot, such as `Input`, has no slot template in the second form.
- Do not write `v-if` on a slot template, as in `<template v-if="$slots.render" #render>`. It makes the slots of that part dynamic. Vue then renders that part again each time the part renders. Vue also renders again each part in that slot that has slot content. For a positioner, this includes the popup, the list and each item.
- If that part reads `$slots.default`, as `SelectScrollArrow` does, add a third form. The second form then has `v-else-if="$slots.default"`, and the third form has `v-else` and no slot. Without the third form, that part always gets a default slot, so it never shows its own content.
- Fallback content in the `<slot>` of that part needs no third form. Vue shows the fallback when the slot renders nothing. The check mark of `ItemIndicator.vue` is an example.
- `test/stableSlots.test.tsx` checks this rule. Add a fixture and a row to its `partsWithPopup` for each new part that has a popup below it.
- Declare the wrapper's public component events with `defineEmits`. Relay each declared event once with its original arguments, before the inner emit returns. For a cancelable change, the inner part then checks `details.isCanceled` before it requests the model update. Forward undeclared listeners to their intended element or component through the filtered attributes.
- Expose the `element` of that part.
- To add listeners, pass the filtered attributes from the template to the function that calls `mergeProps(listeners, givenAttributes(attributes))`. Use `useAttrs()` only to read an individual attribute. A listener of the consumer with the same key then runs first, and `event.preventVaseUIHandler()` stops the listener of the part. `Drawer.Viewport` does this for its swipe listeners (`VUE-58`). An attribute of the consumer that is not given keeps the value of the part.
- A part that removes an attribute of that part gives `null`. `Drawer.Viewport` removes `data-nested-dialog-open` of `Dialog.Viewport` in this way.

A root that Base UI writes as the root of another family renders that root. `ContextMenu.Root` renders `Menu.Root`:

- Set `inheritAttrs: false` on the wrapper root. Bind `withoutPropsOf($attrs, OtherRoot)` on `OtherRoot` before its named props. An attribute thus sets no prop that the wrapper root omits (`VUE-136`). The other root renders no element, so Vue still warns about another attribute, such as `class`, in a development build. The wrapper root has no `#render` slot.
- Its props interface extends an `Omit` of the props interface of the other root. The template binds each prop on the other root by name.
- The rule above for events applies to the events of the other root.
- It exposes the actions of the other root. Each exposed function calls the function of the same name on that root.

Base UI can also give a part of another family a new name and new types, such as `DrawerTitle = DialogTitle as DrawerTitle`. That part is then the part of the other family:

- Its file is a `.ts` file at the mapped path. It exports the SFC of the other part with the type `typeof` that SFC, and no wrapper component.
- Its props and state types are aliases of the types of the other part. Where the Base UI state type has fewer keys, the Vase UI state type omits the other keys: `AutocompleteItemState` is `Omit<ComboboxItemState, 'selected'>`.
- `Drawer.Title`, `Drawer.Description` and `Drawer.Close` are the examples.
- The exception is a part whose props have a text of their own in Base UI, such as `ContextMenu.Positioner`. That part is an SFC that renders the other part, as `Toolbar.Separator` does. Its props interface then holds the text of Base UI for those props.

A part whose new types change a prop is the exception. `AlertDialog.Trigger` is the example: its `handle` takes only a handle of Alert Dialog.

- The part is an SFC that renders the other part. It follows the rules above for a part that Base UI writes as another part.
- Its props interface extends an `Omit` of the props interface of the other part, and declares the changed prop.
- The API reference then shows the type and the text of the changed prop. For an alias of the other SFC, it shows the prop of the other part.

### Parts with nodes of their own

Some upstream parts put nodes of their own in the element. Examples are the range input of `Slider.Thumb` and the focus guards of `Toast.Viewport`.

- Put the extra nodes in an internal SFC. Meter and Progress share `RangeLabelChildren.vue` for their screen reader text.
- Inject any state the extra nodes need. `Field.Error` provides its message through `FieldErrorContext`.
- Use a named template ref for a node that only `<Part>Children.vue` needs. For a node shared with its parent, bind the parent's setter by name. `SliderThumbChildren.vue` passes the range input to its owner this way.
- It renders the nodes around its default slot, in upstream's order.
- A part that shows its default slot only in some states also has a `<Part>Children.vue`, such as `ComboboxEmptyChildren.vue`. That SFC renders the default slot only in those states. The `#render` slot then shows the content in the same states.
- The `#render` slot of the part gets a third slot prop, `children`, which is that component.
- A consumer writes `<a v-bind="props"><component :is="children">…</component></a>`.
- The part passes `children: true` to `useRenderElement`, and `<Part>Children.vue` calls `markChildrenMounted()` in setup. A development build then shows a warning when the `#render` slot does not mount `children`.
- A node of `<Part>Children.vue` that a consumer styles has a `data-vase-ui-*` attribute as its name, such as `data-vase-ui-resizable-edge` of `Resizable.Root`.
- The Viewport part of a popup family that calls `usePopupViewport` has no `<Part>Children.vue`. Its `children` is `utils/popups/viewport/PopupViewportChildren.vue`. `test/fixtures/PopupViewportPart.vue` is the model. `NavigationMenu.Viewport` does not call `usePopupViewport`. With no positioner, `NavigationMenuViewportChildren.vue` renders the two focus guards and the target element of the content. In a positioner, it renders only its default slot. The part then keeps the two focus guards before and after its element with `useElementSiblings`, so the part has one root node. See [Focus helpers](#focus-helpers).

<!-- prettier-ignore -->
```vue
<slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="SliderThumbChildren" />
<component :is="as" v-else v-bind="elementProps()" :ref="setRef">
  <SliderThumbChildren><slot :state="state" /></SliderThumbChildren>
</component>
```

A part whose own node is text, such as `Progress.Value`, has four more rules:

- `<Part>Children.vue` shows the default slot of the consumer when there is one. If there is none, it shows the text. Write the two as one `v-if` chain: `<slot v-if="$slots.default" … />`, then `<template v-else-if="…">{{ text }}</template>`.
- The part gives a default slot to `<Part>Children.vue` only when the consumer has one: `<template v-if="$slots.default" #default="content"><slot v-bind="content" :state="state" /></template>`.
- Do not write an interpolation that can be empty. Do not render a `<slot>` that the consumer did not give. A client-only render then leaves empty text nodes in the element, and `toBeEmptyDOMElement` fails. A `v-if` chain that renders nothing leaves one comment, and the matcher ignores a comment.
- Give `describeConformance` no `childrenSelector` for such a part, because a selector cannot match a text node. Add a case that mounts `children` in the `#render` slot and compares the text.

A part of a component that Base UI does not have, whose own node is text, has no `<Part>Children.vue`. Its default slot and its `#render` slot get the text as the slot prop `text`. The text is the content of the part when the consumer gives no default slot. `Calendar.Weekday` is the model. `Calendar.Caption`, `Calendar.WeekNumber`, `Calendar.DayButton`, `Calendar.MonthCell`, `Calendar.YearCell`, `Calendar.ViewTrigger`, `RangeCalendar.DayButton`, `TimePicker.Item` and `TimePicker.ColumnItem` follow this rule.

A part of a component that Base UI does not have follows the same rules for its other nodes. `Calendar.MonthSelect` and `Calendar.YearSelect` have a `<Part>Children.vue` for their `option` nodes. The part provides the options in `CalendarSelectContext`.

### Parts with a hidden input

Some upstream parts render a hidden `<input>` beside their element. `Switch.Root` is the model. The input gives the part the form behavior of a native control.

- The part has more than one root node: its element, then its inputs. The inputs are not in the element. An `<input>` in a `<button>` is not valid HTML, and a `#render` slot would have to mount the inputs.
- The template has the `#render` slot and the element of a part. The inputs come after them.
- For a hidden input with a props spread, put its named ref or its bound setter beside the spread. Vapor ignores a ref inside a bound object. ESLint checks this form. Use a setter when a field needs the input during the patch. On mount, Vue can assign a named ref after the other inputs register.
- `handleHiddenInputInvalid` grows an input with no `name` to 1px with `min-width` and `min-height`. The style of a hidden input has neither key.
- A part with more than one root node gets no scope id from the component that renders it. A rule of `<style scoped>` thus does not match the element of the part, and `v-show` on the part has no effect. The JSDoc of the part says this. It names `:deep()`, a CSS module, a `style` binding and `v-if`.
- A part that keeps its focus guards beside its element with `useElementSiblings`, such as a trigger or a popup part, has one root node. See [Focus helpers](#focus-helpers).
- `Combobox.Input` keeps its dismiss button before its element with `useElementSiblings`, so it has one root node. Its `#render` slot gets the element only.
- `Combobox.Popup` gives its dismiss button to its focus manager, which keeps it after the element and before the last inside guard.
- A part that is its own control declares `aria-label` and `aria-labelledby` as props, because `useAriaLabelledBy` watches them. Each prop gets a `surfaceAdditions` row. A root whose control is another part, such as `NumberField.Root`, declares neither. `OTPField.Root` declares `aria-labelledby` only, because the root of Base UI reads no `aria-label`. [Props](#props) gives the form of each prop.
- A part that sends the click of its element to its input calls `forwardClickToInput` of `src/internals`. `Checkbox.Root`, `Switch.Root` and `Radio.Root` do this. The function sends the click only when the input has a parent node. A part compiled as a Vapor component sets the `ref` of the input before it inserts the input. A click in a `ref` callback of the element thus changes nothing, as in Base UI. A click in the `onMounted` hook of a child changes the state. Do not use `isConnected` for this test, because it is `false` in an app that mounts in an element outside the document.
- Bind the checked state with `checkedInputProps` of `src/internals`. Bind `indeterminate` after mount because HTML has no attribute for it. Vue skips an equal `checked` or `indeterminate` binding after a native click. `restoreChecked` writes each property only when the input differs from the model. Before the first write, compare `checked` with `defaultChecked` to detect a click from before hydration. A radio group reads its inputs together before a write can uncheck a peer.
- A root gives its input a `value` binding after `useHiddenValueBeforeHydration` allows it. In a number field, an edit in the visible input that changes the model during hydration also supplies the new value to the hidden input.
- A part takes the state of its input into its model, with its change events one time, when the input changed with no event that the part handled. A press on a native label before the hydration does this. A form state that the browser restores after a move in the history or a reload does this too.
- The part takes the input at two moments. At the hydration, the input differs from its server HTML. At a `pageshow` event that does not come from the back/forward cache, the input differs from the value that the part handled.
- Firefox and WebKit restore the form state of a page during the parse, before the scripts run. Chromium restores it in a task after the parse or right after `load`, the earlier of the two, and always before `pageshow`. An app that mounts in its entry module, as `create-vue` makes it, is thus mounted before Chromium restores the inputs.
- `useFormRestore(input, onRestore)` of `src/internals` calls the part at the page show or the next activation. `useFormRestoreAsInput` sends the restored text through the control's native `input` event. At a take with no event, `Checkbox.Root`, `Switch.Root` and `RadioGroup` give the event `vase-ui` in the details of the change.
- While the part waits for the page show, its binding keeps the live text through an unrelated render. A new model or a request to restore a refused edit gives the binding the model value again. Vue also sets the value attribute when it binds the live text of an input. After that render, the part puts the model value back in `defaultValue` so a native form reset still uses it.
- The take of one part at `pageshow` can render a later part before the listener of that part runs. The flag of each part stays set until its own listener, so the later part keeps its restored value.
- Compare the restored text with the model after the input type's value sanitization. An uncontrolled `Field.Control` or `Toolbar.Input` keeps the text of its last `input` event for this comparison. Before the first edit and after a native reset, it uses the input's default value.
- A text input also removes CR and LF from the value that the form gets. `Select.Root`, `useAriaCombobox` and `Combobox.Input` thus call `useFormEntryValue(input, getValue)` of `src/internals`. The form then gets the value of the part, as it gets the value of the option of a `<select>` (`VUE-102`). The JSDoc and the comments of the composable say how it finds the entry of the input.
- A part keeps the name on its text input. Chromium and WebKit restore a state only into a control with the same name and type. With a name that moves to a `type="hidden"` input for some values, two pages can give the name to inputs of two types. The restore is then lost.
- `Select.Root`, `useAriaCombobox`, `RadioGroup` and `Slider.Root` each have a take of their own. The comments at each take give its rules. The JSDoc of `queueInputTake` gives the sequence of the takes of the hydration.
- A `type="hidden"` input takes nothing, because a restore or a script write also changes its `value` attribute. The part keeps its model.
- The hidden input of a root takes its turn after the visible controls in the hydration queue.
- The hidden input of a date or time field has the type of its value: `date`, `datetime-local` or `time`. Its `min` and `max` give `rangeUnderflow` and `rangeOverflow` to the field, and `required` gives `valueMissing`.
- A zoned value and a year and month have `type="text"`. Of the three test engines, only Chromium has `type="month"`, and no engine has an input for a zoned value.
- The root sets a `customError` on the input for what the type cannot check: the range of a zoned value and of a year and month, `minTime` and `maxTime` for a value that has a date, a date that `unavailableDates` matches, and a field with some segments empty. Each error ends when its cause ends.
- The text of the input is ISO 8601 in the ISO calendar. A zoned value has the RFC 9557 text, such as `2026-11-14T15:04+09:00[Asia/Tokyo]`. A year and month of a calendar that has other months than ISO names that calendar.
- The input of a control with no native input, such as `Select.Root`, has the type that `getHiddenInputType` of `src/internals` gives. Its JSDoc says when the type is `hidden`.
- For a change that a listener cancels, the part calls `preventDefault` on the click of the input. The browser then puts the old state back.
- In a group with one input for each item, each item writes its state to its input after each change that no listener cancels. A browser unchecks the other inputs of a named group when one input gets checked. A parent that controls the group can also keep the old value.
- A control whose field can have more than one input calls `useInputRegistration(input, register)` of `src/internals/field-register-control` in `setup`. The `ref` setter of the input writes `input`. `register` registers the input with `validation.registerInput`, and `Radio.Root` also registers it with its group. `register` returns a function that ends these registrations. The composable calls that function when the input changes or goes away. The control does not write `validation.inputRef`.
- Such a field takes the first invalid input in the document, or else the first input in the document. It skips a disabled input and an input of another form. The field reads the validity of that input, and the form focuses the part of that input. `RadioGroup` exposes the checked input when that input is enabled, or else the first enabled input in the document, or else `null` (`VUE-101`). An enabled input does not match `:disabled`. In a disabled `<fieldset>`, only an input in its first `<legend>` counts. A keyed move runs no registration, and a radio follows a change of a native `<fieldset>` only after its observer calls back. The group thus finds that input at each read of `inputElement`. The order of the registrations decides only between inputs in two trees, such as two shadow roots. Base UI takes the first registration (`VUE-78`).
- A disabled fieldset disables a form part as its `disabled` prop does (`VUE-112`): `Fieldset.Root` with `disabled`, also with no `Field.Root`, and a native `<fieldset disabled>` as HTML disables a form control. A root calls `useFieldsetDisabled` of `fieldset/root` with its element. A root that renders no element gives its hidden input. `DatePicker.Root`, `DateRangePicker.Root` and `TimePicker.Root` give their first field element in document order. A range picker uses its start field. With no such field, each picker gives its first trigger in document order. A part in a group or a field, such as `Radio.Root`, reads the fieldset itself. A fieldset in the group or the field can hold that part alone. The other parts follow their root. The JSDoc and the comments of the composable give the rest.
- Use `useFieldControl` to register a control and get its native input name. Bind that name to the input. A part that supplies the field's native validation input can also pass its ref as `input`. With separate owners, give the field its input through `useFieldInput`. [What differs from the React source](#what-differs-from-the-react-source) gives the rules.
- A part that gives no value to the form, such as the parent checkbox of a group, has no name on its input and does not register the input with the field.
- `KeepAlive` takes the input out of the document and calls no `ref` setter. `useInputRegistration` registers no input while `KeepAlive` holds the control, and it releases a registered input at the hold. It registers the input at each activation. The field then does not validate an input that the user cannot reach. `Checkbox.Root`, `Radio.Root` and `useDateTimeFieldRoot` call it.
- The part calls `useFormReset(input, onReset)` of `src/internals` in `setup`. A ref or getter can already point to the input at mount. The composable listens to `reset` on the root node of the input, because the form of the input can change. The listener follows the input to another root node. While `KeepAlive` holds the part, it listens on the form of the input. A form in the held branch moves with the input. A leave transition keeps the input in the document until the transition ends, and no hook runs at that end. A root node that the composable reads at the deactivation can thus be the document. The composable keeps a reset that waits when `KeepAlive` hides and shows the part. It ignores an event whose target is not the form of the input when the event arrives. Each reset has its own 0 ms timeout. After the event listeners run, the composable calls `onReset` for each event that they allowed. In `onReset`, an uncontrolled part goes back to its default value through its change event, with the `reset` event in `details`. A controlled part does not change. After each reset that the part follows, the part clears the error of its field with `useClearFieldError`, also when its value does not change. The change of a reset starts no validation.
- With `selectionMode: 'none'`, `useAriaCombobox` gives the default text to the root at each reset that it follows, also when the input shows that text. The input can show an inline completion. `Autocomplete.Root` thus compares the default text with its typed text.
- A root that clears its reset flag in the callback of `useValueChanged` sets the flag only when the reset changes the value that the callback watches. `useValueChanged` calls no callback for a value that stays, and a flag that stays set skips the validation of the next change. `Slider.Root` and `useDateTimeFieldRoot` compare that value before and after the reset. With `selectionMode: 'none'`, `useAriaCombobox` compares the text of the input before and after the reset. A date or time field root below a picker gets the value of a reset with the next render, so it sets the flag when the picker counts the reset. It compares the value after that flush, and it clears the flag when the value stayed.
- A part that has one input for each item, such as `RadioGroup`, `CheckboxGroup` and `Slider.Root`, does not call `useFormReset` itself. The input that `RadioGroup` exposes changes with the value, and it can be absent. `CheckboxGroup` exposes no input. The composite list of `Slider.Root` has no thumb while `KeepAlive` holds the slider. `useFormReset` also drops a reset that waits when its input changes. Each item thus calls `useFormReset` with its own input. The part handles the first call for each `reset` event.
- `CheckboxGroup` follows the reset of each form that has an input of one of its items. An uncontrolled item whose state the group does not hold goes back to its default value through its own change event. A checkbox with no `value`, and with no `name` of its own or of its field, is such an item. The group clears the error of the field, so such an item does not. When an uncontrolled group goes back to its default value, its parent checkbox goes back to the state that it has at the mount.
- A part inside a root can validate each change of the value of the root. The root then sets a flag in its context for the change of a reset, and the part starts no validation while the flag is set. `NumberField.Root` does this with `isResetChangePending`. The root clears the error of the field itself.
- A field counts `valueMissing` only after it is marked dirty. A value that differs from its initial value marks the field. A call of `validate()` on the field or on the form marks it too, and a submit calls `validate()` for each field. The `dirty` prop with the value `true` also marks it. A part that the user cannot empty, such as `RadioGroup`, gives `true` as the second argument of `validation.commit` at its blur. The field then counts `valueMissing` with no mark.
- `Select.Trigger`, `Select.Root` and a combobox with a selection mode whose trigger is the control do the same. The comment at each call gives its case.

```vue
<slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
<component :is="as" v-else v-bind="elementProps()" :ref="setRef">
  <slot :state="state" />
</component>
<input v-bind="inputProps()" :ref="setInputElement" />
```

### Element targets

One helper, `resolveElement(value)` of `src/internals`, changes the value of a template ref into an element. Its JSDoc and its comments give the result for each value.

Rules:

- The `ref` setter of a part calls `resolveElement`. Thus `as="RouterLink"` and `<RouterLink v-bind="props">` work.
- A part calls `resolveElement` again after each of its renders, in `onMounted` and in `onUpdated`. A component can set its exposed `element` after its render, also in its own `onMounted`. Vue runs the `onMounted` hook of a child before the `onMounted` or `onUpdated` hook of its parent, so the element exists then.
- A component that sets its exposed `element` later than its own `onMounted`, such as after an `await`, exposes the element as a ref. The `ref` setter of the part reads that ref in the render that patches the component. Vue runs that render again when the ref changes, so the part gets the element.
- A prop that takes an element accepts `MaybeRefOrGetter<Element | ComponentPublicInstance | null>` and upstream's other forms. Examples are `anchor`, `container`, `initialFocus`, `finalFocus` and `collisionBoundary`.

### `mergeProps`

`mergeProps(...sets)` is public. Its JSDoc and `docs/utils/merge-props.md` give its rules. These rules are for the source of the package:

- For an attribute, an `undefined` value in a later set also wins, as in Base UI. A part clears a value of its own sets in this way.
- The DOM gives one event object to each listener of a dispatch. `event.vaseUIHandlerPrevented` is thus `true` from the first call of `event.preventVaseUIHandler()` to the end of the dispatch, in each element and in each phase (`VUE-82`). Do not use the flag in a handler of a props function to decide on the earlier handlers.
- Code that calls a handler from a props set must accept a function, an array and a falsy value. A consumer can give each of them. The call `false?.()` throws.
- A function in the first set gets a new empty object, and `mergePropsN([])` returns a new object. Do not use one constant for them, because a function or a caller can write to it.
- An event is an object that has `preventDefault`. Do not use `instanceof`.

### `useRenderElement` and `useRender`

- Use `useRenderElement` in the part that owns the default element. Expose `element` and bind `setRef` by name on that element. A wrapper such as `Input` forwards its render slot to the inner part and exposes the inner element.
- Supply `useButton(element, options)` through the `button` option of `useRenderElement`. The button checks its disabled state before it calls the merged click, pointerdown, mousedown, keydown or keyup listener. A key listener can veto keyboard activation.
- `elementProps()` also holds the setter as `ref` for the `#render` slot. On the element of the part, Vue merges the spread and the binding by name into one `ref`. Vue thus calls the setter one time for each patch.
- `useRenderElement` leaves out each attribute of the consumer that is not given, with `givenAttributes` of `src/internals/givenAttributes.ts`. The `props` function thus gets no such key, so a part makes no check for it there.
- Four rules decide what is not given: `undefined` for each attribute (`VUE-103`), a blank `id` (`VUE-93`), a blank `aria-label` or `aria-labelledby` (`VUE-106`), and a blank ID reference attribute (`VUE-110`).
- The list `BLANK_IS_NOT_GIVEN` of that file has one entry for each attribute whose blank value is not given. A new such attribute needs a new entry.
- `givenAttributes` does not get a declared prop, a value that a part reads with `useAttrs()` or a parameter of a composable. A part reads such a value through `given(attribute, value)` of the same file. `OTPFieldInput.vue` does this for the `aria-label` of its warning.
- A part that reads an attribute of the consumer in `props` reads `null` as a removal of that attribute. `Menu.RadioGroup` then gives no `aria-labelledby`, and `Field.Control` gives no `aria-describedby`. `Calendar.Grid` then has no label, so it keeps the name of the month in `aria-label`.
- `useRenderElement` takes its `ref` callbacks one time, in `setup`. It calls a callback only when the element changes. A change of a prop that keeps the element calls none.
- Register each scroll area viewport, corner, scrollbar and thumb with the root after the patch. Track the axis of each scrollbar and thumb.
- Release a scroll area registration on replacement, hold and unmount. Clear only the element that the part registered.
- While Vue hydrates an element, it writes no attribute that a `v-bind` object gives, except a listener and the `value` of an input. It compares only `class`, `style` and the attributes of its lists of known attributes. `aria-*`, `role`, `abbr` and `data-*` are not in those lists.
- An element thus keeps the server value of such an attribute until a render gives another value for the same key. A render after the mount that gives the value of the first client render writes nothing.
- In a render before the mount of a part that Vue hydrates, `elementProps()` compares the props with the server element, as text, for each key that is `role`, `abbr`, `data-*` or `aria-*` except `aria-hidden`. When a value differs, the props get the server value, or `undefined` when the server element has no such attribute. The `#render` slot thus can get the server value of such a key, as a string, in that render.
- Vue then writes the client value in the render after the mount. A render that took a server value reads a ref that `onMounted` sets, so only such a part renders again after the mount. A part whose values equal the server HTML thus gets no extra render.
- For each state that has no function in `stateAttributesMapping`, the props get the key `data-` and the name of the state in lower case, with the value `undefined`. This happens when the props have no such key and the server element has the attribute. The default mapping gives no key for a state that is `false`, and Vue removes an attribute only when the earlier render has its key.
- The comparison reads only the keys that the props have. A part thus gives each `aria-*` attribute, `role` and `abbr` that it can give as a key in each render, with the value `undefined` when it has no value. Do not leave the key out, as a spread of an optional object does. A key that a render leaves out keeps the server value.
- A set leaves a key out only when the server HTML and the first client render have the same value for that key. `useFocusableWhenDisabled` leaves `aria-disabled` out in this way, because a key with the value `undefined` replaces the value of an earlier set in `mergeProps`.
- The comparison leaves `aria-hidden`. The lock of a modal popup writes it to the elements outside the popup, and a part can hydrate after that. For a part with the key `aria-hidden` and no value, the comparison would remove that attribute.
- A custom `stateAttributesMapping` function that returns `null` gives no key, so the comparison does not heal that attribute. A part whose first client state can differ from the server HTML reads its state from the server element, as `Resizable.Handle` and `Resizable.Panel` do. See [Server render](#server-render).
- `elementProps()` reads the server element with `getServerElement()` of `src/common/hydration.ts`. That element is the first element that Vue hydrates for the part. The template of a part thus starts with its element: first the `#render` slot, and then `<component :is="as">`.
- Upstream's `useRenderElement` has a parameter `enabled`. The Vue composable has none, because the template decides if the part renders an element.
- A part that renders no element in some state puts the condition in the `v-if` chain of both forms of its template. The template then does not call `elementProps()`. See [Parts that render an element](#parts-that-render-an-element).
- Vue skips a Vue listener that it attached in the millisecond of an event when an earlier Vue listener got the event. `useRenderElement` thus adds a second listener for each `focusin` and `focusout` handler of the props. That listener runs the handler for an event that Vue skipped.
- A focus that a function ref gives before it calls `props.ref` comes before the second listener. A part that needs that focus reads `activeElement` in its `ref` callback, as `Menu.Input` does.
- A Vue listener of the consumer on a plain element above a part can still miss such a focus. The Vue listener of the part gets the event first.
- In a development build, a watcher also checks for `as` together with `#render`. A part compiled as a Vapor component does not update when `as` changes while it renders the `#render` slot. Only the slot reads the props of the element then.
- `useRender` is the public form of `useRenderElement`. Its JSDoc and `docs/utils/use-render.md` give its API.
- `useRender` returns `setRef` too. The template of a component that calls `useRender` binds it by name beside the spread, as the template of a part does. Each sample, demo and fixture that calls `useRender` has that form. A render function has no binding by name, so it spreads only `elementProps()`.
- `useRender` returns `usesRenderSlot` too. The template of a component that calls `useRender` ends the `v-if` of its `#render` slot with the call, as the template of a part does. Each sample, demo and fixture that calls `useRender` has that form. A render function calls `elementProps()` in each render, so it reads `slots.render`.
- `useRender` passes `refBindingCheck: true` to `useRenderElement`. In a development build, a Vapor component that renders a string tag with `elementProps()` then gets a warning when the setter got no call. ESLint guards the template of a part, so a part does not pass the parameter. The check reads only a Vapor component, which gets no instance from `getCurrentInstance`. A virtual DOM component gets its `ref` from the spread. The check reads only a string tag, because a component as the tag can give its ref after the mount.
- `useRender` passes `serverAttributes: false` to `useRenderElement`, because the library cannot know the first element of the template of a consumer. A component of a consumer thus hydrates as Vue does.

### Props

- Declare an optional prop as `x?: T | undefined`, as upstream does. A consumer that sets `exactOptionalPropertyTypes` can then pass `undefined`.
- Upstream types some Boolean props with a generic parameter, such as `multiple?: Multiple | undefined`. Declare such a prop as `multiple?: (Multiple & boolean) | undefined`.
- The SFC compiler then writes `type: Boolean`, so a bare `multiple` is `true`. For `Multiple` alone, it writes `type: null`, so a bare `multiple` is the string `''`, which is falsy.
- `withDefaults` refuses a default for such a prop (TS2322), so the prop has none. Vue gives an absent Boolean prop the value `false`. Write `@default false` in the JSDoc for the API reference. The prop row of the `types.md` then needs a `not-applicable` row in the family file, as `Select.Root` has.
- In a union of `boolean` and a string, write `boolean` first: `boolean | 'trap-focus'`. With the string first, a bare attribute is the string `''`.
- The SFC compiler cannot read a type of the DOM library, such as `ValidityState`. In a union with `boolean`, the production build then keeps `Boolean` alone. For any other value, Vue warns in a development build of the consumer. Write the other member with a type of the package, as `Field.Error` does: `boolean | keyof FieldValidityData['state']`.
- A Boolean prop with the default `true` cannot tell an absent prop from `true`. A check of Base UI for a prop that is set thus runs only for `false`. `Menu.Root` does this for `modal` on a nested menu.
- A part that has a Boolean prop with the default `true` or `undefined` calls `useCastBooleanWarning` of `src/internals` in `setup`, inside `if (process.env.NODE_ENV !== 'production')`. For such a prop, an absent prop and `false` can give different results.
- The helper warns when a wrapper component gives the part `false` only because Vue cast an absent Boolean prop of the wrapper. Its `except` list names each prop for which an absent prop and `false` have the same effect, as `invalid` of `Field.Root`.
- `src/internals/useCastBooleanWarning.coverage.node.test.ts` fails for such a part with no call. Its table names each exception. A part that has no other such prop, as `Field.Error`, has no call.
- Add each new such prop that is not an exception to the lists of [Wrap a part](docs/handbook/composition.md#wrap-a-part).
- Declare a required prop that can be `null` as `x: T | null`, such as `value` of `Progress.Root`. The SFC compiler then writes `required: true`, and Vue accepts `null` with no warning.
- The props interface of a part can extend an `Omit` of the props interface of another part. The other interface can be in another `.vue` file and can have a type parameter. The SFC compiler reads the kept props, and each keeps its JSDoc. `AlertDialogRoot.vue` is the example.
- Do not give a top-level declaration or an import of `<script>` or `<script setup>` the name of a prop. The bindings of the SFC compiler then have no prop with that name, and the API reference does not list the prop. `pnpm parity:check` fails for such a name in each SFC of `packages/vue/src` that has no `.test` or `.spec` before its extension. `ProgressLabel.vue` declares the prop `id`, so its constant is `labelId`.
- A native attribute that a part must watch is a declared prop. The Vue documentation says that `$attrs` is not reactive. `Avatar.Image` declares `src`, `srcset`, `sizes`, `crossorigin` and `referrerpolicy` for this reason.
- Declare the prop of an `aria-*` attribute in camel case: `ariaLabel` for `aria-label`. Vue gives the attribute `aria-label` to that prop.
- Do not omit the `aria-*` key from the attributes type that the interface extends. vue-tsc keeps an `aria-*` name of a template as it is, because its `htmlAttributes` option names `aria-*`. Without the key, `<Switch.Root aria-label="Wi-Fi">` fails the type check of a consumer that sets `strictTemplates`.
- A template and TSX then accept `aria-label` and `ariaLabel`, each as a `string`.
- Add each such prop to the type tests `packages/vue/test/AriaAttributesInTemplate.spec.vue` and `packages/vue/test/ariaAttributes.spec.tsx`.
- The `aria-*` key reaches the prop, so name it in the second type argument of `WithVaseUIEvent`. See [Parts that render an element](#parts-that-render-an-element). Add a line that gives the attribute `null` and must fail to `packages/vue/src/internals/NullAttributeInTemplate.spec.vue`.
- A part reads a declared `ariaLabel`, `ariaLabelledby` or `ariaDescribedby` through `given` with the name of the attribute, as in `given('aria-label', props.ariaLabel)`. It can also give `ariaLabel` and `ariaLabelledby` to `useAriaLabelledBy`, which does so. A blank value is then `undefined`, as if the consumer gave none (`VUE-106`, `VUE-110`). `Slider.Thumb` and `TimeClock.Face` do this for `ariaDescribedby`.
- vue-tsc types a generic SFC as a function of its props and its context. `Component` refuses that function when the SFC has a required slot. `as` also accepts `GenericComponent` of `src/internals/types.ts`, so `<Toolbar.Button :as="Select.Trigger">` passes the type check.
- `GenericComponent` has `/* @vue-ignore */`, so the SFC compiler writes no run-time type for `as`. Without it, the type is `[String, Function]`. The build of the package keeps the type but not `skipCheck`, so Vue warns for a component object in the development build of a consumer. `pnpm check:package` gives `Select.Trigger` to `as` of `Toolbar.Button` in a development build, and fails on a warning.
- `Toggle` is not a generic SFC, because no other prop, event or slot of `Toggle` follows `Value`. It keeps the type parameter on its exported props interface: `ToggleProps<Value extends string = string>`, with `defineProps<ToggleProps>()`. `ToggleGroup` is a generic SFC, because the type of its `valueChange` event follows `Value`.
- Base UI takes a `React.ReactNode` as the label of an item. A label comes from an `items` record, from an `items` list, or from an object value that has a `label`. Vase UI takes an `ItemLabel`, which `src/internals/resolveValueLabel.ts` exports.
- An `ItemLabel` is a string, a number, `null`, `undefined`, or a function that returns the content of the label. It is not a vnode. A vnode must be unique in the tree, and a label shows in the value part and in its item at the same time. See [Vnodes Must Be Unique](https://vuejs.org/guide/extras/render-function.html#vnodes-must-be-unique).
- On a page that Vue hydrated, a component in a vnode that mounts a second time renders nothing.
- `resolveSelectedLabel` and `resolveMultipleLabels` give a function label as it is. A part renders it with `<component :is="label" />`, and it renders each other label as text.
- Do not call a label function in `setup` or in a `computed`. The result is a vnode, and the next render uses it again.
- The text of an item with a function label is the result of `itemToStringLabel`, or the text of its value. `stringifyAsLabel` gives it.

### State and `v-model`

Base UI has prop trios such as `checked`, `defaultChecked` and `onCheckedChange`.

- Bind the value of a part with `v-model`. Declare the prop `modelValue` and the event `update:modelValue`.
- Give independent state a named model, such as `v-model:open`. Keep `value` for the identity of an item.
- Keep the default prop and change event names, such as `defaultChecked` and `checkedChange`.
- Declare each controlled prop with `default: undefined` through `withDefaults`. Without it, Vue changes an absent Boolean prop to `false`.
- When the model prop returns to `undefined`, the part keeps the last value from the parent. An update listener alone leaves the part in control.
- Emit the change event first. Emit the model update in the same task.
- Skip the model update when `details.isCanceled` is true. `Tabs.Root` always emits the update for an automatic selection with reason `initial`, `disabled` or `missing`.
- `Select.Root`, `Combobox.Root`, `Autocomplete.Root` and `Menu.RadioGroup` emit no `valueChange` and no `update:modelValue` when the user picks the value that the part has (`VUE-91`). HTML fires `change` when the user commits a change of the value.
- To stop a cancelable change, call `details.cancel()` before the listener returns. The part reads `isCanceled` at that time, so a call after an `await` has no effect.
- A `Toggle` in a `ToggleGroup` emits `pressedChange` first. The group emits `valueChange` and `update:modelValue`. The item then emits its own `update:modelValue`. Both change events get the same `details` object. A call to `details.cancel()` stops each later event.
- Do not throw to stop a change. A listener that throws stops the model update only where Vue throws the error again. Vue throws the error again only in a development build, or in a production build where `app.config.throwUnhandledErrorInProduction` is `true`. Vue does not throw it again when `app.config.errorHandler` or an ancestor `errorCaptured` hook that returns `false` handles the error. Where Vue does not throw the error again, the part emits the model update.
- `useControlled({ controlled: () => props.x, default: () => props.defaultX, name })` returns a writable computed. Assign its `.value` after the veto check.
- The default getter lets a development build warn when the default of an uncontrolled part changes.
- A prop can take more forms than its event gives, as `layout` of `Resizable.Root` does. The JSDoc of such a prop gives each form, and the form that the event gives.
- `Accordion.Root`, `ToggleGroup` and `CheckboxGroup` take `null` in `modelValue` and `defaultValue`, and read it as an empty array (`VUE-114`). A `null` `modelValue` keeps the part controlled.
- With `multiple`, `Select.Root` and `Combobox.Root` read `null` in `modelValue` and `defaultValue` as an empty array (`VUE-115`). A `null` `modelValue` keeps the part controlled. Without `multiple`, `null` stays a value, because an item can have the value `null`.
- `Combobox.Input` in `Combobox.Chips` moves the focus to a chip only when the value is an array (`VUE-122`). With each other value, such as the `null` of a combobox with no `multiple` prop, the arrow key keeps its default action.
- `Combobox.Chip` and `Combobox.ChipRemove` remove a value only when the value of the combobox is an array (`VUE-122`). With each other value, the chip ignores Backspace and Delete, and the remove button ignores a press.
- When a parent releases `Field.Control.modelValue`, the native input keeps the last parent text. A later render preserves typed edits, and a form reset applies `defaultValue`.

The change event carries these details:

- `reason`, with upstream's strings.
- `event` holds the native event, or `new Event('vase-ui')` when there is none. For `Slider.Root`, read the value from the first argument and the field name from the thumb input.
- `cancel()` and `isCanceled`.
- `allowPropagation()` and `isPropagationAllowed`.
- `trigger`.
- `preventUnmountOnClose()`, on popup roots.

`createChangeEventDetails` and `createGenericEventDetails` infer custom properties only from their arguments (`VUE-123`). An expected type cannot supply absent properties or hide a wrong reason.

### Other callbacks

- Declare a typed emit for each notification, such as `openChangeComplete`, `valueCommitted`, `itemHighlighted` or `loadingStatusChange`.
- `update:x` exists only where the part has a prop `x`. `Accordion.Item` emits `openChange` and has no prop `open`, so it has no `update:open`.
- An emit can report a state that the part derives from other state, such as `collapsedChange` of `Resizable.Panel`. It has the new value and no `details`, and the part has no `update:x` for it. The part emits it after the DOM update of each change of the state, also a change that comes from the `layout` prop of the root. It does not emit it at the mount.
- An emit and an exposed method can have one name. `Resizable.Panel` emits `resize` and exposes `resize(size)`. Vue keeps the two apart: the emit is the listener `onResize`, and the method is a member of the exposed object.
- A native listener that the part calls itself, after work of its own, is a declared emit. `Form` does this for `submit`: it emits `submit` only when each field is valid. A listener in the attributes would run before that work.
- Declare a listener prop beside an emit only when native behavior depends on its presence. After validation passes, `Form` prevents native submission if it has a `formSubmit` listener. It reads the listener props for that check.
- Vue gives the listener to the prop, and the emit still calls it. Type the prop as a function or an array of functions, because Vue gives the prop an array for two listeners.
- A listener with `.once` has the key `onFormSubmitOnce`. Declare that prop too, and read both props. The emit calls the `.once` listener one time.
- A callback whose result the component uses stays a function prop: `validate`, `format`, `getAriaValueText`, `filter`, `itemToStringValue`, `isItemEqualToValue`, `initialFocus`, `finalFocus`.

### Actions, handles, slots, composables and ids

- `actionsRef` becomes methods that the part exposes. A consumer reads them through a template ref.
- Popup roots expose `close()` and `unmount()`. `Field.Root` exposes `validate()`. Its prop `validate` is the validator function. `Form` exposes `validate(name?)`. The types are `DialogRootActions` and so on.
- A part that Base UI does not have exposes its methods in the same way. `Resizable.Panel` is the model, with the type `Resizable.Panel.Actions`.
- A ref prop of upstream (`inputRef`) becomes an exposed element (`inputElement`) beside `element`.
- Handles are upstream's objects, with no change: `Dialog.createHandle<Payload>()`, `handle`, `payload`, `triggerId`, `open()`, `openWithPayload()`, `close()`, `isOpen`.
- Function children become a default scoped slot with named props: `{ payload }` on a root, `{ validity }` on `Field.Validity`, `{ item, index }` on `Combobox.Collection`, `{ value }` on `Select.Value`.
- A part that renders a list has a slot that has the name of its item. `Combobox.List` has the slot `item`, and `Calendar.Week` has the slot `day`. Its props are the item and its `index`, such as `{ day, index }`.
- A list part of a component that Base UI does not have can have a default slot. The default slot holds the nodes before the items. `Calendar.WeekNumber` is in the default slot of `Calendar.Week`. The `#render` slot does not render the default slot.
- A part can take nodes or a function that renders each item as its children, such as `Combobox.List`. Its default slot holds the nodes, and the slot `item` with `{ item, index }` is the function. A slot does not show at run time if it takes slot props, so one slot cannot be both.
- Type the slots with `defineSlots`. Write each slot except `#render` as a method, as the Vue documentation does: `default(props: { state: ButtonState }): unknown`. A slot with no slot props is `default(): unknown`. A root with a value type uses `generic="Value"`.
- Give the type parameter the default that Base UI gives it: `generic="Value = any"` on `Accordion.Root`. With no default, the handler of a root that has no `modelValue` and no `defaultValue` gets `unknown[]`. Base UI gives `any[]`, and its type test has a line for it.
- vue-tsc does not use a listener of a template to resolve a type parameter of a generic SFC. It resolves the type parameters from the other props, and then it checks each listener against the result.
- A type parameter that only a listener can give is the exception to the default of Base UI. Give it a default that accepts a listener with a typed parameter. A consumer then gives the parameter of the listener the type: `(formValues: { id: string }) => void` on `Form`. With the default of Base UI, `Record<string, any>`, vue-tsc refuses that listener.
- Use the first default of this list that applies:
  1. The type of the value when no prop gives the type parameter, where no other part gives the value. With no `modelValue` and no `defaultValue`, the value of `Slider.Root` is its `min`, a number. So its default is `number`.
  2. `never`, where Base UI gives `unknown` to a listener with no type: `Select.Root`, `Combobox.Root` and `Autocomplete.Root`. As with `unknown`, a listener with no type then cannot read a member of an item. vue-tsc still refuses `(value: string) => void` where the value can be `null` or `undefined`. With `any`, some lines of the Base UI type tests that must fail then pass.
  3. `any`, where Base UI gives a type with members: `Form` (`Record<string, any>`) and `ToggleGroup` (`string[]`). With `never`, vue-tsc refuses a call such as `value.includes('a')`.
- The exported props interface keeps the default of Base UI: `FormProps<FormValues extends Record<string, any> = Record<string, any>>`.
- Write the `#render` slot as a property with the shared type: `render: ComponentRenderFn<HTMLProps, ButtonState>`. A part with the `children` slot prop writes a method with the three slot props, because `ComponentRenderFn` has no `children`.
- A part whose default tag has attributes of its own gives them to the slot type. The `a` of `PreviewCard.Trigger` is an example: `render: ComponentRenderFn<HTMLProps & AnchorHTMLAttributes, PreviewCardTriggerState>`. `HTMLProps` has no `href`.
- Keep the published composable names, such as `useDirection`, `useRender`, `Toast.useToastManager` and `Combobox.useFilter`.
- A public composable that gives the methods of the nearest part above the caller returns `null` when the caller is not inside that part. It calls `inject(key, null)`, so Vue shows no warning, and it throws no error. `Resizable.useParentPanel()` and `Resizable.useParentRoot()` do this. A composable that a part needs for its own work throws, as [Context of a root](#context-of-a-root) says.
- Choose a plain setup function, getter, computed or exposed ref from what its caller needs. Return a ref for live state that a caller can destructure.
- Return a `ComputedRef` for a derived value, as `useDirection()` does. Give readers a `Readonly<Ref<T>>` for state the composable writes.
- Compute reactive attributes, as `useLabel` and `useCompositeItem` do. Read them in the props function of `useRenderElement`.
- Keep a stable object when it contains only handlers. Each listener of `useSwipeDismiss` reads the current callback when its event arrives.
- Return actions as plain functions that read the current options. `Combobox.useFilter` and `Autocomplete.useFilter` take the options object as one `MaybeRefOrGetter` because `value` can itself be a function.
- A composable can have an option that is always a function and that must follow a change, such as `matchMedia` of `useMediaQuery(query, options)`. It takes the whole options object as one `MaybeRefOrGetter`. Such a member cannot be a `MaybeRefOrGetter`, because `toValue` calls a function.
- Pass a callback as a plain function when the composable only calls it. Both `useCompositeRoot` and `useCompositeList` take `onMapChange`. Other examples are `onComplete` of `useOpenChangeComplete`, `requestOpen` of `useCollapsibleRoot` and `focusControl` of `useLabel`.
- A composable with many options takes one object. Each option that can change is a `MaybeRefOrGetter`: `useAnchorPositioning({ side: () => props.side, mounted })`. Read an option with `toValue` in a `computed`, in a `watch` or in a callback. Do not keep a plain copy of its value in `setup`.
- An option whose value can be a function, such as `sideOffset`, takes a number, a ref or a getter that returns the value. It does not take a plain function, because `toValue` calls a function. Give the option a type that refuses it: `number | Readonly<Ref<number | OffsetFunction | undefined>> | (() => number | OffsetFunction | undefined)`.
- An option that takes an element in upstream's forms, such as `anchor`, is a source of a value that can itself be a ref or a getter. Read it with `toValue(toValue(option))`. `useAnchorPositioning` does this in `resolveAnchor`, and in `resolveBoundary` for `collisionBoundary`.
- Do not call a getter of the consumer that can read the DOM before the component is mounted. A server render must never call it. Keep a flag that `onMounted` sets, and read the getter only while the flag is set.
- Upstream calls some functions of the consumer only while a popup is mounted, such as the `anchor` function. Read such a getter only while the popup is mounted too. A getter that reads an element that exists only while the popup is open then does not run for a closed popup. A getter that has no such upstream rule, such as the one of `collisionBoundary`, also runs while the popup is closed, after the mount.
- Call `useVaseUiId(() => props.id)` in setup when a part needs a generated id. It prefixes the id from `useId()` with `vase-ui-`. Derive associated ids from the root id. Keep the same allocation order on the server and client. For a command outside setup, use an imperative allocator, as `createToastManager` does.
- An `id` prop or attribute counts as absent when `trim()` gives an empty string (`VUE-93`). HTML requires a nonempty id with no ASCII white space. ASCII white space separates ids in a list such as `aria-labelledby`. `useVaseUiId` gives the generated id for a blank override. `useLabel`, `useLabelableId` and `useRegisteredLabelId` also treat a blank `id` prop as absent. A part that reads its `id` prop in another way reads it through `given('id', props.id)` of `src/internals/givenAttributes.ts` before its own default, as `Select.Trigger` does.
- A part that another part names calls `useRegisteredId(getId, register, element)` in `setup`. `getId` gives the id that the part binds to its element. `register` is the function of a registry, such as `registerId` of `createIdRegistry()`. `element` is a ref or a getter of the element of the part.
- A part binds its own id to its element, such as the `id` prop or a generated id. It never binds the registered id. A `#render` slot can give the element another `id`, and the attribute that comes last wins on the element. With the registered id, the element would keep the `id` of a slot after the slot drops it.
- Before the mount, the registered id is the id that the part binds. A server has no element, so the server HTML names that id. From the mount on, the registered id is the `id` that the element has now, and it follows each change (`VUE-118`, `VUE-119`, `VUE-121`). Base UI registers the id that the part binds, so a `render` element with another `id` leaves a reference that names no element.
- A part has no registered id while `getId` gives `undefined`, and while `KeepAlive` holds the part. From the mount on, it also has none while it has no element, and while its element has an empty `id`. No part names it then.
- `useReferencedId(getId, element)` gives the same id with no registration. `useRegisteredLabelId` reads it and registers a getter of that id together with the element of the label.
- A reference that the server HTML has reads the id with `useReferencedId` when the named part has no id registry. `NumberField.Root` gives the steppers the id of the input in this way, and `Resizable.Panel` gives `Resizable.Handle` its id.
- A reference that the server HTML does not have reads the `id` of the element with `useElementId`. The parent checkbox of a group and the owner element of a portal do this (`VUE-124`). A store copies the `id` of an element that it holds, as [Popup store](#popup-store) says.
- No reference reads an `id` in `onMounted` or `onUpdated`. A component in a `#render` slot can change the `id` in a render of its own, and the hooks of the part do not run then.

## TypeScript

- Run `pnpm lint:fix`. Then run `pnpm typecheck` and `pnpm lint`. These two show the reports that need hand work.
- A branch that merges `main` runs these three commands.

### Compiler flags

- The root project, `docs` and `packages/vue` extend `@tsconfig/strictest`. A flag of the preset is off only for a reason that this section gives.
- `packages/vue` has two projects: `tsconfig.build.json` for the source, and `tsconfig.test.json` for each file of the package. The build, `pnpm parity:check` and the API reference read the first.
- The test project has `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals` and `noUnusedParameters` off. A ported test can then keep the text of the Base UI test.
- `exactOptionalPropertyTypes` is off in the package. With the flag, the built declarations give a listener no `| undefined`. A consumer that sets the flag then cannot pass `undefined` to a listener.
- The consumer project of `pnpm check:package` sets `exactOptionalPropertyTypes`. It passes `undefined` to an optional prop and to a listener.
- `noPropertyAccessFromIndexSignature` is off. A bundler replaces `process.env.NODE_ENV` only in that form. The Vue documentation and the parts write `slots.default` and `$slots.render`.
- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are also off in the root project and in `docs`, because the scripts do not obey them.
- `lib` and `target` of the package are ES2024, so the compiler accepts each built-in of ES2024. The browsers that the build supports have fewer built-ins.
- The build has the target `baseline-widely-available`. tsdown gives that name a fixed list: Chrome 111, Edge 111, Firefox 114, Safari 16.4 and iOS 16.4. The build changes only the syntax for that list. It adds no polyfill.
- In the source of the package, use only a JavaScript built-in that each browser of that list has. The compatibility table on the MDN page of the built-in gives the versions. `Temporal` is the exception: the bullet below gives its rule.
- `Temporal` is the one API above ES2024 that the source needs. `weekInfo` of `internals/date-time/format.ts` also reads `getWeekInfo` of `Intl.Locale`, but only where the engine has it. Only the date and time families and `internals/date-time` use it. Its types come from `lib.esnext.temporal`, which the Temporal reference line of [Entry points](#entry-points) loads. That line is the first line of `internals/date-time/temporal.ts`.
- Each browser of the list has `Array.prototype.at`, `Array.prototype.findLast`, `Object.hasOwn` and `String.prototype.replaceAll`. Firefox 114 does not have the array methods `toSorted`, `toReversed`, `toSpliced` and `with`.
- ESLint refuses `toSorted`, `toReversed` and `toSpliced` in the source of the package. It does not refuse `with`, because the source calls the method `with` of `Temporal`.
- The scripts and the tests are not in the built package. A file that runs in Node.js, such as a script or a `.node.test` file, can use each built-in of the Node.js version in `.node-version`. A test file that runs in the browsers can use only a built-in that each of the three engines of Playwright has. In both cases, the `lib` of the project must have the types of the built-in.

### ESLint

- `eslint.config.js` gives the reason for each rule of typescript-eslint that is off or has an option.

### Index reads and `!`

`noUncheckedIndexedAccess` adds `undefined` to the type of an index read, and `no-non-null-assertion` refuses `!`. In the source, use the first of these rules that applies:

1. Write the code so that no read can be absent, when the result is as short and does the same. Use `for...of`, a destructure or `.at(-1)`.
2. If an algorithm of Base UI needs the index, keep the read and write `!`. Disable `@typescript-eslint/no-non-null-assertion` for the line, or for the block when a function has many such reads. The reason says why the index is in range. If Base UI gives a read that can be absent to code that accepts it, keep the read with `!`. The reason says what that code does with the absent value.
3. Do not add a guard or a default that cannot run. Do not write `as T`.

A disable comment has the form `// eslint-disable-next-line <rule> -- <reason>`. For a block, write `/* eslint-disable <rule> -- <reason> */` before the block and `/* eslint-enable <rule> */` after it.

### Idioms

- Write `??` where the left operand is an object, `null` or `undefined`. Where Base UI has `||` for a string, a number or a Boolean, keep `||`. The two operators differ for `''`, `0` and `false`.
- Write `Object.hasOwn`.
- Write `.at(-1)` for the last item of a list.
- Write `import type` on its own line.
- Write `void` before a promise that the code does not wait for.
- An optional parameter has no `| undefined`. An optional prop has it, as [Props](#props) says.
- Write a class member that only its class uses as an ECMAScript private member, such as `#attachedStores`. Do not write the `private` keyword, also where Base UI has it. The keyword is only a check of the compiler, and the member stays a public property at run time. ESLint refuses the keyword in the source of the package.
- Keep `protected` for a member that a subclass uses, because ECMAScript has no such form. Do not write `public`. It is the default, and ESLint refuses it in the source of the package.
- A member that is only a type keeps `private`: a field that has `declare`, and a member of a `declare class`. The comment of the rule for the `private` keyword in `eslint.config.js` gives the reason. The brand of `AlertDialogHandle` is an example.
- A class with a `#` member whose objects a consumer can hold calls `markRaw(this)` in its constructor, as `BasePopupHandle` does. [Popup store](#popup-store) says what a reactive proxy does to such an object.

## Rules for the source

### Vue forms

#### State and effects

- Keep state in the smallest component or composable that owns it. Create instance state in `setup`.
- Use `ref` for a value and `reactive` for an object whose members can change independently.
- Use `shallowRef` for a DOM node, an external object or a collection that changes by replacement.
- Use `customRef` only when the owner must control when a read subscribes or a write notifies.
- In `useItemRegistry`, write to the live map and call `triggerRef` to update its snapshot. This keeps a registration independent of other items.
- Derive a value with a pure `computed`. Use a writable computed when its setter has a distinct owner for the write.
- Read a prop, ref or getter when the handler runs. A function that `setup` creates once keeps its identity for that instance.
- Accept `MaybeRefOrGetter<T>` for a live input. Call `toValue` inside the operation that needs the value. A callback needs its own type because `toValue` calls functions.
- Give a stateful composable a `use` name. Return its refs and actions in a plain object so its caller can destructure them.
- Use `watchEffect` for a side effect whose synchronous reads select its inputs. Vue tracks reads only up to the first `await`.
- Use `watch` for a change between values, an explicit source of invalidation or a comparison with the old value. For example, `restartKey` must restart `useOpenChangeComplete` even though its callback never reads that key.
- Select the narrowest watch depth that covers the change. For array structure, `deep: 1` tracks insertions, removals and replacement. A deep watch can receive the same object for both values.
- Use the default flush for batched work before the owner's patch. Use `flush: 'post'` or `watchPostEffect` for work that needs the patched DOM.
- Use `flush: 'sync'` only for a deadline in the same task. Prove the deadline with a case that would miss the update under the default flush.
- Register watcher cleanup before the first `await`. Use the callback's `onCleanup` argument or call `onWatcherCleanup` synchronously.
- Give each listener and observer to the watcher or scope that creates it. Release it when its target changes and when its owner stops.
- Give a detached `effectScope` an owner that calls `stop()`. Use `onScopeDispose` for the lifetime of the whole scope.

#### Parts and their elements

- Put the element, its attributes and its default content in the SFC template. Group the code in `<script setup lang="ts">` by behavior.
- Render a node for each part, or let `v-if` render its comment. Put logic with no node in a composable.
- Remove an unnecessary `Fragment` from a render function. If it groups siblings, normalize its children so none is `null`, `undefined` or a Boolean.
- Type props with `defineProps`. Read `props.x` or pass a getter for a destructured prop across a reactive boundary.
- Give mutable defaults a factory with `withDefaults`. Use `default: undefined` when a Boolean prop must distinguish absence from `false`.
- Declare component notifications with typed emits. Give a return-valued callback or an imperative command option a function type.
- Use `v-model` for two-way data flow. Pair each model prop with its matching `update:` event.
- Use a writable computed for a package model. Read the defined prop as the value. Let the part own the value while the prop is `undefined`. Vue's `useModel` permits a local write with only the prop, so ESLint refuses `defineModel` in `packages/vue/src`. A demo can use `defineModel` for Vue's own model contract.
- Emit a cancelable change before the model write. Check the veto as soon as the listener returns. A listener's return value cannot veto a Vue emit.
- Place undeclared attributes and native listeners on their intended element once. A wrapper or a part with multiple roots must choose that element.
- Bind state-dependent classes and styles in the template. The consumer can use the state of a scoped slot on its own element.
- Type named slot props with `defineSlots`. Render default or fallback content through a slot outlet. Check slot presence by name.
- Give a polymorphic slot its element bindings and state. Bind `:ref="props.ref"` on the chosen element in a Vapor slot.
- Provide a typed `InjectionKey` for compound parts. Give readers readonly state and named actions for the writes.
- Use `useTemplateRef` for one node the SFC owns. Pass the readonly ref to local composables. Bind a setter for a public render slot, several owners, indexed items or a tested patch-time requirement. Give each owner `null` on removal.
- Key a list of refs by item identity when order can change. Vue does not promise that a template ref array follows list order.
- Call `defineExpose` with the required element or actions before an `await`. Use the exposed interface of a component ref.
- Allocate component ids with `useId()` during `setup`, in the same order on the server and client. Preserve the app prefix on both sides.
- Bind attributes, values, styles and listeners through Vue on each element the part owns. Use DOM APIs for focus, selection, scroll, measurement and resources outside that element.

#### Mount, hydration and render modes

- Register composables that need component hooks synchronously in `setup`. Start browser work after mount. Keep mutable server state local to each request.
- Match the server HTML and the first client render. Use `data-allow-mismatch` only for an expected difference in the named category.
- Check the first interaction with a part that hydrates late. Vue can replay the event that starts hydration.
- Put a Teleport target in place before the Teleport needs it. With `defer`, the target must exist in the same mount or update tick.
- Tie effects that need a visible part to `useKeepAliveState`. Cover a first mount in a held branch and the next activation.
- Use the package presence helpers for an enter, exit or interrupted close. ESLint refuses `<Transition>` and `<TransitionGroup>` in package source.
- Use APIs available in Vue 3.5.12 in the shared package entry. Keep VDOM-specific code within the exceptions in [Vapor mode](#vapor-mode).
- Give children stable props when their state stays equal. Measure component updates before a performance change.

### Review checklist

Apply the state, effect, server and compatibility checks to each source file. Apply the part and feature checks where the part has that behavior.

1. Locate the element, attributes and default content in the template. Check the reason for each render function.
2. Check that each handler reads its current prop, ref or getter at the call.
3. Trace each derived value to a pure computed. Identify the owner of each write.
4. Check each live composable input for `MaybeRefOrGetter` and a tracked `toValue` read. Pass a destructured prop through a getter.
5. Destructure the composable result. Check that its refs still update and its actions still reach the owner.
6. Check the source, depth and flush of each watcher. Register invalidation before an async wait.
7. Check each listener, observer and scope at replacement and final disposal.
8. Run server setup without browser globals or shared request state. Compare the first client render with the server HTML.
9. Check prop types, one-way data flow, absent Booleans and mutable defaults.
10. Check the matching model update for a bound model, an unbound model, a prop alone and a refused request.
11. Check that the veto precedes the write. After a refusal, inspect the input, focus or popup in a browser.
12. Check each component event declaration. Follow each native listener to one call on the intended element.
13. Inspect the element that receives `class`, `style`, `id` and ARIA attributes through a wrapper or multiple roots.
14. Check the slot's state and bindings. Render its fallback through an outlet. Count calls across the slot bridge. Keep slot calls out of setup and watchers.
15. Check the injection key's type. Trace each mutation to a named action of the provider.
16. Test a null ref, conditional removal and a new item order. Check that the exposed element clears on removal.
17. Compare the server and client ids for each label, description and control, with the same app prefix.
18. Check when the Teleport target exists. Check resource release at a KeepAlive hold and recovery at activation.
19. Check shared imports against Vue 3.5.12. Check Vapor code for private instance fields, slot inspection, `v-memo` and VDOM directives.
20. In each claimed render mode, test the public DOM, update events, slots, refs and first interaction after hydration.

When a mount hook and a watcher call the same function, check whether one watcher can own the work. Identify the DOM or child state that each `nextTick`, `onUpdated` or `onBeforeUpdate` needs. Pass a single ref callback directly when it has one owner. Check the reason for each ESLint exception. Describe each timing constraint and development message in terms of the behavior the user sees.

### Files

- Each part is an SFC with `<script setup lang="ts">`.
- The exported types of a part are in a `<script lang="ts">` block of the same file.
- Logic is in `.ts` composables.
- `motion-v` is a development dependency of the package and of the docs. The source does not import it. `pnpm check:package` fails when a public entry imports it.
- `temporal-polyfill` is a development dependency of the package and of the docs. The tests and the site load it, and the source does not import it. `pnpm check:package` fails when a public entry imports it.
- Import the middleware, `computePosition`, `autoUpdate` and the types of Floating UI from `@floating-ui/vue`. Do not import `@floating-ui/dom` or `@floating-ui/core`. They are not dependencies of the package, so pnpm does not link them.
- `@floating-ui/vue` does not export the type `Derivable`. Declare it in the file that needs it: `type Derivable<T> = (state: MiddlewareState) => T`.
- A middleware of `@floating-ui/react-dom` takes a list of dependencies. A middleware of `@floating-ui/vue` takes none. Make the list of middleware in a `computed`. Read in it each option that must cause a new position.
- Keep the range of `@floating-ui/utils` at the release that Base UI resolves at the tracked commit. Choose the range of `@floating-ui/vue` so that it uses the `@floating-ui/dom` of the `@floating-ui/react-dom` that Base UI resolves. The middleware is then the same: `@floating-ui/vue` 2.0 and `@floating-ui/react-dom` 2.1 depend on `@floating-ui/dom` 1.8.
- Do not add a `minimumReleaseAgeExclude` line or an `allowBuilds` entry to `pnpm-workspace.yaml` without a comment that gives the reason.
- A positioner part of a popup family calls `usePopupPositioner` in `setup`. `test/fixtures/PopupPositionerPart.vue` is the model. See [Popup positioning](#popup-positioning).
- To add or change a dependency of the package, run `pnpm --filter @vase-ui/vue add <name>@<range>`. Then commit `pnpm-lock.yaml`. Do not edit the lockfile. `THIRD_PARTY_NOTICES.md` names each run-time dependency.
- When two families import each other, move the shared context or constant to `src/internals`.
- `src/internals/constants.ts` has a part of the constants of Base UI. The pull request that first needs a constant adds it.
- Shared field attributes belong in `internals/field-constants`. Keep field validity and form types with their respective contexts. Record a source relocation when a family file moves into a context.
- A file of `utils` that Base UI has keeps its mapped path, also when it imports a constant of a family. `utils` is a shared folder and not an entry point. An example is `utils/collapsibleOpenStateMapping.ts`.

### Vapor mode

The source obeys rules that keep it compatible with the Vapor mode of Vue. ESLint blocks the forms that break them in `packages/vue/src`, and each report gives the form to use.

If a line must break a rule, put a disable comment on that line and give the reason.

The project `vapor` of the tests checks the parts in a Vapor app. The project `vapor-parts` compiles the parts as Vapor components and runs the listed test files. See [Where a test runs](#where-a-test-runs).

The fixture in `fixtures/vite/published` imports `Toggle` from the built package. It checks the public declarations on Vue 3.5.12. It hydrates the server button on that version and in a Vapor app on Vue 3.6.0-rc.15 with `vaporInteropPlugin`. The first click emits the Boolean value `true` once. The scoped slot text changes from `Off` to `On`. A second button focuses the original server button through the toggle's exposed `element`.

A function component that calls `h` is not an SFC, so Vapor mode does not compile it. `DateTimeFieldLiteralElement` is the one such component, for the reason in [Server render](#server-render).

`FilterDropdownHiddenItemText` is a component with a render function, so Vapor mode does not compile it. Only a render function reads the vnodes of a slot without a mount. See [What differs from the React source](#what-differs-from-the-react-source).

`isInHeldBranch()` of `src/internals/useKeepAliveState.ts` reads `getCurrentInstance`, because Vue has no other API that tells a part that `KeepAlive` holds its branch. In a part compiled as a Vapor component, the function gives `false`. `useKeepAliveState` starts `isHeld` with the function, so a part compiled as a Vapor component is not held at a mount in a held branch. Each part of the package compiles as a virtual DOM component. Such a part below the `KeepAlive` of a Vapor component gets `true` while that `KeepAlive` holds it. A case of `src/utils/popups/portal/PortalHeldMount.test.tsx` shows this in the project `vapor`.

`src/internals/callerProps.ts` reads `getCurrentInstance`, because Vue has no public API for the props that a caller sets, for the declared events, or for the component whose render made a vnode. The file reads `vnode.props`, `vnode.ctx`, `propsOptions`, `emitsOptions`, `type.__name`, `type.name` and the `_n` flag of a slot. Keep each such read in that file. Read a declared option from the field that Vue resolves for the instance (`propsOptions`, `emitsOptions`). Do not read it from `type`, because the option of `type` lacks what a mixin or `extends` declares. In a wrapper compiled as a Vapor component, the file gets no instance. `useForwardProps` then warns in a development build and forwards each value other than `undefined`, and `useForwardPropsEmits` forwards no event. A part below such a wrapper gives no cast Boolean warning.

### Server render

- Each part must render with `renderToString` in Node with no DOM.
- Code in setup does not touch `window` or `document`. The exception is a read behind a `typeof` check, where an option of the API needs the value before the mount.
- A `typeof` check does not make a read of `localStorage` safe on a server. Node.js 26 prints a warning at the first read of `localStorage` in a process when no `--localstorage-file` is set. `Resizable.useLayoutStorage()` reads its storage only after the mount, so the server HTML and the first client render have the layout with no stored item.
- With Vue 3.6, a server stops the effect scope of each component after the render, so a callback of `onScopeDispose` runs on a server. That callback does not touch `window` or `document`. `Slider.Control` releases the listeners of each press through its listener session.
- Compute labels, `aria-*` attributes and the roving tabindex at render, from props and ids. Do not compute them in `onMounted`. A value is an exception only when a server cannot know it. Such a value can change when its component is mounted. The exceptions are:
  - The `aria-labelledby` of a root with a label part, and of a control that only a native `<label>` names.
  - The id of a control that has an `id` prop in a field.
  - An `aria-valuetext` in a locale format.
  - The `tabindex` of an item of a composite. See [Composite](#composite).
  - The `aria-controls` or the `aria-labelledby` of `Collapsible.Trigger`, `Accordion.Trigger`, `Accordion.Panel`, `Tabs.Tab` and `Tabs.Panel`, when the part that they name registers too late. Such a part is below an async `setup`, or below a part that defers its server render.
  - The `role`, the `aria-hidden` and the `aria-label` of `FocusGuard.vue`. They depend on the engine and the screen reader.
  - The open state of the trigger that claims an open popup, when the root has no `defaultTriggerId` and no `triggerId`. The open state of a trigger that has a `handle` is also an exception. Put the trigger in the root, with a `defaultTriggerId` or a `triggerId`, and the server HTML is exact.
  - The `aria-controls` of an open trigger whose popup is in a portal, such as `Dialog.Trigger`, `Menu.Trigger` or `NavigationMenu.Trigger`.
  - The `aria-labelledby` and the `aria-describedby` that a `Dialog.Popup` in a `Dialog.Portal` with `disabled` gets from its title and its description. Give the popup the two attributes, and the server HTML has them.
  - The `aria-controls` of an open `Select.Trigger`, `Combobox.Trigger` or `Autocomplete.Trigger`, and of an expanded `Combobox.Input` or `Autocomplete.Input`. Each names the id of an element.
  - The `aria-controls` of the parent checkbox of a group.
  - The `aria-labelledby` of a `Select.Group`, as in Base UI.
  - The nodes that a part keeps beside its element with `useElementSiblings`, such as the focus guards and the dismiss button of `Combobox.Input`. Base UI has them in its server HTML, but there a guard has no listener before the hydration.
  - The `id`, `tabindex`, `role`, `aria-haspopup`, `aria-required` and `aria-readonly` of a `Combobox.Trigger` or an `Autocomplete.Trigger` after its input, as in Base UI.
  - The `tabindex` of a `Resizable.Handle` that has no panel on one side.
  - The `aria-valuenow`, `aria-valuemin` and `aria-valuemax` of a `Resizable.Handle` while a panel of its root has a first size that is a length. They wait for the first measurement of the page. The `aria-valuetext` that `getAriaValueText` gives has no `pixelSize` before that measurement.
  - The `aria-disabled` of a part in a native disabled `<fieldset>` (`VUE-112`).
  - Each reference to an `id` that a `#render` slot gives: the `for` of a label, and each `aria-labelledby`, `aria-describedby` and `aria-controls` that names a part (`VUE-118`, `VUE-121`). Give the `id` prop to the part, and the server HTML names the element.
  - Each value of a calendar root with no `today` prop that depends on today. See [Dates and times](#dates-and-times).
- By default, a portal renders its popup after the mount, so the server HTML has no `Dialog.Popup` and no `Popover.Popup`. With `disabled` on `Dialog.Portal`, the popup renders in the place of the part, also on a server. Each of these popups reads `aria-labelledby` and `aria-describedby` from the store. A `watch` writes the ids of the title and the description there after the title and the description render. Without explicit attributes, the first render of a popup that holds them has neither attribute.
- Hydration must give no warning. The hydrated DOM must be equal to a client-only render. Vue does not compare `aria-*`, `role` or `data-*`.
- A part that writes a date or a time as text can write another text on a server than in a browser, because the data of `Intl` can differ. While it hydrates, the part binds `data-allow-mismatch` with the category `text`. `Calendar.Caption`, `Calendar.Weekday`, `Calendar.WeekNumber`, `Calendar.DayButton`, `Calendar.MonthCell`, `Calendar.YearCell`, `Calendar.ViewTrigger`, `RangeCalendar.DayButton`, `TimeClock.ViewTrigger`, `TimeClock.DayPeriod`, `TimeClock.Number`, `TimePicker.Item` and `TimePicker.ColumnItem` do this. Each option of `Calendar.MonthSelect` and `Calendar.YearSelect` does it too. An item of a composite also binds the category `attribute` for its `tabindex`, so the two parts of the time picker bind `attribute,text`.
- Vue allows a text mismatch only for an element whose only child is a text. In a template, that is a static element with an interpolation as its child, and not a `<component :is>`. `Calendar.Caption`, `Calendar.Weekday`, `Calendar.WeekNumber`, `Calendar.DayButton`, `Calendar.ViewTrigger`, `Calendar.MonthCell`, `Calendar.YearCell`, `RangeCalendar.DayButton`, `TimeClock.ViewTrigger`, `TimeClock.DayPeriod`, `TimeClock.Number`, `TimePicker.Item` and `TimePicker.ColumnItem` write their default text as the child of a static element. A consumer that gives a default slot or `as` gets the text in a `<component :is>`.
- A name that a part formats with `Intl` can differ on a server and in a browser. Vue changes only the visible text to the text of the browser. The part gives the name to `useRenderElement` as an `aria-*` value or as `abbr`, and the render after the mount writes the text of the browser, as [`useRenderElement` and `useRender`](#userenderelement-and-userender) says. `Calendar.Root`, `Calendar.Grid`, `Calendar.Weekday`, `Calendar.DayButton`, `Calendar.WeekNumber`, `Calendar.ViewTrigger`, `Calendar.MonthSelect`, `Calendar.YearSelect`, `Calendar.MonthGrid`, `Calendar.YearGrid`, `Calendar.MonthCell`, `RangeCalendar.Root`, `RangeCalendar.DayButton` `TimeClock.ViewTrigger`, `DatePicker.Trigger`, `DateRangePicker.Trigger`, `TimePicker.Trigger` and `TimePicker.Column` do this. The range input of `TimeClock.Face` is not an element of `useRenderElement`, so `TimeClock.Face` gives its `aria-*` values to the function of `useAriaAfterHydration()`. `Slider.Thumb` gives the `aria-valuetext` of its range input to the same function. The segments of a date or time field are the exception. Their root compares their attributes with the DOM after the mount, as the list "A date or time field and the `Intl` data of the server" below says.
- The element gets no `style` key while the merged style has no value, because Vue writes `style=""` for an empty key on a server. After a render that wrote a `style` key, the key stays. Vue removes the whole `style` attribute when the key goes away, and with it each declaration that a part writes to the DOM.
- One internal SFC, `internals/PrehydrationScript.vue`, renders each prehydration script. A part renders `<PrehydrationScript :script="script" />` where its script expects it. A script that follows its element finds the element with `document.currentScript.previousElementSibling`.
- The SFC writes the text with `innerHTML`, and only in the server render. On a server, text interpolation changes `&`, `<`, `>`, `"` and `'` into entities, and a browser does not decode an entity in a `<script>`. The text is a constant of the library. Do not give `innerHTML` a value of a consumer.
- The script element gets the nonce of `CSPProvider` with `:nonce.attr`, as the style element does. `CSPProvider` has no setting that stops a script. A prop of the part does that, such as `renderBeforeHydration`.
- The client render has the script element in the place of the server element, and Vue does not compare `innerHTML`. The script element thus needs no `data-allow-mismatch`.
- The text of a script is the export `script` of the file `prehydrationScript.min.ts` in the folder of the part. The part imports it by a relative path: `import { script } from './prehydrationScript.min'`.
- The build changes that import into a subpath import with the folder of the part, such as `#prehydration/tabs/indicator`. The pattern `#prehydration/*` in `imports` of `packages/vue/package.json` resolves it.
- `imports` also has `#test-utils`. When a package has `imports`, Vite resolves each `#` specifier from that field, and it does not use the `paths` of `tsconfig.build.json` for that specifier.
- Add `data-allow-mismatch` to each element that the script changes, with the category of each change, such as `style`. Vue accepts a class, style or attribute mismatch only on the element that has the attribute with that category.
- Vue compares the `style` of an element only when the client render gives a `style` key. An element that can have a `style` in its client render, such as the `style` of a consumer, needs the category `style`.
- The part binds the attribute only while it hydrates, so the hydrated DOM stays equal to a client-only render.
- Write only the style properties that the part needs before hydration. The slider script sets `--start-position` on the indicator. For a range, it also sets `--relative-size`.
- A style element of the library must be in the server HTML, so that its rule applies before the page hydrates. `ScrollArea.Root` and `Select.Positioner` render `utils/StyleDisableScrollbar.vue` on the server and on the first client render. After mount, `useStyleDisableScrollbar` shares one style element per document or shadow root for `ScrollArea.Root` and `Select.Popup`. A replacement element in the same root keeps the style node and its nonce. The use of a part follows its element to another document or shadow root. A part outside a document or shadow root has no use. When `CSPProvider` sets `disableStyleElements`, its parts leave the rule for `vase-ui-disable-scrollbar` to the consumer.
- A portal renders after mount, except for `Dialog.Portal` with `disabled`. It does not render while the popup is closed, unless `keepMounted` is set. A portal that renders after mount leaves one comment in the server HTML, also for an open popup. With `disabled`, the server HTML has an open popup in the place of the part. See [Popup portal](#popup-portal).
- `NavigationMenu.Content` teleports into its viewport, and the root gets the element of the viewport only after the mount. The server HTML thus has no content, also for an open item. With `keepMounted`, the content is in its item, hidden.
- The server render of some families depends on an id, a locale, a prehydration script or a portal. It can also depend on a state that a server cannot know, such as the loading status of an image. Such a family adds a page and its cases to the Nuxt fixture, `fixtures/nuxt`. While no entry point exports a part, the page imports it by its path in `packages/vue/src`, as the page `portal.vue` does. Such a page imports each other part that shares a context with that part by its path too, because a part of the built package and a part of the source do not share a context.
- The type check of the fixture reads the source that a page imports by its path. Nuxt sets `noUncheckedIndexedAccess` and `noImplicitOverride`, and the build project of the package sets them too.

The hydration state:

- `useIsHydrating()` and `useIsHydrated()` of `src/common/hydration.ts` give the hydration state of the component that calls them. Their JSDoc and the comment above them say when each is `true`, and why.
- The first render of a client-only mount also reads `true` from `useIsHydrating()`. The component renders again in the flush after the mount, before a paint.
- Each call is for the component that calls it. A part that can hydrate after its root calls the helper itself. An example is an async component in `<Suspense>`.
- Do not keep the result in a module variable or in the context of the root.
- For a value in a locale format, call `useFormatLocale(locale)`. It gives the locale of the consumer. With no such locale, it gives `en-US` until the component is mounted, and then `undefined`, which is the runtime locale.
- The server HTML and the first client render then have the same text.
- A composable that filters text with a locale calls `useFormatLocale` too. The first client render then gives the list that the server HTML has. `Combobox.useFilter` and `Autocomplete.useFilter` are examples.
- Read browser values in `onMounted` so the first client render uses the server value. By default, `useMediaQuery` takes its initial value from `ssrMatchMedia` or `defaultMatches` and updates at mount if the values differ. With `noSsr`, it uses an available `matchMedia` for the initial value.
- A server can give a value in another way than the browser. When the first client render needs the value of the server, the value goes into the server HTML. Get it with `useServerValue(attribute, read, parse, write)` of `src/common/hydration.ts`. Bind `attributes()` to the element of the part. While `useIsHydrating()` is `true`, the element has the value in `attribute`, a `data-vase-ui-*` name. While Vue hydrates the part, the value is the one of that attribute, when `parse` accepts its text. On a server, in a client-only mount and after the mount, the value is `read()`. A calendar root keeps the day of the clock of the server in `data-vase-ui-today`.
- The hour cycle, the calendar, the first day of the week and the weekend of a locale change the elements of a part, and Node and a browser can have other `Intl` data for them. `TimeClock.Root` keeps its hour cycle in this way. `Calendar.Root` and `RangeCalendar.Root` keep the calendar, the first day of the week and the weekend of their grid. `read` applies the props that replace the data of the locale, such as `hourCycle`, `calendar` and `firstDayOfWeek`.
- After the mount, the part renders with the value of the browser. Vue patches that render as any other update, with no warning. The hydrated DOM is then equal to a client-only render. A part below it that mounts again after the mount, such as a page of a calendar, gets new generated ids.
- `getServerElement()` of `src/common/hydration.ts` gives the first element that Vue hydrates for the component that calls it. It gives `null` on a server, in a client-only mount and in a part that Vue compiles as a Vapor component. The walk starts at `vnode.el` and stops at the end of the fragment of the component. A part that renders no element thus gets `null`, and not the element of the next part. The walk counts the comments `[` and `]` of a fragment, and the comments `(` and `)` that Vue 3.6 writes around the fallback content of a slot.
- For a part with a `#render` slot, the element is the first element in the fragment of the slot. An element of the consumer that does not bind the props of the slot has no attribute. The value is then `read()`, and the hydration can give a mismatch.
- A part that measures the layout gives no measurement on a server and in the first client render. `Tabs.Indicator` reads the layout in a `computed` that gives `null` while `useIsHydrating()` is `true`. The server HTML and the first client render are then equal.
- A part that renders a text input and gives it a `value` key calls `useValueBeforeHydration(props, control)` of `src/common/hydration.ts` in `setup`. Vue writes the `value` key of an `<input>` when it hydrates the input. That write replaces the text that the user typed before the hydration. While the result is `false`, the element of the part gets no `value` key, and no watcher of the part writes a value to it. `useDateTimeFieldSegment` calls it for each segment of a date or time field.
- `useHiddenValueBeforeHydration(input, options)` does the same for a hidden input of a root. `queueInputTake(take)` adds the take of a part with a checked input to the queue of the hydration. The JSDoc of each function gives its result and the events of a take.
- With `{ restorable: false }`, the result is also `true` from the start when the navigation type of the page is `back_forward` or `reload`. A browser restores the form state of the page on such a navigation. `OTPField.Input` passes the option, so that its root does not complete and submit a code that the browser restored. The composable reads the navigation type only when `vnode.el` holds a server node, so a server never reads it.
- The composable reads `vnode.el` of `getCurrentInstance()`. Vue sets it before `setup` only when it hydrates the component from server HTML. Vue has no public API for this fact, and Nuxt reads the same field. `useAriaAfterHydration` and `getServerElement` read it too, and `useServerElement`, `useServerValue` and `useRenderElement` call `getServerElement`. The import thus breaks the rule of [Vapor mode](#vapor-mode) on one line. In Vapor mode the instance is `null`, and each composable acts as in a client-only mount.

A part that binds the id of a part that comes after it:

- A server writes the attributes of an element before the `setup` of each part that comes after the element.
- A part that binds the id of such a part calls `useDeferredServerRender()` of `src/internals/labelable-provider` in `setup`. Examples are the id of a label, of a message and of a legend.
- Vue then renders the part on a server in a later microtask. Before that render, Vue runs the `setup` of each part that it reaches in the same synchronous pass. The server HTML has the id, in each order of the parts.
- The part that binds the attribute makes the call. A call in a component around it does not help.
- Make the call with no condition on the environment. Vue makes a component that has the hook a boundary for `useId`, on a server and in a browser. With the hook only on a server, a part below the part gets another id in the browser. Vue then reports a hydration mismatch.
- A part that defers assumes nothing. With no registered id, it has no attribute.
- `Collapsible.Trigger` and `Accordion.Trigger` call `useDeferredServerRender()` for the id of the panel in `aria-controls`. `Accordion.Panel` calls it for the id of the trigger in `aria-labelledby`. The server HTML then names a part that has an `id` prop, in each order of the two parts (`VUE-80`).
- `Tabs.Tab` calls `useDeferredServerRender()` for the id of its panel in `aria-controls`. `Tabs.Panel` calls it for the id of its tab in `aria-labelledby`. The server HTML then names the tab and the panel in each other, in each order of the two parts (`VUE-80`).
- Such a part gives each `aria-*` value that a later part gives to `useRenderElement`, with no other call. `useRenderElement` gives the render before the mount the server value of each such key whose value differs, as [`useRenderElement` and `useRender`](#userenderelement-and-userender) says. A part below a part that defers is the same, such as `OTPField.Input`. The server also renders it after the later parts.
- A part that renders an element with no `useRenderElement`, such as a hidden input, gives each such `aria-*` value to the function that `useAriaAfterHydration()` of `src/common/hydration.ts` returns. `Checkbox.Root`, `Switch.Root`, `OTPField.Root`, `DateField.Root`, `TimeField.Root` and `Slider.Thumb` do this for an input. While Vue hydrates the part from server HTML, the function gives `null`. On a server, in a client-only mount and after the mount, it gives the value. With `null` in the first client render, the render after the mount always writes its value. Give the function only the value of an attribute that Vue does not compare when it hydrates, or of an attribute that the element allows to differ with `data-allow-mismatch` and the category `attribute`. Vue compares the attributes of its lists of known attributes, such as `id` and `tabindex`, and it warns when they differ.
- Each family with such a part calls `removedPartHydrationTests` in the test of the part. See [Test helpers](#test-helpers).
- A later part that is below an async `setup`, or below a component that defers, registers too late for the server HTML. The part that binds the id gets it after the page hydrates.
- A popup trigger does not call it. Each value that the trigger lacks on a server comes from a registration, an attachment or an element. A server has none of them. A deferral adds none of them.
- `Select.Trigger` and `Combobox.Trigger` are the exceptions, because each can be the control of a field. Each binds the id of the label part of its family, and the ids of the label and the messages of a field. Each calls `useDeferredServerRender()`, so the server HTML has these ids in each order of the parts.

A part whose style or attribute depends on the parts beside it:

- Such a part calls `useDeferredServerRender()`, and each part that it reads registers in `setup`. The server HTML then has the values that all the parts give. `Resizable.Panel` and `Resizable.Handle` do this.
- A part that registers after the parts beside it, such as a panel below an async `setup`, is not in their server HTML. They get the values of all the parts after the page hydrates.
- The first client render of such a part knows only the parts that registered before it. While Vue hydrates the part from server HTML, the part reads each value of its state that depends on later parts from the server element. `useServerElement()` of `src/common/hydration.ts` gives the element of `getServerElement()` until the mount. `useServerValue` reads the element in the same way.
- `Resizable.Panel` reads its `size` from `--resizable-panel-size`, and its `collapsed` state follows from the size. `Resizable.Handle` reads its `atMin` and `atMax` states from `data-at-min` and `data-at-max`.
- The first client render then has the state of the server HTML. Its `style`, its state attributes, and each class, style and slot content that a consumer makes from the state are equal to the server HTML. The render after the mount writes each value that changed.
- Vue keeps the server value of a `data-*` attribute from a `v-bind` object while it hydrates. Without the read, a state attribute can keep that value after the mount. A class, a style or a text that a consumer makes from the state gives a hydration warning.
- `Resizable.Handle` gives `aria-controls`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext` in each render, with the value `undefined` while it has no panel after it or no value. These values depend on the panel after the handle, and the first client render can come before the `setup` of that panel.
- A size in a length, such as `defaultSize="240px"` of a `Resizable.Panel`, has no percent on a server, because a server cannot measure the page. The part renders the length that it was given, as `flex: 0 1 240px`, until the first measurement, which comes after the mount. The other parts share the rest. The server HTML and the first client render are equal. A length that constrains the layout, such as `minSize`, applies from the first measurement.
- A node whose place the root reads from the page is not in the server HTML (the edge nodes).

The label of a root:

- A root with a label part calls `useLabelId()` of `src/utils/useRegisteredLabelId.ts`. The root binds `getAriaLabelledBy(attrs)` to `aria-labelledby`, in the `props` function that it gives to `useRenderElement`. It provides `labelRoot` in its context. `Fieldset.Root` names it `legendRoot`.
- The label calls `useRegisteredLabelId(() => props.id, labelRoot, () => element.value)` and binds the result to `id`. The result is the `id` prop, or the id that the root made.
- Each label has its own entry in the root. From the mount on, the entry gives the `id` that the element of the label has now (`VUE-121`). A label gives no id while `KeepAlive` holds it or while its element has an empty `id`.
- The root names the last label in the document that has an id (`VUE-131`). When that label unmounts, `KeepAlive` holds it, or its element gets an empty `id`, the root names the last label that stays. Before a label has an element, it counts in the order of the registrations. A move of the label elements with no other change does not update the order.
- A server render writes the attributes of the root before the `setup` of the label runs. The label cannot give its id in time for the server HTML. A root cannot defer for its label, because a deferral moves the attributes and the `setup` of the label together.
- Thus the root assumes a label until it is mounted. The server HTML has `aria-labelledby` with the generated id.
- This rule covers `Progress.Root`, `Meter.Root`, `Fieldset.Root` and `Slider.Root`.
- A root with a non-blank `aria-label` of the consumer assumes no label. The server HTML has no `aria-labelledby`. A root that has a label gets the id of the label when it is mounted.
- The first render in a browser makes the same assumption so its `aria-labelledby` matches the server HTML.
- `Slider.Root` is the exception while Vue hydrates it. The label of its field can come after the control, and a `Slider.Label` before it then gives another id in the first client render. `useRenderElement` gives that render the value of the server HTML.
- `labelId` of `useLabelId` is the id of the label that the root names, with no assumption. `legendId` in the context of `Fieldset.Root` is that id.
- After the mount, a root with no label has no `aria-labelledby`. A root whose label has an `id` prop has that id. Vue gives no warning, and the hydrated DOM is equal to a client-only render.
- Until the page hydrates, the server HTML of those two roots points at the generated id, unless the consumer gives the root a non-blank `aria-label`.
- No element has that id then. An `aria-labelledby` with no valid IDREF gives no name ([step 2B of the name computation](https://www.w3.org/TR/accname-1.2/#computation-steps)). Each of those roots thus has the name that it has with no `aria-labelledby`, as in Base UI.
- axe reports such an `aria-labelledby` as `aria-valid-attr-value` in its `incomplete` list, and not as a violation. `expectNoAxeViolations` reads only the violations.
- A user agent ignores an ID reference that matches no element ([WAI-ARIA 1.2, 8.6.1](https://www.w3.org/TR/wai-aria-1.2/#mapping_additional_relations_error_processing)).
- The assumption gives the server HTML of a `progressbar` or a `meter` that has a label its name (`VUE-89`). A page with no client code gets that name too. These roles require a name (WAI-ARIA 1.2: [`progressbar`](https://www.w3.org/TR/wai-aria-1.2/#progressbar), [`meter`](https://www.w3.org/TR/wai-aria-1.2/#meter)). Without a name, axe reports a serious violation, `aria-progressbar-name` or `aria-meter-name`.
- `Fieldset.Root` and `Slider.Root` have the role `group`, which does not require a name. The assumption gives the server HTML of each group the name of its label, when the label has no `id` prop.
- An `aria-labelledby` of the consumer on the root wins when it is not blank, because the attributes of the consumer merge last.
- Two labels with no `id` in one root get the same id. The root keeps that name when one of the two unmounts (`VUE-131`).
- `Slider.Root` is the exception, as in Base UI: its label always has the id `<id>-label`, and `<id>` is the `id` of the root. The root thus calls `createLabelIdRegistry()` and not `useLabelId()`. It assumes that id until it is mounted, under the rules above.
- `Select.Label` and `Combobox.Label` also have the id `<id>-label`, as in Base UI. The root of each family calls `createLabelIdRegistry()` and puts the registry in the context of its store. The trigger reads the registry and defers its server render, so it assumes no label.

The label, the control and the messages of a field:

- `provideLabelableContext()` of `src/internals/labelable-provider` makes the labelable context and provides it. A root that owns a control and its label calls it in `setup`, such as the root of a field and `Field.Item`. A label and a control in an item pair with each other and not with a control of another item.
- The provider makes one id, for the control. A control with no `id` prop takes that id. The label and the control then agree in the server HTML, in each order of the two parts. A label with no `id` prop makes its own id, so two labels in one provider have two ids.
- A control calls `useLabelableId({ id })` and binds the result to `id`. A label calls `useLabel({ element, native })`. A native `<label>` gets `for` with the id of the control. An element that is not a `<label>` gets a click handler that focuses the control.
- The click handler of a label that is not native finds the control by its id. In a field, that id is `controlElementId`. A click on `Field.Label` thus focuses a control whose `#render` slot gives another `id` (`VUE-118`). A `#render` slot can also give the element of a control an empty `id`, and a label with no field has no control id. `Select.Label` thus gives the trigger element of its root to `useLabel` as `controlElement`. The handler then focuses that element, and the id of the element does not matter. `Combobox.Label` does the same only while the input is inside the popup, because the input outside the popup is the control of a field. Base UI finds the trigger by an id. In a field, a click on its label thus focuses nothing when the `render` element of the trigger has another id than the control id (`VUE-116`).
- A `#render` slot can give the element of a part another `id` than the part gives. The parts of a field then name the `id` of the element (`VUE-118`). Base UI keeps the id of the part.
- A control gives its element to `useLabelableId` as `element`. A root gives a ref or a getter of the element of its child part. `Select.Root` gives the trigger. `useAriaCombobox` gives the trigger while the input is inside the popup, and the input at other times. `NumberField.Root` gives its input, `OTPField.Root` its first input, and `useDateTimeFieldRoot` its first segment.
- A checkbox, a radio or a switch gives its element only with `nativeButton`. Without `nativeButton`, the hidden input has the control id, and the part gives `null`.
- A label names `controlElementId` of the context. It is the control id when that id is `null`, when an element of a control has that id, or when no control element has an `id`. At other times, it is the `id` of the first control element.
- A control binds the control id, and not the `id` of its element. With the `id` of its element, a control would keep an `id` that its slot no longer gives.
- `useLabel({ element })` and `useRegisteredMessageId(id, element)` register the id with `useRegisteredId`. After the mount, that id is the `id` that the element has now. An element with an empty `id` registers nothing. A message with no id registers nothing, also while its element animates out.
- A control with an `id` prop has the id of the provider until the control is mounted. Then it registers a getter for its own id, and the label follows. With its own id from the start, the control would not match a label that comes before it.
- A label and a message register a getter for their id one time in `setup`. Each part that Vue renders after that `setup` has the id in the server HTML. `useLabel({ element })` registers the label. A message calls `useRegisteredMessageId(id, element)`. A message that can be hidden gives `undefined` as its id while it is hidden. `Field.Error` does this, so the control names it only while it shows.
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

A date or time field and the `Intl` data of the server:

- Each engine has its own `Intl` data for a locale. Chromium has no data for `is-IS` and uses `en-US`. The server and the browser then give another layout.
- A layout can differ in the order of the segments, in the number of segments, in the text of a literal and in the hour cycle.
- While the field hydrates, the part that renders the segments binds `data-allow-mismatch="children"` on `Input`, `attribute` on a segment and `text` on a literal. `useDateTimeFieldSegment` binds the one of a segment. Each part calls `useIsHydrating()` itself. `test/fixtures/DateTimeFieldProbe.vue` is the model.
- Vue changes the text of a literal itself. While it hydrates, it writes no attribute that a `v-bind` object or `h()` gives, but the `value` of an input. A server element that Vue reuses for another segment thus keeps its attributes. After the mount, the root compares these attributes with the DOM. On a difference, it makes the elements again.
- Vue lets `data-allow-mismatch="text"` allow the text of an element that has a string as its one child. It does not let the attribute allow a text node in a list of children, and a template gives the text of a dynamic element as such a node. `DateField.Literal` and `TimeField.Literal` thus render `DateTimeFieldLiteralElement`, which gives the text as a string with `h`.
- For a fragment with another number of items than on the server, such as the fragment of `v-for`, Vue logs `Hydration completed but contains mismatches` also under `data-allow-mismatch`. The test part renders the items of the layout as direct children of its input element, so it gives no such message.
- A template renders a list as a fragment, so `DateFieldInputChildren.vue` and `TimeFieldInputChildren.vue` give the fragment a fixed length: the limit of the family in `MAX_LAYOUT_LENGTH`, or more for a longer layout. Each item renders one part, or the comment of a `v-if` after the last part. The fragment then has the same length on the server and in the browser, and `data-allow-mismatch="children"` allows the difference of an item. The `Input` of each family renders the SFC in its element, and its `#render` slot gives the SFC as `children`. `segmentLayout.test.ts` proves each limit over the layouts of many locales and calendars.
- Do not bind the text of a literal as the prop `textContent`. Vue before 3.5.39 does not write that prop while it hydrates, so the text of the server stays.
- A field compares its layout after the mount, because a layout is a list of segments and literals that a few attributes cannot hold. The roots of Time Clock, Calendar and Range Calendar keep their few layout values in the server HTML with `useServerValue`, as the list of the hydration state says.

### What Vue replaces

- Keep reactive state with the instance that consumes it. A reader subscribes when it reads that state in a reactive effect.
- An external producer can publish commands through an imperative subscription. `createToastManager` notifies its subscribers when a caller uses `add`, `update`, `close` or `promise`.
- A popup store is `shallowReactive` state, selector functions and a plain `context`. Each root makes one. See [Popup store](#popup-store).
- `Teleport` puts the portal element, with the popup in it, into the container, except when `Dialog.Portal` has `disabled`. It has no `defer`, because the portal renders the `Teleport` after the mount, when the container exists. See [Popup portal](#popup-portal).
- Each context has a plain `Symbol()` key for `provide` and `inject`. Each copy of the library then has its own contexts.
- Only three registries are shared between copies, on `Symbol.for` keys: the scroll-lock count, the modal marks and the Escape stack.
- Each shared registry is a plain object with a `version` field. Fields are only added.
- Direction and CSP stay as `DirectionProvider` and `CSPProvider`. There is no global configuration provider.
- Read live state through its prop, ref or getter at the point of use.
- Give a reader a `Readonly<Ref<T>>` when it needs a ref. Replace the value of a shallow ref to notify readers of a new array.
- A reader that accepts a value, ref or getter takes `MaybeRefOrGetter<T>`. Read it with `toValue` when the operation runs. `focusTargetRef` of `useSetFieldFocused` accepts these forms.
- Provide a named action for a write that belongs to the provider.
- Clear a shared element only when the registration still holds the element of the departing part. A compiled template can mount a new part before it unmounts the part that it replaces. The old part then does not clear the element of the new part. `Dialog.Viewport` does this for the key `viewportElement` of the popup store.
- Keep pointer-session data local to the gesture unless another owner or a render needs it.
- A React synthetic event becomes the DOM event. `isReactEvent` of Base UI has no counterpart.

### Context of a root

A root gives values to its parts with `provide` and `inject`. Use `progress/root/ProgressRootContext.ts` as the model.

- Put the context refs and actions in a plain object.
- A field that the root computes is a `ComputedRef`.
- A field that the root writes is a `Readonly<Ref<T>>`. The root gives its `shallowRef`, and a part changes the value only through a function of the context.
- For a shared element, give consumers an action that registers or clears their element. Clear the registration only if the departing part still owns it.
- Keep one element ref only for a part that can occur once in a root. If a part can occur more than once, each instance registers a getter with a registry in the root context. Picker fields and triggers use `usePickerPartElement`.
- A part can then destructure the context in `setup` and keep reactivity. A part that reads one field renders again only when that field changes.
- The context file exports the key with the type `InjectionKey<Context>`. It exports `use<Root>Context()` beside the key.
- `use<Root>Context()` calls `inject(key, undefined)`. With one argument, Vue gives a warning of its own when there is no provider.
- When the result is `undefined`, the function throws an error that follows [Error messages](#error-messages).
- A context that a part can be without does not throw. `useCompositeListContext()` returns `undefined`, because an item with no list is valid. `useCompositeRootContext(true)` also returns `undefined`. `useRadioGroupContext()` and `useCheckboxGroupContext()` return `undefined`, because a radio or a checkbox with no group is valid.
- `useLabelableContext()`, `useFieldRootContext()` and `useFormContext()` return stateless defaults for optional readers.
- The default holds no state, because all apps and all server requests share it. Each value that a provider can change is a `computed` with a constant. Each function does nothing, or returns a constant, or returns its argument where the default of Base UI does. The default delay group is the exception, because the default context of Base UI holds state too. Only a mounted part writes it. See [Popup interactions](#popup-interactions).
- A field owns its focus and its validation input. Controls use `setFocusOwner` and `validation.setFieldInput`. A reader gets the current input from `validation.inputRef`.
- Base UI keeps three things in its default field and form contexts: the fields of the page that have no form, one focus owner and one input. Vase UI keeps none. With no form, `fields` is empty. With no field, `useSetFieldFocused` keeps the owner of its control.
- To test for a field or labelable provider, call `inject(key, null)`. A required field reader throws if the result is `null`.
- Name the action for the change the caller requests. Read a ref at the call when the action needs its current value.
- A component cannot `inject` a value that it provides. A root that needs its own context uses the object that the composable returns: `const labelable = provideLabelableContext()`.
- `DirectionProvider` provides a computed ref of the text direction. `CSPProvider` provides a computed ref of its `nonce` and `disableStyleElements` settings. Each composable returns the nearest provider's ref.
- Use one `ComputedRef` for a context that holds one changing value. `ScrollAreaScrollbarContext` gives each thumb the orientation of its nearest scrollbar.
- The context of Dialog is its store, as in Base UI. The root provides it, and `useDialogRootContext()` returns it. A part reads the state with `store.select(key)`. See [Popup store](#popup-store).
- `Accordion.Item` and `Collapsible.Root` use `useCollapsibleRoot` to provide the panel IDs, transition state and open request. The item checks its veto before it asks the accordion root to change the value. Each root checks its own veto before the model update.
- A root can provide `undefined` for the context of another family, to hide a provider above it. `ContextMenu.Root` does this for `MenuRootContext`, so its menu is not a part of a menu above it.
- A part that renders a root can give that root a host, when the root needs a value that it has no prop for. The part calls `provide` with an `InjectionKey` in `src/internals`, such as `RangeCalendarHostContext` and `DateTimeFieldHostContext`. The root calls `inject(key, undefined)` and works with no host. A host is internal, so it adds no prop and no event to the root.

### Dates and times

The date and time families call `Temporal` and `Intl` directly, through the functions of `internals/date-time`. They have no adapter and no provider.

- Tell the kind of a value with `kindOf` or `isKind`.
- Format a value only through `formatter()`. `Intl` gets a number, a zone and a calendar, and never a `Temporal` object.
- No module reads `Temporal` when it loads: no constant and no default of a prop. The first read is in a function that a part calls, after `assertTemporal` in `setup`.
- Compare two values with `compareDates`, `compareMoments`, `Temporal.PlainTime.compare` or `equals`.
- A `minDate` or `maxDate` that is a `Temporal.PlainDate` limits whole days. One with a time, such as a `Temporal.PlainDateTime`, is a moment. `compareMoments` compares two zoned values by the moment, also in two time zones, and any other pair by the wall clock. The `min` and `max` of a `datetime-local` input take the time of the limit. A least limit rounds up to the minute, or to the second when the field shows seconds, and a greatest limit rounds down, because the text of a value has no more than that unit and the step base of the input is its `min`. The message about a zoned value names a zoned limit in the zone of the value, and it rounds a least limit up to the minute. A field that shows no time compares days, so its root drops the time of a limit.
- Make an emitted value with `withDate` or `withTime`. `withDate` keeps the kind, the calendar, the time and the zone of the value. `withTime` keeps the kind, the calendar, the date and the zone.
- `displayCalendar` gives the calendar in which a part shows a value: the `calendar` prop, else the calendar of the value when it is not ISO, else the calendar of the locale. A year and month shows in that calendar only where the calendar has the same months.
- The locale gives only the calendar that a part shows. It never gives the calendar of a value. A part with no `modelValue`, `defaultValue` or `referenceDate` makes its value in the ISO calendar.
- The exception is such a part that makes a year and month, when its `calendar` prop names a calendar that has other months than ISO. The part then makes its value in that calendar, because an ISO year and month does not show in that calendar.
- Thus an empty year and month field in `fa-IR` shows Gregorian months and gives an ISO `Temporal.PlainYearMonth`. With `calendar="persian"` it shows Persian months and gives a Persian `Temporal.PlainYearMonth`. An empty date field in `fa-IR` shows Persian dates and gives an ISO `Temporal.PlainDate`.
- `today(timeZone)` gives today, and the `today` prop wins over it. The `timeZone` prop wins over the zone of a zoned value, and that zone wins over the zone of the runtime.
- A server cannot know the day of the visitor. With no `today` prop, a calendar root keeps the day of the clock of the server in the server HTML, with `useServerValue`. The first client render shows that day, so it equals the server HTML. After the mount, the root shows the day of the clock of the browser.
- When the clock picked the first page, that page then moves to the page of the day of the browser. The clock picked it when no `focusedDate`, `defaultFocusedDate`, value, `month` or `defaultMonth` gave the page. The move emits no event, because a client-only mount shows that page with no event. A day that had the focus before the hydration keeps the focus in the grid, and `autoFocus` focuses the day of the browser.
- The root of a calendar holds the focused day and the month of the page. Each part derives its page from these two values, and no part keeps a page of its own.
- The JSDoc of `calendarProps.ts` and `daySelection.ts` in `internals/date-time/calendar` gives the views of a calendar and the pages of each view. It also gives the value that takes the place of an empty value.
- A press on a year, or on a month in a calendar of days, changes the month of the root first, and then the view. When a listener cancels the change of the month, the view stays. A press on the month that the root has changes no month.
- A move to a page of another month waits for that month. The page then changes one time, and it stays when the consumer keeps its `month`.
- The comments of `useCalendarRoot` give the rules for the limits of `minDate` and `maxDate`. They give the rules for the first day of a page of weeks or days. They also give the rules for a `focusedDate` that the consumer changes, and for the focus after a change of the page.
- A new calendar or first day of the week gives the grid new elements. The data of the browser after a hydration is an example. When the focus then falls to the body, the day, month or year that had the focus takes it again. When that cell left the grid, the cell that has the tab stop takes the focus.
- `TimeClock.DayPeriod` renders nothing on a 24-hour face. When the hour cycle becomes 24 while the part has the focus, a `watch` focuses the range input of the face. This runs before Vue removes the element, so the focus does not move to `<body>` and a popup does not take it. `TimeClock.Root` holds that input as `inputElement` in its context, and `TimeClock.Face` writes it. A clock with no face has no such input, and the focus then moves to `<body>`.
- A part that removes its own focused element moves the focus to an element that stays, before the update. When no element stays, as in a calendar grid, the root focuses the new element after the flush. That move runs only when the focus is on `<body>`.
- Watch a `Temporal` prop by its text, not by its object. A consumer can make a new object for the same day in each render.
- A page that the user leaves stays in the pages that `Calendar.Months` renders until its animations end. It has `data-ending-style` and `inert`, and no tab stop. A new calendar or first day of the week, such as those of the runtime locale after a hydration, gives other pages for the same place. It is not a move, so no page stays and the side of the move does not change. The first page that moves to the day of the browser after a hydration is not a move either. Only the pages of days move: while the grid shows months or years, no page stays and the side is `none`.
- Make a list of days by adding days, and never by adding 24 hours. A change of the clock in a time zone then does not repeat a day and does not skip a day.
- A calendar root takes its selection from a function: `useDaySelection` for one day or a list of days, and `useRangeSelection` for a range. The selection owns the value, its events and the rule of a press. `useCalendarRoot` owns the focused day, the page and the keys.
- Give `views` to `useCalendarRoot` only for a root that has the views of months and years, such as `Calendar.Root`.
- Only the listeners and the selection of a root with `views` take the reasons of the views: `month-press`, `year-press` and `trigger-press`. A root with no `views`, such as `RangeCalendar.Root`, has the reasons that each root has, and reasons of its own, such as `drag`.
- Put each new reason that `useCalendarRoot` sends into `CalendarBaseChangeEventReason` or `CalendarViewChangeEventReason`.
- `RangeCalendar.Root` provides the context of `Calendar.Root`, so the parts of Calendar that read that context work in a range calendar. `RangeCalendar` exports them again. It has parts of its own for a day and for a day button, because their state has the range.
- A day button calls `useDayButton`, which gives it the name, the tab stop, the keys and the registration with the root. The button of a range gives it the listeners of the range in `extraProps`. A listener of `onClick`, `onFocusin` or `onKeydown` there replaces the listener of `useDayButton`, so it calls the root itself.
- A range in progress is in the value as `[start, null]`, so a controlled calendar shows it. The preview, a drag in progress and the range that Escape puts back are local state of the selection. A press that would make a range that is not valid starts a new range at the pressed day. A drag ends at the last day toward the pointer that makes a valid range.
- `RangeCalendar.Root` handles Escape, so the key works with the focus on each element of the calendar, such as a button that changes the month. It ends a drag, or else puts back the range from before the first press of a range in progress. The root prevents the key only in these two cases.
- A drag over the day buttons holds the pointer on the first button, which then gets each event. The button finds the day under the pointer with `elementFromPoint`. The click that follows a drag is not a press, and `takeClickSuppression` of the selection tells it. The release after Escape also clicks that button, so that click is not a press either. A move with no button pressed ends the drag at its last day, because another element got the release.
- `getSegmentLayout` gives the order of the segments and the text of the literals of a date or time field. It reads the parts that `Intl` gives for a fixed sample. The digits come from `Intl.NumberFormat`, and the padding and the placeholders come from the code.
- Before V8 15.5, `formatToParts` ends the process when the format of the locale has the year of the week, `Y` ([nodejs/node#67076](https://github.com/nodejs/node/issues/67076)). WebKit gives that year as a part of the type `unknown`. `resolvedOptions()` of such a format has no `year`.
- `getSegmentLayout` then takes the layout of the format with an era, and gives those options as `formatOptions`. It keeps the era only when the field needs one, or when the format with no era has one. The Chinese and Dangi calendars give `relatedYear`, so they keep their own layout.
- Call `formatToParts` with a year only with the `formatOptions` of a layout.
- Each date and time field root sets its hidden input ref during the patch. A consumer can read `inputElement` in its first root ref callback.
- A date or time field has a value only when each segment has a number.
- The numbers of an empty segment come from `referenceDate`, and then from today.
- A segment gives `field-sizing: content` in its style, so its box follows its text with no rule of the consumer. `useDateTimeFieldSegment` gives the declaration with the props of the element, so the `style` of the consumer wins over it. The `size` attribute stays, because it gives the width in an engine that has no `field-sizing`.
- The style of `TimeClock.Hand` and `TimeClock.Number` has only CSS variables: an angle and a ratio of the radius of the face. They set no position. The style sheet of the consumer places them, so the server HTML is exact. `time-clock/utils/clockGeometry.ts` turns a point of the face into an angle and a ratio. A press measures the radius of the outer ring from the boxes of the numbers.
- A picker root renders `Popover.Root` and no element. `useDateTimePickerRoot` of `internals/date-time/picker` gives it the value, the template of a new value, the rule `closeOnSelect` and the disabled state. It creates a registry for the fields and one for the triggers with `createPickerPartElements`. The open state stays in the store of the popover. A part of the picker reads that store with `usePickerPopup()`.
- Each field and trigger registers its element with `usePickerPartElement`. A part that `KeepAlive` holds gives no element. The root and the positioner use the first element in document order from each registry they read, including after a keyed move. While no element of a registry is in the document, the registry gives its first registered element. A picker of an app that mounts in a detached element thus keeps its field and its trigger.
- The picker root controls its fields, calendar and clock through `modelValue`. An empty field, single-date calendar or clock receives `null`. An empty range calendar receives `[null, null]`. The root chooses the template for a new value from the current value, the default value, the last nonempty value or the fallback, in that order. Fields and calendars use it for `defaultValue`. The clock uses it for `referenceDate`.
- A part gives each change to the root with its own `details` object, so a `details.cancel()` in `valueChange` of the root also stops the change in the part.
- A controlled field does not follow the reset of its form, so the field of a picker calls `useFormReset` with its hidden input. The root puts an uncontrolled picker back to its default value, with the reason `none`.
- The field roots get the value of a reset with the next render. The picker counts each reset so its field roots can identify that value change as a reset. `PickerResetCountContext` gives the count to a synchronous watcher in each field root. A field root then treats the change of its value in the next flush as the change of a reset: it clears the error of its field and starts no validation. This holds when the field of the picker hears of the reset first or last, and for a picker with more than one field.
- The `closeOnSelect` of `DatePicker.Root` is `true` for a value with no time and `false` for a value with a time. The calendar reports each accepted selection to the picker, including a press on the selected day. With `closeOnSelect`, the picker requests a close with the reason `imperative-action`. A canceled selection keeps the popup open.
- A picker popup gives `usePickerInitialFocus` to `Popover.Popup` through `initialFocus`. Its default is the first connected target in document order. A held part gives no target. The calendar gives the day, month or year cell that has the tab stop in its current view. Without a target the picker uses the default of `Popover.Popup`. The consumer can give a focus target or turn initial focus off with `false`. An omitted value, an empty ref, `true` or `null` uses the picker default. A function can return `true` or `null` to ask for that default.
- `Alt` with `ArrowDown` opens the popup from the field, as a press of the first trigger does. The segment ignores a key with `Alt`, so the key reaches the field. A disabled or read-only picker opens no popup: its trigger is disabled, and its field ignores the key.
- A portal preserves the component ancestry of the popup. The popup time field provides `null` for `FieldRootContext` and creates its own labelable context. Its control and label belong to that scope.
- A part of a picker that renders a field root declares the `aria-*` props of that root: `DatePicker.Field`, `DatePicker.TimeField`, `DateRangePicker.StartField`, `DateRangePicker.EndField` and `TimePicker.Field` declare `ariaLabelledby`. TSX then takes `ariaLabelledby` on the part, as on the root.
- A range picker holds one range, the first end and the last end, and an end is `null` while it has no value. Its start field and its end field are each controlled with one end. A change of one end gives the root the range with that end changed. The two fields call `useFormReset` for the same `reset` event, so the root handles the first call only.
- A `Field` has one control that its label names, so the end field of a range picker provides a labelable context of its own. The label of the `Field` names the picker, so it joins the name of each field, as in React Aria. The group of a field has an `id` from `DateTimeFieldHostContext`, and its `aria-labelledby` holds that `id` and the `id` of the label. The name is then the `aria-label` of the group and the text of the label. A name that the consumer gives with `aria-labelledby` replaces both. The descriptions and the errors of the `Field` still reach the end field.
- A range with no end gives no kind to a new end, so the template of a range picker skips it. The `isEmpty` parameter of `useDateTimePickerRoot` says which values are empty.
- The calendar of a range picker renders `RangeCalendar.Root`. The first press makes a range with one end, so the popup stays open. The popup closes after a press or a drag that makes a range with two ends, unless `closeOnSelect` is `false`. `closeOnSelect` is `true` by default, also for a range with a time, because the popup has no part for a time and the user sets a time in a field. A key that extends the range does not close the popup, because the user can extend it more.
- A drag that makes the range that the picker already has gives no change, so no `valueChange` closes the popup. `useRangeSelection` thus calls `onSameRange` of the host that the calendar of the picker provides with `RangeCalendarHostContext`, and the picker closes the popup as it does after a change. The host is internal: `RangeCalendar.Root` has no prop and no event for it.
- The end field of a range picker has the later of `minDate` and the first end of the range as its `minDate`, and `laterMinimum` picks it. A value before that limit makes the field invalid, as each `minDate` does: its hidden input gives `rangeUnderflow`, or a `customError` for a zoned value. A field that shows a time compares the time too. The start field has no limit from the last end.
- `DateRangePicker.Positioner` anchors to a virtual element that has the box around the two fields, so `align` lines the popup up with both fields. With one field it anchors to that field, and with no field it anchors to the trigger.
- Escape in the calendar of a range picker acts as in `RangeCalendar.Root`: it puts back the range from before the first press of a range in progress. The key still reaches the popup, because `useDismiss` does not read `event.defaultPrevented` for Escape. The popup thus closes at the same key, also when the focus is on a button of the calendar that is not a day.
- The root of a time picker gives `hasTime` of `useDateTimePickerRoot` a function that gives `false`, because a pick sets the time itself. `closeOnSelect` is thus `true` by default for the list and for the clock. A press on a time of the list closes the popup, and so does the commit of the last view of the clock. A column reads `closeOnSelect` of the root with the default `false`, because the user sets more than one unit.
- `TimeClock.Root` types the details of `viewChange` on their own, with the reasons `trigger-press`, `drag` and `keyboard`, because a press on a view trigger changes the view and never the time. The details of `valueChange` have only the reasons that change the time, so `TimePicker.Root.ChangeEventReason` has no `trigger-press`.
- `TimePicker.Clock` passes its current view to `TimeClock.Root`. A defined `view` prop controls the view. An uncontrolled clock starts at `defaultView` each time the popup opens, even when the clock stays mounted. The last view has no next view for the `granularity` of the picker.
- The list and column register the selected enabled option or the first enabled option. The clock registers the range input of its face. The first target in the document takes the focus, so the first column takes it and not a column after it. A popup that stays mounted keeps the tab stop of a list or a column where the user left it, and a composite cannot move the tab stop while the popup is hidden. The first tabbable element can thus be an item that is not selected.
- A column and the clock set a unit of the time with the functions of `time-clock/utils/clockViews.ts`, so an hour of a 12-hour cycle keeps its day period, and `minTime` and `maxTime` disable a value that has no time in the limits. A column starts from `time` in the context of the root, which is the time of the value, or the time of the reference date while the picker has no value.

### Popup store

`usePopupRoot` owns the shallow reactive state of each popup in `src/utils/popups/usePopupRoot.ts`. `tooltip/root/TooltipRoot.vue` and `tooltip/trigger/TooltipTrigger.vue` are the models of a popup root and a popup trigger.

- `ReactiveStore` holds `state`, `context` and the selectors. `state` is a `shallowReactive` object. `context` is a plain object for the values that no part renders, such as a callback or a map.
- A selector is a plain function of the state: `(state, ...args) => value`. `store.select(key, ...args)` calls it with the reactive state.
- A root or trigger reads the owner refs in setup. A handle reader can use a parameterized selector such as `isOpenedByTrigger`.
- A `select` call in a render function makes the part render again on each change of a key that the selector reads.
- A selector of a child store can read the store of its parent. A `computed` that reads the selector follows the parent, so the child store needs no subscription.
- A selector that reads a property of an element in the state, such as its `id`, does not follow a change of that property. A key of the state thus holds the value, and the selector reads that key.
- The id of the popup element can come from a prop, an attribute or the `#render` slot of the popup part, so the part does not write that key. `BasePopupStore` copies the `id` of a new popup element to `popupElementId`. A `MutationObserver` copies each later change of the attribute. The selector `popupId` reads that key. The selector gives no id while no popup element exists, and while the element has an empty `id`. A trigger thus names only a popup that is in the document (`VUE-73`). Base UI gives the default id of the popup while no popup element exists.
- The id of the list element of Select and Combobox is the same kind of id. It can come from the root, an attribute or the `#render` slot of `Select.List` or `Combobox.List`. `ValuePopupStore` copies it to `listElementId` in the same way. The root of Combobox reads that key for the `aria-controls` of `Combobox.Input`.
- The id of the list element of Menu is the same kind of id. It can come from the `id` prop or the `#render` slot of `Menu.List`. `MenuStore` copies it to `listElementId` in the same way, and the selector `triggerControlsId` reads that key for the `aria-controls` of the trigger (`VUE-117`). While the list has an empty `id`, the trigger names the popup. Base UI calls `store.notifyAll()` when the `id` prop of the list changes.
- `NavigationMenu.Root` has no store. It gives the `id` of `popupElement` and of `shownViewportElement` to `popupElementId` and `viewportElementId` of its context with `useElementId`. The active trigger reads them for its `aria-controls` and for the `aria-owns` of the owner element after it (`VUE-86`).
- The list of a filterable menu gives its element to `listElement` of the context of the filter root, not to the store. `useFilterDropdownRoot` reads the `id` of that element with `useElementId`, and `Menu.Input` names it in `aria-controls`. The input has no `aria-controls` while no list element exists, and while the element has an empty `id` (`VUE-117`). Base UI gives the input the default id of the list while no list is mounted.
- The id of the highlighted item of a menu with virtual focus is also such an id. It can come from the `id` prop or the `#render` slot of each item part. `MenuStore` copies it to `highlightedItemId` in the same way when `highlightedItem` changes. The selector `highlightedItemId` reads that key for the `aria-activedescendant` of `Menu.Input` (`VUE-111`). Base UI reads the `id` of the element in that selector.
- `Combobox.Item` gives its element to `highlightedItem` of `ComboboxStore` while it is highlighted. The store copies the `id` of that element to `highlightedItemId` in the same way, and the root gives that key to `useListNavigation` for `aria-activedescendant` (`VUE-125`). The item clears the key only while the key holds its own element, because the next highlighted item can write the key first. Base UI names the id of the root plus the index of the item.
- Make such an observer with `createElementIdObserver` of `src/utils/popups/usePopupRoot.ts`.
- Code in the `setup` of a part or of a root calls `useElementId` of `src/utils/popups/useElementId.ts`. It gives a ref of the `id` of the element that a ref holds. The ref follows a change of the element and each change of the attribute. The observer stops when the part or the root unmounts. A part that renders the `id` of the element of another part reads this ref, because a render does not follow a read of the DOM.
- The part of Menu that has the `menu` role and `NavigationMenu.Popup` take their name from the active trigger. The `id` of that element can come from the `id` prop, from an attribute or from the `#render` slot of the trigger. `useMenuRoot` gives `popupLabelId` of the root context from `useElementId`, and `NavigationMenu.Popup` calls `useElementId` for its trigger. The name thus follows each change of the `id` (`VUE-109`). Base UI reads the `id` of the element when a part of Menu renders.
- The popup of Dialog, Alert Dialog, Drawer and Popover takes its name from the title part and its description from the description part. The `id` of their element can come from the `id` prop or from the `#render` slot of `Dialog.Title`, `Dialog.Description`, `Popover.Title` or `Popover.Description`. Each of these parts registers its id with `useRegisteredId`, which reads the `id` of the element, so `aria-labelledby` and `aria-describedby` of the popup follow each change (`VUE-119`). A part whose element has an empty `id` registers no id. Base UI registers the `id` prop of the part, or its generated id.
- `Select.Trigger` and `Combobox.Trigger` name a list or the popup. They read `listElementId` for the list and `popupId` for the popup (`VUE-86`). While the list has an empty `id`, the trigger has no `aria-controls`.
- Write with `set`, `update` or `setState`. Snapshot the changed keys before the first write. Write `open` and `openProp` last so a synchronous open watcher sees the new trigger and reason.
- Vue has no public batch for writes. A watcher with the default flush runs one time for an update of many keys. A watcher with `flush: 'sync'` runs after the write of each key, so it can read a state that is not complete.
- A function that a render function, a ref callback or the cleanup of a `watch` calls reads `toRaw(store.state)`. That read adds no dependency. Vue runs the cleanup of a part in the render of its parent when the part unmounts. The write methods of a store read the state in this way.
- Read the effective `open` ref, also in a handler. A controlled root can hold a different request in its shallow state. On release, the open state takes the last value of the prop.
- The state keeps each value as it is: an object, an element, a ref. Do not hold a payload in `ref()` or `reactive()`.
- A store, the trigger map and the hover intent have ECMAScript private members, such as `#openSession`. A method that reads or writes a private member throws a `TypeError` when it runs on a reactive proxy of such an object. Give a store to other code with `provide`, a `shallowRef`, a `computed` or a prop. Do not put a store, or an object that holds one, in `ref()`, `reactive()` or `readonly()`.
- `NullStore` is a store that takes no write. Give it a frozen state and a frozen context. Vue does not make a frozen object reactive. Code that all apps and all server requests share, such as a handle, holds only such a store.
- A root attaches its store to its handle in one `watch` with a callback and `flush: 'post'`. The source of the `watch` is `undefined` while a flag is `false`. `setup` sets the flag directly after the `watch` call, so the first run is a post-flush job of the mount. `attachStore` returns the function that detaches the store. The root keeps that function, and calls it when it detaches or attaches to another handle.
- The first run comes before the `onMounted` hook of each part below the root, so such a hook can call the handle. Vue holds that run for a root in a pending `<Suspense>` branch, and a branch that Vue drops never attaches (`VUE-64`).
- A server runs no such `watch`, so a server render writes nothing to a handle that all requests share. Do not attach in `setup` or in `onBeforeMount`. A call of the handle in `setup` or in `onBeforeMount` of a part below the root comes before the attach. The handle then ignores the call and warns in a development build, unless an older root is attached. That older root gets the call. A root that `KeepAlive` holds and whose store is detached keeps such a call, as a bullet below says.
- A root can call a listener of the consumer when its props change. The close of a disabled root does this. The call runs in `onMounted` and in a `watch` with no `immediate`, so a server render calls no listener.
- A trigger that has a handle resolves its owner with `useTriggerOwner` in `setup`. The result is the inert store of the handle while the trigger hydrates, and then the store that the handle points at. The server renders the trigger from the inert store. A root can attach before a trigger in an async `<Suspense>` branch hydrates. With the root store, the first render of that trigger can differ from the server HTML. `useRenderElement` can correct only `role`, `abbr`, `data-*` and `aria-*` except `aria-hidden`. Vue warns if `disabled` differs and keeps the server value. A class or style that a consumer derives from the state behaves the same way. Slot content from that state can also cause a hydration warning.
- A family makes a subclass of `BasePopupStore`. The subclass overrides only the steps where it differs: `isOpenChangeIgnored`, `getCloseTrigger`, `prepareOpenChange`, `prepareUnmount` and `anchorsToActiveTrigger`.
- A family store keeps a timer of its own in `context` as a `Timeout`. Its root clears the timer in `onScopeDispose`.
- A family that picks a value from a list makes a subclass of `ValuePopupStore` from `utils/popups/value-popup`. The subclass gives `getAnchorElement`. The store writes that element to `anchorElement` in each write that changes the anchor, the open state or the positioner element.
- A selector of a family that replaces a selector of `popupStoreSelectors` has the parameter type `PopupStoreState<unknown>`. With the state type of the family, the store does not fit a root composable.
- `BasePopupStore` has no `isCommittedSynchronously` step, because Vue has no `flushSync`. A caller that reads the DOM after `setOpen` awaits `nextTick()`.
- A function that works with the store of any family types its parameter as `PopupTriggerDataStore<State>`, or as a `ReactiveStore<State, PopupStoreContext<never>, PopupStoreSelectors>` plus the members that it calls. A parameter of the type `BasePopupStore<…>` refuses a family store with other change event details. It also refuses a family store with a step that returns only keys that the family adds.
- A part with no popup store calls `useFloatingRootStore` in `setup` and gives it `open`, because `setOpen` of the store only calls `onOpenChange`.
- `getEmptyRootStore()` gives a closed `NullStore`, so a module that all requests share can hold it.
- Take the innermost registered trigger that contains an event target, because an inner trigger can register after its outer trigger.
- Pass the id, current store and payload getter to `usePopupTrigger`. Bind its `registerTrigger` action as the element ref.
- A trigger of a family with a popup tree, such as `Menu.Trigger`, forwards `parent`, `floatingTreeRoot`, `floatingNodeId`, `floatingParentNodeId` and `keyboardEventRelay` with its payload. A trigger with no tree above it makes a tree of its own, one time in `setup`.
- The registration of the active trigger gives its element to the store, and its data while the popup is open. A new trigger can claim an open popup when `canClaimOpenPopup` permits it. A parent that supplies a null `triggerId` keeps the popup without an active trigger (`VUE-142`). Releasing that prop keeps the current popup without an implicit trigger. The popup then gets the element and the data of that trigger. A trigger that mounts in a held branch claims no popup. Its activation also claims no popup, because the root picks the trigger (`VUE-22`).
- `KeepAlive` leaves the entry of a trigger in its place. A `watch` of `isHeld` of `useKeepAliveState` calls `setActive` of the trigger map. Each reader of the map then skips the entry while `KeepAlive` holds the trigger. A trigger that mounts in a held branch adds an entry that the readers skip until the activation.
- When `isHeld` changes, update the entry only if the trigger still owns that id. Keep `triggerCount` current. After activation, the active trigger gives its data to the store again.
- Pass getters for the trigger and popup attributes and listeners to `owner.bindParts`. Each part reads the computed result.
- A public `handle.store` read exposes writable copies of `activeTriggerProps`, `inactiveTriggerProps` and `popupProps`. The root clears these copies on disposal.
- A family owns its other bindings, such as the item and input props of Menu.
- A root calls `usePopupRoot(props, createStore, options)`. Its refs supply the open state, active trigger, popup element, mounted state, transition and payload. Call `requestOpen` with the event details. Expose the root actions to the consumer.
- The roots of Dialog, Alert Dialog and Drawer share `useRenderDialogRoot` in `dialog/root`.
- Drawer shares `DialogStore`, and the `setOpen` of that store accepts only the reasons of Dialog. For `swipe` and `close-watcher`, a Drawer part calls `setOpen` of `DrawerRootContext`. A caller of `setOpen` omits `preventUnmountOnClose`, because the store adds that method before the emit.
- A popup part gives `popupElementTarget(store)` to `createElementSetter` in `setup`. The target writes `store.context.popupRef` before the store key `popupElement`. `tooltip/popup/TooltipPopup.vue` is the model. A list part uses `stateElementTarget(store, 'listElement')` for a store key. A filterable list gives the setter the `listElement` ref of its root context.
- `createElementSetter` clears the target only while it holds the element of its own part. By default the setter clears it when `isHeld` becomes `true` and gives the current element when `isHeld` becomes `false`. The default target gets a new element of a held branch at activation, even when the part mounts there. A trigger or input thus omits the id of an element that `KeepAlive` took out of the document (`VUE-73`).
- Set `keepWhileHeld: true` only when a reader needs the element of a held part. Name the reader in the JSDoc of the target. Supply a second target in `kept` when only that reader needs the held element. For a popup part, `kept` is `store.context.keptPopupRef`.
- `NavigationMenu.Content` stays in its viewport while `KeepAlive` holds the viewport. The setter keeps `viewportElement` for content in a positioner and `viewportTargetElement` for content in an inline viewport. The setter for `shownViewportElement` takes the default. The owner element after the active trigger then has no `aria-owns` while the viewport is held. The trigger also needs the held `positionerElement`, because `null` selects the behavior of a menu with no positioner.
- A backdrop part sets `keepWhileHeld: true` for `store.context.backdropRef`. `NavigationMenu.Backdrop` does the same for `backdropElement` of its root context. The animations of the backdrop end an open change while the popup and the positioner give no element. A backdrop that first mounts in a held branch can then end a close on its own. `Menu.Backdrop` uses the default for the `backdropRef` of `ContextMenu.Root`.
- `useImplicitActiveTrigger` keeps the trigger map and the state in step after each DOM update. It does not run while `KeepAlive` holds the root, also from a mount in a held branch to the activation. With `closeOnActiveTriggerUnmount`, the popup closes with the reason `none` when the active trigger unregisters. The close waits one microtask, so that a trigger with the same id can register first.
- When several triggers join an open popup that allows an implicit trigger and none claims it, the root picks the first trigger of the map that is in the document. The result is the same as at the mount. `KeepAlive` runs the hooks from the last part to the first part, so a claim by each trigger would pick the last trigger.
- `KeepAlive` detaches the store of a deactivated root from its handle. The store attaches again at the activation.
- A root that mounts in a held branch also attaches in the first run of the `watch`, so an `onMounted` hook of a part below it can call the handle. The `onMounted` hook of the root comes after those hooks. When `isHeld` of `useKeepAliveState` is `true` in that hook, the root detaches the store directly. A detach in a `watch` job comes too late. The post flush runs such a job in a later pass, after the watchers of a detached trigger, and the trigger then registers in the store of the held root.
- At the activation, a `watch` of `isHeld` with `flush: 'sync'` attaches the store of a mounted root directly. In the flush that mounts the root and shows its branch, the activation can come after the detach of `onMounted`. The `watch` of the handle then gets the same handle as in its last run and does not run its callback.
- A root in a pending `<Suspense>` branch below a `KeepAlive` can get its activation before its mount. Only the `watch` of the handle attaches such a root, when Vue resolves the branch (`VUE-64`).
- A part can mount below a root while `KeepAlive` holds the root and its store is not attached: below a deactivated root, below a root that mounted in a held branch, and below a root whose pending `<Suspense>` branch resolves while `KeepAlive` holds it. A call of the handle in a hook of such a part does not reach the store at once. The root keeps the call. At the activation, after the attach, the `watch` of `isHeld` queues each kept call in a microtask of its own. A microtask runs after the flush, when the trigger map does not skip the triggers of the root. Base UI runs the effects of such a part when `Activity` shows the tree, after the root attaches.
- `openByTrigger` and `closePopup` of `BasePopupHandle` call `deferToHeldRoot` first. It finds the nearest popup root above the caller with `inject` of `HeldRootCallContext`, which `usePopupRoot` provides. A root takes only a call of its own handle while its store is detached, and it gives a call of another handle to the root above it. A call with no current component, such as a call in an event handler, gets no root, because `hasInjectionContext()` is `false`. A method that a family handle adds, such as `openWithPayload()` of `DialogHandle`, also calls `deferToHeldRoot` first.
- The kept call runs the method of the handle again. It thus reaches the newest attached root, as the effect of the part does in Base UI.
- A root of a popup with one anchor and no trigger registry, such as Select and Combobox, calls `useSingleAnchorPopupRoot(props, createStore, options)` in `setup`. The root has one trigger element and no handle.
- The animations of one element end each open change of a popup root. `getPopupTransitionElement` checks the popup, the positioner, the backdrop and then `keptPopupRef`. `options.getTransitionElement(store)` of `usePopupRoot` and `useSingleAnchorPopupRoot` gives another element than the default. The root emits `openChangeComplete`, and a popup part emits none.
- A single-anchor root uses the same `requestOpen` and `bindParts` actions. Its trigger reads the owner from context.
- A root can derive a field from a value that a part writes in its `ref` callback or in `onMounted`. Keep the initial field value until mount when the server cannot get that input. Combobox does this for `inputOwnsFormValue` so its server HTML has one named input.
- A part writes a key in `onMounted` when a part after it renders an attribute from the key. It does not write such a key in its `ref` callback. Vue calls the `ref` callback while it hydrates the element, before it hydrates the later part. A write in the callback can make the first render of the later part differ from the server HTML. `Combobox.Input` writes `inputInsidePopup` in `onMounted`. `Combobox.Trigger` reads that key for `tabindex` and `id`, outside the [hydration check of `useRenderElement`](#userenderelement-and-userender). Vue compares both attributes, warns if they differ, and keeps their server values. A client-only mount renders the later part again in the flush after the mount, before a paint.
- `usePopupRoot.ts` has `usePopupRoot`, `useSingleAnchorPopupRoot`, `useImplicitActiveTrigger`, `usePopupRootSync` and `getPopupTransitionElement`.
- `usePopupRootSync(store, open)` clears `openMethod` of the store when `open` becomes `false` and when the root unmounts. A root that `KeepAlive` holds keeps `openMethod`. A root that writes `openMethod` with `useTriggerModality`, or whose trigger does, calls it in `setup`. `useOpenInteractionType` clears its own `openMethod`, so a root that uses it does not.
- `types.ts` has a part of the types of Base UI. The pull request that first needs a type adds it.

### Popup tree

A popup tree holds one node for each popup below one root. The code is in `src/utils/popups/tree`.

- `provideFloatingTree(externalTree)` and `provideFloatingNode(id)` of `tree/FloatingTree.ts` replace the components `FloatingTree` and `FloatingNode` of Base UI. The JSDoc of each function of that file gives its result.
- `provide` follows the components and not the DOM. A part in a `Teleport` thus gets the tree and the node of the part around it.
- `inject` gives a part the tree and the node of the part above it, also when the part provides a tree or a node itself.
- The tree that a part provides can change. `useFloatingTree()` then gives the new tree at once. Each node below moves to it with its `context` in the next flush. Read `.value` of the tree in a handler, a hook or a `watch`. Do not keep the store in a variable of `setup`. `FloatingTree` of Base UI keeps the tree of its first render.
- A part that listens to an event of `tree.events` adds its listener in a `watch` that has the tree as a source and the option `immediate`. The cleanup of the `watch` removes the listener, so the part listens to the new tree after a change. `Menu.Positioner` and `Menu.Popup` do this.
- Base UI sometimes calls a hook in a component below the `FloatingTree` of the same file, as `PopoverRoot.tsx` and `Menubar.tsx` do. Give the result of `provideFloatingTree()` to that composable as `externalTree`.
- A root that starts a tree only when no root of its family is above it reads its own context with `use<Root>Context(true)` before it provides the context.
- Such a root calls `provideFloatingTree()` only in that case. A root inside another root then uses the tree of the outer root. `preview-card/root/PreviewCardRoot.vue` is the model.
- The nodes are in the order of those hooks: a node comes before the nodes below it. In Base UI, it comes after them. Find a node by its id. Do not use its position in the list.
- `KeepAlive` leaves a node in its place. While the part of the node is deactivated, the `context` of the node is `undefined`. The `context` is also `undefined` from the mount of a part in a held branch to its activation. `getNodeChildren` then does not count the node as open. `removeNodeContext(node, context)` removes `context` from a node, also while the part of the node is deactivated. It keeps the context of another popup. Do not compare `node.context` for this, because a deactivated part hides it.

### Popup positioning

The positioning of a popup is in `src/internals/useAnchorPositioning.ts` and in `src/utils/popups/positioning`.

- A positioner part of a popup family calls `usePopupPositioner(store, props, options)` in `setup`. It takes the reactive props of the part, so do not destructure them. The result has `element`, `elementProps`, `state`, `positioning`, `open` and `mounted`.
- `usePopupPositioner` calls `useAnchorPositioning`, `useVaseUIFloating` and `usePositioner`. `options.positioning` replaces the positioning parameters that come from the props. It can also have `nodeId` and `externalTree`.
- A part that registers a node in the popup tree calls `useFloatingNodeId()` before `usePopupPositioner`, and gives the id as `positioning: { nodeId }`. The positioning context then finds the node. `Tooltip.Positioner` registers no node, as in Base UI.
- Where Base UI renders `FloatingNode` around the positioner, the part also calls `provideFloatingNode(nodeId)`. A popup below the part then registers its node as a child of this node. `preview-card/positioner/PreviewCardPositioner.vue` is the model.
- `nodeId` and `externalTree` are each a value, a ref or a getter. A part whose popup can move to the node of another part gives getters. The context then moves to the new node, and the old node loses it (`VUE-43`).
- A `NavigationMenu.Positioner` that mounts open has `data-instant` until a 0 ms timer ends. When the positioner mounts in a held branch, that timer starts at the activation.
- A positioner part that `usePopupPositioner` does not fit calls `useAnchorPositioning`, `useVaseUIFloating` and `usePositioner` itself. `test/fixtures/PositionerPart.vue` is the model for `useAnchorPositioning`.
- Bind `positionerStyles` on the positioner. For item alignment, `Select.Positioner` binds `positionerCssVars` with its own coordinates. The size middleware waits for Vue to apply the variables before it measures the box again. When the switch from fixed to absolute positioning changes the offset parent, Floating UI computes the coordinates again before paint.
- `Select.Popup` records the pinned edge when it aligns an item. It reads the new scroll range after the positioner applies its height.
- The Navigation Menu root holds the popup size and the target size of the positioner. Each part binds its own dimensions. When the active item changes, its trigger measures the previous content before Vue patches it.
- A positioner part provides the `positioning` of the result as the context of its popup and its arrow. `tooltip/positioner/TooltipPositioner.vue` is the model.
- The positioning context is `store.context.positioning`. The JSDoc of `PopupPositioningContext` in `utils/popups/types.ts` gives its members, and the comments of `useVaseUIFloating` say when the composable writes it.
- `useVaseUIFloating` writes the context in `onBeforeMount`, unless `KeepAlive` holds the part. A server render thus writes nothing, and each part below a positioner that is not held finds the context in `setup`.
- The composable removes its context from the store and from the node when the part unmounts, and while `KeepAlive` holds the part. A part that mounts in a held branch writes its context at the activation (`VUE-43`). The composable never removes the context of another positioner. The tree hides the context of a node while its own part is deactivated, and from a mount of that part in a held branch to its activation.

### Popup viewport

The viewport of a popup, in `src/utils/popups/viewport`, shows the old content while the popup moves to another trigger.

- A viewport part calls `usePopupViewport({ store, side })` in `setup` and gets `state`.
- The template of `PopupViewportChildren.vue` gives the two containers. The comments of `usePopupViewport.ts` and `usePopupAutoResize.ts` give the clone of the old content and the resize (`VUE-88`).
- The viewport waits for its own enter phase after the DOM patch. An animation wait on a consumer marker observes the attribute on its element.
- The viewport publishes the measured dimensions for the popup and positioner to bind. The popup binds the anchor edges for its side. Deactivation clears the viewport’s edges before ancestor hooks run. Temporary styles expose both intrinsic sizes in one layout read.
- When the viewport detects a KeepAlive hold, it stops measuring and ends the current morph. A live popup releases the size bindings of its held viewport. A detached popup keeps its last dimensions. The active viewport publishes its bindings again when it returns. A viewport that detects the hold at mount first measures on activation. See [Vapor mode](#vapor-mode) for held mounts in compiled parts.

### Focus helpers

The focus helpers of a popup are in `src/utils/popups/focus`.

- `FocusGuard.vue` is the guard that a focus trap puts at the edge of its content. It gives the attributes and listeners of a consumer to its `span`, and it exposes its element as `element`. In WebKit on an Apple system, a guard has `role="button"`. The comments of `focusGuardAttributes.ts` say why.
- A trigger that Base UI gives focus guards beside its element does not write them in its template. `NavigationMenu.Viewport` in a positioner also does not write its two inside guards in its template. The focus manager of a popup part also does not write its two inside guards in a template. Guards in the template would give the part more than one root node. [Parts with a hidden input](#parts-with-a-hidden-input) gives the effects.
- These parts make their guards with `createFocusGuardElement(document)` and give them to `useElementSiblings(element, siblings)`. The composable keeps the nodes before and after the element in the DOM. `NavigationMenuTrigger.vue` is the model.
- Vue does not know the nodes of `useElementSiblings`. The comments of that composable say how a `MutationObserver` keeps the nodes beside the element, and when the composable removes them.
- `createFocusGuardElement` makes the element of `FocusGuard.vue`. Both read the attributes of a guard from `getFocusGuardAttributes` of `focusGuardAttributes.ts`. Do not write these attributes in another place.
- `KeepAlive` moves only the element out of the document. The observer moves the nodes with it, and the same nodes come back at the activation.
- A popup trigger that has focus guards calls `useTriggerFocusGuards(store, element, enabled)` of `src/utils/popups`. While `enabled` is `true`, the composable keeps a guard before and after the element with `useElementSiblings`. `MenuTrigger.vue` is the model.
- The comments of `useTriggerFocusGuards.ts` say where each guard sends the focus. The rows `VUE-66`, `VUE-69` and `VUE-107` of `parity/better` give the tab order of a popup that stays open, and the Tab key in a menu.
- While `KeepAlive` holds a popup, the inside guards of the popup are not in the document. This is also true for a popup that mounts in a held branch. A browser does not focus such an element. The guard after the trigger then skips the popup, as the Tab key skips a popup with no tabbable element (`VUE-120`).
- A focus from the trigger, or from no element, then leaves as from the end of the popup. The guard asks for the close and focuses the next tabbable element. A focus from another element goes to the trigger, and the guard asks for no close.
- An active `NavigationMenu.Trigger` keeps a guard before and after its owner element. The same rule applies to them while `KeepAlive` holds the viewport. The guard before the owner element then focuses the next tabbable element after the trigger. It closes the item as an exit from the end of the viewport does. The guard after the owner element focuses the trigger (`VUE-120`).
- An open root can have no popup part, and an open Navigation Menu can have no viewport. Such a root has no inside guards, and its store can have no positioner element. The rules of the three items above apply to it (`VUE-132`).
- `KeepAlive` can hold a popup and not its portal part. The outside guards at the place of `FloatingPortal` then skip the popup in the same way (`VUE-120`). The first guard focuses the tabbable element after the last guard and asks for the close when `closeOnFocusOut` is `true`. The last guard focuses the tabbable element before the first guard and asks for no close. When no other element is tabbable, the guard focuses the reference of the focus manager.
- The focus manager keeps the registered popup accessible when its slot places it outside the positioner.
- The popup part gives the focus manager the guard before the trigger in `getInsideElements`, and the guard after the trigger as `nextFocusableElement`. It gives functions that read the refs, because the trigger writes the refs after the popup opens. It also gives the two refs of the store context for the inside guards. `MenuPopup.vue` is the model.
- `useFloatingFocusManager(props, element)` of `FloatingFocusManager.ts` moves the focus into a popup when it opens, and it returns the focus when the popup closes. It keeps the Tab key in a modal popup. A popup part calls it in `setup`, after `useRenderElement`, with a getter of its props and its `element`.
- Each prop takes its default only when its value is `undefined`, as `withDefaults` does. `null` has its own meaning for `openInteractionType` and `returnFocus`.
- The JSDoc of each prop of `useFloatingFocusManager` gives its forms and its default. The comments of `FloatingFocusManager.ts` give the initial focus, the return of the focus, the close for a focus outside the popup, and the context that each focus manager gives to the focus managers below. The comments of `markOthers.ts` give the marks on the other elements.
- In the focus manager, record the element that has focus before the popup makes other elements inert. Keep coupled operations in that order when several sources change together. Run the cleanup of each changed operation before its next setup. Give independent resources their own watcher and cleanup.
- At activation, the portal can still lack its popup. The focus manager restores its document listeners and modal marks after the DOM patch.
- The deactivation moves the focus to `<body>`, so the initial focus moves again at the activation. The popup keeps its open state.
- The deactivation returns no focus. The reference usually leaves the document with the popup, and an older element of the list would get the focus.
- The state for the portal and the guards do not read `isHeld`. `KeepAlive` takes the guards of the portal out of the document with the part, and the same guards must return.
- `enqueueFocus(element, options)` of `focus/enqueueFocus.ts` keeps one pending focus for the page. The focus manager and the list navigation share it. Do not copy it.

### Popup portal

The portal of a popup is in `src/utils/popups/portal`. `useFloatingPortalNode()` makes the portal element and finds its container. `FloatingPortalLite` is the portal of a popup that takes no focus. `FloatingPortal` is the portal of a popup that takes focus.

- The JSDoc of `container` and the comments of `useFloatingPortalNode.ts` give the forms of the container, and when the portal reads it.
- `FloatingPortal` takes `inPlace`. With it, the root node of the part is the portal element or the `#render` slot, with no `Teleport`, also on a server.
- A disabled `Teleport` still needs a target to hydrate its children in Vue 3.5.12. A plain element needs no target or server teleport buffer.
- In place, the portal reads no `container` and keeps no owner element or outside guards. Its context gives `inPlace`, so the focus manager acts as with no portal.
- Only `Dialog.Portal` sets `inPlace`, from its public `disabled` prop. Alert Dialog and Drawer use this part. On other portal parts, `disabled` stays an attribute of the portal element.
- A change of `disabled` mounts the content again.
- Do not render the `Teleport` on a server. With an element of the page as the target, the server HTML has no popup, and Vue reports a hydration mismatch.
- `KeepAlive` leaves the content of a `Teleport` in the target. The portal sets `disabled` on its `Teleport` while `KeepAlive` holds the part. The content then leaves the document, and the same element returns.
- The `Teleport` of a portal that mounts in a held branch has `disabled` from its first render. Its content thus mounts in the place of the part, out of the document, and moves to the container at the activation.
- The portal part of a family renders `FloatingPortalLite` or `FloatingPortal` while the popup is mounted or its `keepMounted` prop is set. It provides `keepMounted` as a `ComputedRef<boolean>`, and the positioner gives it to `usePopupPositioner`. `tooltip/portal/TooltipPortal.vue` is the model.
- `FloatingPortal` provides `PortalContext`, and the focus manager of the popup gives the portal its state with `setFocusManagerState()`. The comments of `FloatingPortal.vue` give the guards, the owner element and the `tabindex` of the content.
- Outside in-place mode, an open popup that is not modal keeps an owner element in the place of the portal part. It also keeps two guards there while the state has no next focusable element. The sequence is guard, owner element, `Teleport`, guard. `KeepAlive` takes the guards and the owner element out of the document with the part.
- The guards and the owner element stay outside the template. The part has one root node: its `Teleport`. In place, it is the portal element or the `#render` slot. Script makes the nodes and gives them to `useElementSiblings`. A ref of the `Teleport` gives the node that marks its place, and the composable keeps the nodes beside that node. See [Focus helpers](#focus-helpers).
- The JSDoc of each portal part names what does not reach the portal element by default: a scope id, `v-show` and a custom directive. The comments of `useElementSiblings.ts` and `useFloatingPortalNode.ts` say when a `<Transition>` of the consumer reaches it.
- The `id` attribute and the `#render` slot can replace the generated `id`. The portal thus follows the attribute with `useElementId` (`VUE-124`).
- The portal part of a family, such as `Dialog.Portal`, renders `FloatingPortal` or `FloatingPortalLite`, as Base UI does, and no element of its own. It follows the rules for a part that Base UI writes as another part. See [Parts that render an element](#parts-that-render-an-element).
- The portal part filters attributes against the internal portal it renders. For example, `FloatingPortal` declares `inPlace`, so an `in-place` attribute on `Popover.Portal` cannot change where the popup appears (`VUE-135`).
- That part renders nothing while the popup is not mounted, unless its `keepMounted` prop is `true`. It provides `keepMounted` to the parts in it.
- The second form of a portal part is the exception to the rule for the two forms in [Parts that render an element](#parts-that-render-an-element). The state of a portal part is empty, so write the content as plain children: `<DialogPortalChildren><slot :state="state" /></DialogPortalChildren>`. Do not wrap it in `<template #default="slotProps">` to bind `slotProps`. A slot variable in the slot of `DialogPortalChildren` makes the slots of that component dynamic. Each part below it that has slot content then renders again with its parent.
- `utils/popups/portal/PortalPart.test.tsx` checks this rule for each portal part. Add an entry to its `portalParts` for each new portal part.
- A compiler before Vue 3.5.21 makes the slots of a component dynamic when a prop of the component reads a slot variable. `<component :is="children">` in a `#render` slot has such a prop. With that compiler, the parts in `children` thus render again with their parent. The `#render` cases of `PortalPart.test.tsx` then assert this outcome.
- The portal part of a modal popup renders `InternalBackdrop.vue` in its `<Part>PortalChildren.vue`, before the default slot of the consumer. Base UI renders this backdrop in the positioner of Menu, Popover, Select and Combobox (`VUE-61`). The code of each `<Part>PortalChildren.vue` says when it renders the backdrop, and which element the backdrop leaves free.
- The `#render` slots of `FloatingPortal` and `FloatingPortalLite` get `children`. The component is `FloatingPortalChildren.vue`, which renders only its default slot. A portal part that has nodes of its own gives its own component: `Dialog.Portal` gives `DialogPortalChildren.vue`. A portal part with no nodes of its own, such as `Tooltip.Portal`, gives each slot prop of the portal to its own `#render` slot. See [Parts with nodes of their own](#parts-with-nodes-of-their-own).

### Popup interactions

Trigger press, focus and modality actions live in `src/utils/popups/usePopupTrigger.ts`. Hover and dismissal live in `src/utils/popups/interactions`.

- A trigger composable returns one plain object of listeners. It makes the object one time, in `setup`. Each listener returns while the composable is not enabled.
- The part puts the object in the `props` of `useRenderElement`, before its own props and `attrs`. A listener of the consumer then runs first, and `event.preventVaseUIHandler()` stops the handler of the composable. A native listener of Base UI cannot be stopped.
- A composable reads the hover intent in a `computed`. A server render reads it in no hook. It thus makes no intent and adds no listener to a store that all requests share.
- A trigger stops its open timer, its rest timer and its safe polygon when it unmounts, when its store changes, when it gets disabled, and when `KeepAlive` deactivates it.
- In Safari on a Mac, `useTriggerFocus` records the last input of the window, a key or a pointer press (`VUE-67`). Its window listeners for this record run while `KeepAlive` does not hold the trigger, also while the trigger is not enabled. A trigger of a menubar gets enabled only after the press that opened its menu, and it must know that press.
- Hover triggers, positioners and Navigation Menu scopes bind their pointer styles. A submenu releases its parent menu before the next pointer event in the same input. On the document body or an external scope, the hover intent restores the prior inline value and priority.
- A trigger that blocks pointer events itself, as `NavigationMenuTrigger.vue` does, calls `restoreOutsidePointerEvents()` of the hover intent at each change of `open`, when it unmounts and when `KeepAlive` deactivates it.
- `useHoverTriggerInteraction` adds the element of its trigger to the hover intent while the composable is enabled and `KeepAlive` does not hold the trigger. These elements are the hover triggers of the popup (`VUE-94`).
- Of the triggers that open on hover, only `NavigationMenuTrigger.vue` reads `:hover` in `onMounted` (`VUE-7`). The trigger reads `:hover` there because a browser sends no enter event for a pointer that is already over it when the hydration ends. When the trigger matches, hover is enabled and the menu is closed, it calls `onMouseenter` and then `onMousemove` of its hover props, each with a new event. The first call lets a move open the popup. The second call starts the rest timer. Under `KeepAlive`, the trigger reads `:hover` again when `isHeld` becomes `false`, after a deactivation and at the first activation of a trigger that mounted in a held branch. This follows the `KeepAlive` rules of [What differs from the React source](#what-differs-from-the-react-source). `Tooltip.Trigger`, `PreviewCard.Trigger` and `Menu.Trigger` keep the behavior of Base UI. They pass `move: false` and read no `:hover`. A pointer that is already over one of them when the hydration ends opens no popup until it enters the trigger again.
- A popup that hover or focus opened closes with the reason `trigger-hover` or `trigger-focus` when `KeepAlive` deactivates its trigger. This is the exception to the open state that a popup keeps under `KeepAlive`.
- `useHoverPopupInteraction` takes `store` as a store, a ref or a getter, because a part can get its store after `setup`. A change of the store runs each effect of the part again for the new store. `NavigationMenu.List` gives a getter, because the root points at the store of the active trigger.
- A popup part gives `useHoverPopupInteraction` the close delay of the store as a getter. The trigger that owns the popup writes its `closeDelay` to the store. `preview-card/popup/PreviewCardPopup.vue` is the model.
- A trigger part makes its own `safePolygon()` in `setup`, because the handlers of one safe polygon share one timer. It gives the result to `handleClose` in a getter or a ref, because `toValue` calls a function.
- A popup part stops its own timer and the timers of the hover intent. It also gives back the pointer events that the intent blocked. It does both when it unmounts, when its store changes, and when `KeepAlive` deactivates it.
- While `KeepAlive` holds a popup part, the part blocks no pointer events and has no listener on its positioner element.
- `useTooltipCursor` has no window listener while `KeepAlive` holds the part, also when the part mounts in a held branch.

The Tooltip provider owns the delay group in `src/tooltip/root/TooltipRootContext.ts`. The popups of a group share a delay. While a popup of the group is open, and for `timeoutMs` after it closes, the open delay of the group is 0.

- `provideFloatingDelayGroup({ delay, timeoutMs })` replaces the component `FloatingDelayGroup`. A part calls it in `setup`, and it gives the group to the parts below.
- A trigger passes its open ref, current popup id, effective open state and sibling-close action to `useDelayGroup`. These getters follow its handle.
- Parts with no provider share the default group of the module, and only a mounted part writes to it.
- A trigger publishes `isInstantPhase` after mount and when that ref or its store changes. A detached trigger thus updates its new root. If it unmounts during its instant phase, the store keeps `true` until the next trigger mounts. `Tooltip.Trigger` uses this order.
- `KeepAlive` does not stop the timer of a group. The instant phase thus ends on time while `KeepAlive` holds the provider.

### Popup dismissal

`useDismiss(store, options)` closes a popup for an Escape press, for a press outside it and for a press of its reference. The code is in `src/utils/popups/interactions/useDismiss.ts`.

- A root calls it one time in `setup`. While the popup is closed, the composable holds no document listener and no timer.
- The JSDoc of each option of `useDismiss` gives its forms. The root binds the dismissal listeners to its trigger and popup with `bindParts`.
- The document listeners exist only while the popup is open, enabled and not held by `KeepAlive`. A server render adds none.
- `useDismiss` gives its document listeners to `useDomEffect`. It replaces the listeners after the DOM patch when their sources change. The server installs none.
- A hold releases those listeners in the KeepAlive hook. The popup keeps its open state. The composable clears its session state and timers.
- `useMenuRoot` keeps the 500 ms grace for an outside press on a context menu. The timer stops when `KeepAlive` holds the root and starts at the activation, also when the menu opens or mounts open while held.
- A shallow ref in the source list of a `watch` makes Vue call the callback for each trigger of a source, also when no value changed. Give the list a getter, or call the function in the hook.
- The comments of `useDismiss.ts` give the rules for a press in a frame, in a shadow root and in a portal. They also give the inside marker, the number of each open popup, and the relay of a `keydown` to the popup above.
- Each `useDismiss` call holds the positioner of each popup below it in the component tree, and each portal element below it that its popup does not own. A child popup of any family is thus below, with or without a node in the popup tree. The start of a press, its release and the outside-press check share this boundary, together with the children of the popup tree. A press that starts there and ends outside closes no popup above, and the next outside click closes them (`VUE-4`).
- An outside press closes the popup before a bubble listener of the pressed element runs. An outside element whose listener toggles the open state (`open = !open`) thus opens the popup again (`VUE-75`). To toggle a popup from an outside element, use a detached trigger. Another way is to call `details.cancel()` in `onOpenChange` for the press on that element.
- Base UI ignores Escape for a short time after `compositionend` in each engine. Vase UI has that window only in WebKit, the one engine that sends `compositionend` before the `keydown` that ends a composition (`BUG-6158`).

### Scroll lock

The scroll lock stops the scroll of the page under a modal popup. The code is in `src/common/useScrollLock.ts`, `src/utils/popups/useAnchoredPopupScrollLock.ts` and `src/utils/popups/InternalBackdrop.vue`.

- Call `useAnchoredPopupScrollLock` in `setup` of the positioner of an anchored popup. Call `useScrollLock` in `setup` of the root of a Dialog.
- A lock exists only while the part is enabled, is mounted and is not held by `KeepAlive`. A server render takes no lock.
- One plain object on `globalThis[Symbol.for('vase-ui.scroll-lock')]` holds the state. Its fields are `version`, `lockCount`, `restore` and `stableGutter`. Two copies of the library then share one count (`VUE-6`). Each copy keeps its own timers.
- The probe for `scrollbar-gutter` writes styles and reads the layout. In WebKit, that can stop a transition that runs on the page. Thus each document gets one probe, and `stableGutter` keeps the result (`BUG-6119`).
- A test of the lock uses a document of its own from `createScrollDocument` in `test/fixtures/scrollDocument.ts`. A case that needs scrollbars that take space asks `probeStrategy`. It runs only in an engine that has them. A case of the gutter way sets `mockedScrollbarWidth`, so that the window reports a scrollbar. It then runs in each engine.

### Popup click

`useTriggerPress(store, options)` opens or closes a popup for a press of its trigger. The code is in `src/utils/popups/usePopupTrigger.ts`. It follows the rules of [Popup interactions](#popup-interactions).

- A trigger part calls `useTriggerPress` in `setup`. `store` is a store, a ref or a getter, because the store of a trigger with a handle changes.
- The frame and the touch timer stop when the part unmounts and when `KeepAlive` deactivates the part. A frame or a touch timer that waits still opens its popup when `enabled` becomes `false` or the store changes, as in Base UI.
- Where a trigger of Base UI sets the attribute `CLICK_TRIGGER_IDENTIFIER`, the trigger part sets the same constant of `src/internals/constants.ts`.
- `Menu.Trigger` saves the document of the press. It removes its release listener from that document at unmount and when `KeepAlive` deactivates it.
- `Menu.Trigger` and `Select.Trigger` write the `mousedown` event of the press to `triggerPressRef` of the store context, because their items read it. `useAriaCombobox` writes the `mousedown` event of each press that opens the popup to `openPressRef` of the store context: a press of the trigger, the input, the input group or the chips. `Combobox.Trigger` and the items read it there.
- `isReleaseAtPressPoint.ts` and the rows `VUE-68` and `VUE-84` of `parity/better` give the rules for the release of the press that opened a popup. The rules use one distance between the release and the press.
- `PRESS_POINT_TOLERANCE` of `isReleaseAtPressPoint.ts` is the only value of that distance: 8 px on each axis. Its comment gives the reason for the value. A release reports no pointer type, so one value applies to a mouse and to a pen. Do not use the 5 px of `isMouseWithinBounds` for it. That value is the margin of Base UI around the trigger.
- A submenu reads `triggerPressRef` of its parent menu. `Select.Trigger` clears the event at the release, because a `Select` item also takes a later drag while the popup stays open. `useAriaCombobox` clears `openPressRef` at the next `mousedown` in the window. The trigger opens its popup in the frame after the press, so that press can end before the write. `useAriaCombobox` removes its `mousedown` listener and clears `openPressRef` when its scope ends and when `KeepAlive` deactivates the root.
- `Select.Trigger` starts the 400 ms timer that guards a release on an item when the popup opens. When the popup opens or mounts open while `KeepAlive` holds the trigger, the timer starts at the activation.

### Popup list navigation

`useListNavigation(store, options)` moves the highlight of a list with the arrow keys, with real focus or with virtual focus. The code is in `src/utils/popups/interactions/useListNavigation.ts`.

- A root calls it one time in `setup`. It also works while the popup is closed, because a key of the reference opens the popup.
- The result is a `ComputedRef` of one object with `reference`, `floating`, `item` and `trigger`. `reference` and `floating` can hold `aria-activedescendant`, which changes. Its value is the option `activeItemId`, the `id` of the element of the highlighted item. Base UI derives the value from its option `id` and the active index, and this composable has no option `id`. `item` and `trigger` hold only listeners, and each is one object for the life of the composable. An item part that gets `item` as a prop thus renders again only when its own state changes.
- A root that merges `reference` or `floating` with other props merges them in a `computed`. The merge then follows a change of `aria-activedescendant`.
- A root whose input names the highlighted item itself gives no `activeItemId`, as `useMenuRoot` does. `reference` and `floating` then hold no `aria-activedescendant`, and the props of the popup stay one object while the highlight moves. A new object renders the popup part again, and Vue then patches each item again.
- The JSDoc of each option of `useListNavigation` gives its forms. The composable does not write the active index. It calls `onNavigate`, and the consumer writes the index or declines.
- The orientation goes to `context.orientation` of the store in `onBeforeMount`, and a `watch` follows a change. A list below reads it through the popup tree. A server render writes nothing to the store. A store with a frozen context, such as `getEmptyRootStore()`, throws at that write, so give the composable the store of the root.
- The comments of `useListNavigation.ts` give the relay of a `keydown` from a list that `Teleport` moved to the list above (`VUE-46`).
- `KeepAlive` takes the list out of the document, and the active item loses the focus. While `KeepAlive` holds the list, the composable stops its frames. At the activation, the active item gets the focus again, and the highlight does not change. A list that mounts open in a held branch sets its highlight and its focus at the activation, as a list in a shown branch does at its mount.

### Popup typeahead

`useTypeahead(store, options)` finds the next item whose label starts with the typed text, and it gives the index of that item to `onMatch`. The code is in `src/utils/popups/interactions/useTypeahead.ts`.

- A root calls it one time in `setup`.
- The JSDoc of each option of `useTypeahead` gives its forms.
- `KeepAlive` can take the list out of the document with no `focusout`. Thus the deactivation ends the session, and `onTyping` gets `false`.

### Toast store

The toasts of one `Toast.Provider` are in a `ToastStore`. The code is in `src/toast/store.ts`.

- `ToastStore` is a `ReactiveStore`, and the rules of [Popup store](#popup-store) for a `ReactiveStore` apply to it.
- A toast keeps no vnode in its data, because a vnode that mounts a second time on a page that Vue hydrated loses its components. The `title`, the `description` and the `children` of `actionProps` are a text, a number, or a function that returns the content.

### Toast parts

- `Toast.Title` and `Toast.Description` are the label parts. The comments of each part in `src/toast` give its rules, and `parity/better` has a row for each behavior where Toast does more than Base UI.
- While `KeepAlive` holds the provider, it releases its timers and the subscription to its manager. The activation takes them back, and each timer continues with the time that was left. A provider that mounts in a held branch takes its timers and its subscription first at the activation.
- A `Toast.Viewport` that mounts in a held branch adds its document and window listeners at the activation. While `KeepAlive` holds the viewport, F6 keeps the action of the browser.
- `Toast.Root` measures no height while `KeepAlive` holds it, also when it mounts in a held branch. It measures at the activation. A new toast keeps `data-starting-style` until then, so its enter transition plays when it shows.
- `Toast.Root` ends a swipe in progress with no dismissal when `KeepAlive` deactivates it.
- `Toast.Root` closes on Escape while the focus is in it, and it stops that event (`VUE-127`). A popup under the toast, such as a modal dialog, listens for Escape on the document, so it stays open. The root does not stop an Escape that it does not handle. An Escape during the exit of the toast is such an Escape, because it closes nothing.
- `Toast.Viewport` returns the focus to the element that had it before F6 for an Escape that reaches it, and it stops that event (`VUE-130`). A toast stops the Escape that closes it, so the viewport gets only an Escape that no toast handled. The viewport does not stop an Escape that moves no focus. That is the case when the viewport got the focus without F6, and when the element cannot take the focus.
- A `Toast.Root` with no title takes its name from its last description (`VUE-99`), unless the consumer gives it a name. The root reads only its own attributes for this rule. Put `aria-label` or `aria-labelledby` on `Toast.Root`, not on the element of the `#render` slot.
- In the `#render` slot of a label part, mount `children` for the label of the toast. To show your own content in another element, give the content in the default slot and the element in `as`.

### Composite

A composite is a group of items with one tab stop, such as a toolbar or a list of tabs. Its code is in `src/internals/composite`.

- A root part calls `useCompositeRoot` in `setup`, and an item part calls `useCompositeItem`. Each part gives the result to `useRenderElement`.
- `useCompositeRoot` makes the item registry with `useCompositeList`. `useCompositeItem` registers the item with `useCompositeListItem`. A part that needs only the registry calls those two composables.
- `useCompositeList` returns the list, and it provides the list to the parts below its caller. With `provide: false`, it provides nothing. `useCompositeListItem` registers with the list that it gets as `list`, or with the nearest list that a part above the item provides.
- Base UI also has the components `CompositeList`, `CompositeRoot` and `CompositeItem`. Vase UI has no counterpart of them, because a Vue part renders its own element. Thus `as` and `#render` work with no change, and the DOM has no wrapper element.
- A grid of dates keeps its tab stop by date in its root, and it calls no `useCompositeRoot`. A key finds the next date with `Temporal`, because a move can cross the end of a month and an index cannot. While the day button of a date hydrates, it binds `data-allow-mismatch` with the category `attribute` and a `tabindex` that is a string, as an item of a composite does. `Calendar.Root` is the model. The cells of the grid of months and of the grid of years follow the same rules. They register with the root by the first day of their month, so a key, `focus()` and the tab stop find them. A month cell that gets the focus gives the root a day in its month. The day of the month is that of the focused day, or the last day of a shorter month. A year cell gives the root the focused day in its year. With no focused day, the first selected day takes its place, else today. `focus(date)` gives the root `date`.
- `TimePicker.List` and `TimePicker.Column` are composite roots with a vertical orientation. Each of their items is a composite item that is active while it is selected, so the tab stop is the selected item, also in the server HTML. With no selected item, it is the first item that is not disabled.

The composite root:

- Pass `registerRoot` as the root ref. Place `onFocusin`, `onFocusout` and `onKeydown` before the part and consumer listeners in the props sequence.
- Keep that sequence of `props`. A `keydown` listener of the consumer then runs first, and `event.preventVaseUIHandler()` stops the navigation.
- `useCompositeRoot` returns `elementsRef` and `itemMap`. The time picker uses the map to find the selected enabled option when its popup opens.
- A root part whose selected item can be hidden or natively disabled gives `highlightedIndex` and `onHighlightedIndexChange` to `useCompositeRoot`, as `Tabs.List` does. An uncontrolled root moves the tab stop off that item. The item moves it back. A development build of Vue then stops with `Maximum recursive updates exceeded`.
- When two tabs have the selected value, only the first in the registered order moves the tab stop. While a registered tab has focus outside the list element, the tab stop stays on that tab.
- The root checks the active item when focus leaves its element and its registered items (`VUE-113`). Use `getDisabledIndices` when some disabled items can take focus. The toolbar derives these indexes from the item map.
- The root watches the active and disabled state in each registration. A render slot can change the native or ARIA disabled state of a registered element. The root observes those attributes on the item. A native control also follows its fieldset after a move. The first legend of a disabled fieldset keeps its native exemption. An async child can hold the only tab stop in server HTML until it hydrates.
- An uncontrolled root checks changes to the disabled indexes after the DOM patch. The focused item keeps its tab stop until focus leaves. If the callback returns `undefined`, each item and its element supply their disabled state.

Grid navigation:

- Pass `grid: gridNavigation(config)` for a composite grid. Import the navigator from `internals/composite/gridNavigation.ts` only where the root needs grid keys.
- `grid` is a plain function and not a `MaybeRefOrGetter`, because `toValue` calls a function. The root reads it when a key comes.
- `config` holds `cols`, `dense` and `itemSizes`. It is a value, a ref or a getter. The navigator reads it when a key comes.

The composite item:

- Pass the rendered element ref and item options to `useCompositeItem`. Bind its attributes and focus and key actions before the part and consumer listeners.
- If another composable needs the element ref during setup, pass that ref to `useRenderElement` as `elementRef`.
- Give the list live values for `active`, `disabled` and, for a picker option, `selected`. The first two also determine the initial server tab stop. An item relays its focus and keyboard events to the root when its native event path does not reach the root.

A part that is in a composite only in some trees:

- `Toggle` is a composite item only in a `ToggleGroup`. `ToggleGroup` is a composite root only outside a `Toolbar.Root`. In a toolbar, the toggles register with the root of the toolbar. `toggle/Toggle.vue` and `toggle-group/ToggleGroup.vue` are the models.
- `Radio.Root` is an item only in a `RadioGroup`.
- `NavigationMenu.List` is a composite root only when its root is not nested. A nested list also leaves out its key handler, so that the arrow keys reach the outer root. `navigation-menu/list/NavigationMenuList.vue` is the model.
- Read the optional context in setup. Call `useCompositeItem(element, options)` or `useCompositeRoot(options)` when that context requires it.
- The choice is made one time, because a component keeps its provider chain from the moment that Vue makes it. `KeepAlive` and `Teleport` do not change that chain.
- `useCompositeItem` throws when it has no composite root, so a part cannot call it in each tree.
- A root part that is in another composite calls no `useCompositeRoot`. It provides no composite context and no list. Its items register with the outer root, and the composite has one tab stop.
- The outer root owns the keys. The `orientation` and `loopFocus` of the inner part do not change them.
- An optional root passes `composite?.registerRoot` as its ref. An optional item binds `item?.attributes.value` and `item?.events`.

The item registry:

- Pass the element ref to `useCompositeListItem` for registration and its index.
- A function that a ref callback calls must not read reactive state. Vue calls the callback during a render, and the read makes that render depend on the state.
- At mount, the list reserves explicit indexes and assigns the rest in document order. A post-flush watcher updates that snapshot after a registration, an item source change or a DOM reorder. Changing the target of a `Teleport` updates the automatic indexes in document order.
- One synchronous watcher tracks the element, its KeepAlive state and its activation count. Its cleanup removes the registration on replacement, a hold or unmount. A Vapor item that mounts in a held branch registers its visible element when the branch activates.
- An item that mounts in a held branch can miss `onDeactivated`. `useKeepAliveState` checks the branch in `setup`. The list also skips disconnected elements when it sorts.
- `KeepAlive` empties the composite map while the item parts still exist. A root that falls back when its items are gone decides a removal by a registry of the item parts, not by the map. `tabs/root/TabsRoot.vue` is the model.
- Each registration supplies live metadata, label, explicit index and text element values. The list reads them from its current registrations. A held item supplies its latest values on activation.
- Give an object as metadata through a `computed` or a ref. A getter that makes a new object on each call makes the list publish a new map on each sort.
- A family can use the registry only for the index of its items. `Accordion.Root` calls `useCompositeList`, and `Accordion.Item` calls `useCompositeListItem`. The root does not call `useCompositeRoot`, so the items have no roving tab stop and no arrow keys. Base UI removed the arrow keys of the Accordion to follow the APG.
- A part that uses the registry only for its own parts gives `provide: false` to `useCompositeList`. It gives the list to its own parts through its context. Each of those parts gives that list to `useCompositeListItem` as `list`. `Tabs.Root`, `Accordion.Root`, `Resizable.Root`, `Slider.Root`, `OTPField.Root` and `Combobox.Chips` do this.
- The slot of such a part can also hold the items of a composite around the part, such as the buttons of a toolbar. Such an item then joins that composite, as a child of the part and in a part of the list, such as a panel of Tabs. The parts of the list keep their index. Base UI gives the list to the whole tree of the part, so such an item joins the list of the part (`VUE-87`).
- A composite root and the list of a popup provide their list. Their items can be at any depth below them, for example in a group. A popup is a widget of its own, so an item of a composite around it is not an item of that composite. `Combobox.List` also provides its list when it is not in a popup, because its role `listbox` or `grid` makes it a widget of its own.
- `Select.Positioner` calls `useCompositeList` for the items of Select. Its comments say how it reads the value of each item.
- The positioner then checks the value of the select against the values of the items. It makes no check while its element is not in the document. `KeepAlive` takes the items out of the document, and the registry then has no item.

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
- `Tabs.List` sets `hasActiveItem` only when `modelValue` or an explicit `defaultValue` is not `null`. With the implicit default, the first enabled tab has the tab stop. With `null`, the first tab has it, also when it is disabled.
- `RadioGroup` sets `hasActiveItem` only when it has a value.
- The order of `setup` is the order of the document, with the exceptions of the list above. Two exceptions are usual:
  - An item below a component with an async `setup`. A server runs the `setup` of that item after the items that follow it.
  - An item in an async component that a module makes one time, such as a lazy component of Nuxt. After its first render, a server has loaded the component and runs its `setup` in the order of the document. A browser has not loaded it when the page hydrates.
- In such a list, the tab stop of the server HTML can be on another item than the tab stop after the mount. A server writes the HTML of an item before it knows the later items.
- While an item hydrates, it gives `data-allow-mismatch="attribute"` and a `tabindex` that is a string. Vue then reports no mismatch when the server and the browser give the tab stop to different items.
- Vue keeps the server `tabindex` from a `v-bind` object while it hydrates. After the mount, the item gives a number. The change from a string to a number makes Vue write `tabindex` again.
- An item can be mounted after its root: an item in an async component, or below a `<Suspense>` inside the root. Its element keeps the `tabindex` of the server HTML until the item is mounted.
- While such an element has `tabindex="0"`, the mounted items do not take the tab stop. The list then has one tab stop. That element has no listeners of its own until its item is mounted.
- While an item hydrates, it also gives the attribute `data-vase-ui-hydrating-composite-item` with the id of its root. The root finds the element by that attribute. Thus it does not wait for an item of a nested composite or for an element of a consumer.
- The wait ends when the item is mounted or its element leaves the document. The tab stop is then the item at the highlighted index. If the item that was mounted is active, the new map moves the highlighted index to it, so the item keeps the tab stop.
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
- Use `focusin` and `focusout` for focus events that must bubble.
- A text or range input takes an edit from `input` alone. A script that changes the DOM value after mount must dispatch `input` for the part to handle the edit. A native `change` listener can receive the later commit.
- Handle checkbox and radio activation on `click`. Read `event.defaultPrevented` to honor an earlier native cancel.
- Ignore a click on a radio that the model already has as checked.
- To stop the focus handler of a part, call `event.preventVaseUIHandler()` from a `focusin` or `focusout` listener.
- ESLint reports a React name from a fixed list, with or without the `Capture` suffix. It reports an object key, a property read and a JSX attribute in script, in `packages/vue/src`, in test files and in `packages/vue/test`. It does not read a template.
- The lint rule has a fixed list of names, because a pattern for a second capital also matches a component event, such as `onOpenChange`.
- The list does not have `onFocus`, `onBlur` and `onChange`. Each is a valid Vue key with another meaning.

### What differs from the React source

#### Derive a value

- Keep a last-rendered value only when a handler needs that phase. A direct ref read sees the latest write. `useFieldValidation` keeps `renderedValid` for the validity before a change. The comments in `useMenuRoot`, `NavigationMenuTrigger.vue` and `useAriaCombobox` name their cases.
- Read the current value in a handler. Keep a separate value only for an independent writer or a specific phase of a gesture.
- Capture a setup constant only for a real initial snapshot. A submenu reads its parent's initial transition status and `instantType` from raw state in `useMenuRoot`.
- An object prop can be a reactive proxy that the consumer changes in place. Read the keys, entries or array elements the result uses. `Object.hasOwn` alone does not track a new key. Track key presence when it affects the result.
- Keep a shallow snapshot when a comparison needs the old contents or a local dismissal must survive a render. Test both replacement and an edit in place.
- `CheckboxGroup` gives `useControlled` an empty array for `null` and preserves `undefined`. For an array, its getter calls `slice()` to track the items. An edit in place then gives the group's watchers a new array.

#### Share behavior and markup

- Use a composable for shared state or behavior. For example, a root calls `provideLabelableContext()` to provide labels.
- `useMenuRoot` serves both menu roots. `useAriaCombobox` serves roots that share combobox behavior. Give a shared helper getters for the props it reads. A spread reads every prop at once.
- Use an SFC or a scoped slot for markup that a part owns. Forward an element, public render slot or declared event at the boundary that exposes it.
- `useFilterDropdownInput` shares the input behavior. The public part supplies the markup. [Vapor mode](#vapor-mode) gives the two exceptions that need render functions.
- Base UI can swap the component of a part for another component through a context, so that a plain menu does not bundle the filter code. `Menu.Popup`, `Menu.List`, `Menu.Group` and `Menu.RadioGroup` do this. The choice is fixed for a mounted part, and Vue runs `setup` one time. So each part stays one SFC with one root node and has no twin.
- The part calls `useMenuFilterImpl()` in `setup`, and an item part calls `useMenuFilterItem()`. The result is `null` in a plain menu. The JSDoc of `menu/filter-root/MenuFilterContext.ts` gives the rest.
- Base UI can give one handler of a root to more than one part. Such a handler reads the state of its caller from an attribute of `event.currentTarget`. In Vue, each part calls the handler with that state as an argument. Do not read the attribute, because an attribute of the consumer replaces a state attribute of the part. `ScrollArea.Thumb` and `ScrollArea.Scrollbar` give their orientation to `handlePointerDown` of `ScrollArea.Root` in this way.

#### React to a change

- Choose the watcher from the change that must trigger it. During server setup, a default `watchEffect` or an immediate default-flush `watch` runs once. A lazy callback watcher observes later changes there only with a synchronous flush.
- For work that requires a mount, start the watcher in `onMounted`. For a later DOM read, choose a post-flush effect or an explicit post-flush source. Check whether one watcher can cover mount and replacement.
- A default-flush watcher runs before its owner's render. A state change that it publishes can reach that same render. `useMediaQuery` and the preload in `Avatar.Image` use this order.
- `useAnchorPositioning` updates `isPositioned` synchronously. `usePopupRoot` also copies `mounted` and `transitionStatus` in the same task.
- `useValueChanged` calls its callback after the DOM update, because the callback of a field control reads the validity of the input. A change while `KeepAlive` holds the part waits for the activation. The callback then gets the value before the hold, or the value of the mount when the part mounts in a held branch.
- A parent update can leave a child with stable props and slots untouched. Track the reactive value that changes the part's own DOM.
- Observe consumer-owned or external DOM only when Vue cannot report the change. `observeRootNode` shares one observer for each root node and attribute list.
- Keep the active style in the bindings of the element that owns it. `Drawer.Popup` reads the current swipe sample in its render.

#### Own a resource

- `useDomEffect` owns a DOM effect across mount, a post-flush update and a KeepAlive hold. A queued effect can run after the branch leaves the document but before `onDeactivated`.
- Use `useResizeObserver` or `useMutationObserver` for targets that follow a part. Each post-flush watcher owns one observer per target window. A hold or a change to the targets or options invalidates pending deliveries.
- Create a replaceable resource in its watcher. Give its release to `onCleanup`. In Vue 3.5.12, a reactive read in a sync callback during a patch can make the render depend on that value.
- For a resource that starts at mount and follows later changes, create its watcher in `onMounted` with `immediate: true`. For a registration that lasts from mount to unmount, give its release to `onScopeDispose` in the mount hook.
- Use `useListenerSession` for a press that needs a document or window listener in the same task. Register each remover at attachment. End the session before a release callback can start another press.
- A repeat button keeps its release listener when it reaches a limit. A release during the first step also stops repetition (`VUE-143`).
- Vue stops the watchers of a part before it calls its `onScopeDispose` callbacks. ESLint refuses a `let` with a void function type, a `let` that starts as `NOOP`, and a `let` copy of `isHeld`.
- `Teleport` can move an element to another document or shadow root with no change of a `watch` source. Use `observeRootNode` for changes in the tree of the root node. Use `followRootNode` for a listener or another subscription on the root node itself. ESLint refuses a call to `getRootNode()` inside a watcher, a `computed`, a `useDomEffect` effect, or a mount, update or activation hook. The helper calls the callback before it moves its observers, because the callback can write in the new root. For a tree outside a document or shadow root, the helper also observes the last document or shadow root of the element. If the element had neither, it observes the owner document. When the consumer attaches such a tree in another root, such as another shadow root, no observer gets a record.
- A teleported child popup has four links to its parent: the popup tree and the `provide` chains of `useDismiss`, `useListNavigation` and `useFloatingFocusManager`. See [Popup dismissal](#popup-dismissal), [Popup list navigation](#popup-list-navigation) and [Focus helpers](#focus-helpers).
- A submenu popup below a filterable root gives its `focusin` to the popups above through the popup tree. For a filterable parent, it also gives its `keydown`. A part in a popup listens with `useNestedPopupEventListener` in `setup`. The JSDoc of `menu/filter-root/nestedPopupEvents.ts` and of `MenuFilterContext.ts` gives the events and the cases.
- An outside press and a focus-out treat the popup of a descendant node as inside.

#### Read the DOM after a patch

- Write reactive state directly when the next operation needs no DOM read. Vue queues its DOM flush as a microtask before the next paint.
- Await `nextTick()` after the write when the next operation needs the patched DOM for a read or focus. Test that order.
- Measure after mount when the DOM reflects the inputs to the measurement. A `ResizeObserver` reports size changes only. `Tabs.Indicator` reads a size-change counter and the orientation. A change of orientation can move a tab without a resize.
- Measure a mounted scroll area track again after its overflow attribute or corner size changes. Either change can resize the track through CSS.
- A render slot can set an attribute that no prop tracks. `AvatarImage.vue` checks its rendered image at mount and after updates, and acts only on a changed value. For a referenced id, follow [Actions, handles, slots, composables and ids](#actions-handles-slots-composables-and-ids).
- In a development build, `Menu.SubmenuTrigger` warns in this way about a disabled element of its `#render` slot. The warning comes only one time, so the hooks compare no values.
- Vue applies a state write of an animation frame callback in the microtask after that callback. The browser computes the style of the frame after that microtask.
- A transition must sometimes start from a value that an earlier DOM update set. Then read the layout of the element after that update. `useCollapsiblePanel` calls `getBoundingClientRect()` in `nextTick` after it writes the measured size. Without that read, the exit transition does not start.
- Give `useFloating` an element or a virtual element, never a component. It reads the element of a component through `$el`. `resolveElement` changes a component into an element.
- The reference of `useFloating` is `null` before the mount, while the popup is not mounted, and while `KeepAlive` holds the popup, also from a mount in a held branch to the activation. `useFloating` then starts no `autoUpdate` and computes no position. The first pass after the activation gives the position of a popup that mounts in a shown branch.
- Write the anchor to a `shallowRef` that the reference reads, in a `watch` with `flush: 'post'`. A getter of the consumer can read the DOM of the render.
- `useAnchorPositioning` is the only caller of `useFloating`. Its comments give the reasons for the `computed` of the reference, for its options and for the flush of each watcher.
- A function ref of a composable reads no ref in the render, because the render then depends on that ref. Where the function ref must start work that depends on a ref, it reads the ref in a `queueMicrotask` callback. `arrowRef` of `useAnchorPositioning` does this.
- The check for a rectangle must refuse a component. The ref of a component with no `expose` also gives its props. A component that has `width` and `height` props then has the names of a rectangle. A rectangle has no `nodeType` and no `$props`, and its `x`, `y`, `width` and `height` are numbers.

#### Preserve event and update order

- In an event handler, call `preventDefault` and `stopPropagation` before the first `await`. A handler returns at its first `await`. The browser then completes the dispatch of the event.
- Run coupled callbacks in the order the user can observe. Await a flush between them only when the next callback needs the published DOM or child state.
- Two events can arrive in the same task, before the Vue flush. `NumberField.ScrubArea` must install its move and release listeners before the next pointer event.
- A default-flush watcher runs before the post-flush watchers. `Autocomplete.Root` clears the inline text and suppresses further completions until `nextTick` so the clear wins for that update.
- A parent's post-flush watcher can run before the mount hooks and post-flush watchers of the children that its update mounts. `useAriaCombobox` retries after `nextTick` if the children have yet to register the active index of a list without `items`.
- A submenu sends focus events and unhandled navigation keys through the popup tree. A filterable parent uses the registered popup, trigger and event path for a navigation key. This also works when a portal places the submenu in another document.
- The transition-status watcher runs synchronously so an interrupted transition sees each state change.
- `Field.Error` retains the last message for its exit, even when the default slot supplies other text. It copies message lists because the consumer can clear them in place.
- A synchronous watcher sees each write. Publish the final image status once per run. An intermediate `'loading'` before `'loaded'` would give a loaded image `data-ending-style`.
- `useTransitionStatus` has a fifth parameter, `element`, that upstream does not have. It is the element that gets `data-starting-style`, or a ref or a getter for it. Its JSDoc and its comments give the reason for the read of the layout. Omit `element` only when the element has no enter transition, as `Accordion.Item` does.
- `useUnmountAfterClose` keeps a popup mounted until its exit animation ends. Then it sets `mounted` to `false` and calls `onUnmount` one time. A `forceUnmount()` call while the popup is open is a request. Its JSDoc and its comments give the rules for that request, and for the last element that attached (`VUE-92`).
- Do not decide that request in `nextTick`. With no flush in the queue, `nextTick` runs before the flush of a write that comes later in the same task.
- A real key press can run microtasks between native listeners. Use a zero-delay timer for a decision that needs every ancestor's handler to finish. On Enter, `Checkbox.Root` prevents the button's native click. An ancestor initially reads `defaultPrevented` as `false` and can call `preventDefault()` to stop the form submission. The timer removes the two properties from the event.

#### Read hidden slot content

- Base UI can read the text of children that it does not render, such as the label of an item that the filter hides. A slot is a function that a render must call.
- Do not call a slot in `setup`, in a lifecycle hook or in a watcher. A call in `setup` or in a hook makes Vue warn that the slot runs outside the render function.
- Give the slot to a child component that calls it in its render. That child adds no element to the document. `FilterDropdownHiddenItemText` does this for a hidden item. Vue renders that child again when a value that the slot reads changes.
- A virtual DOM slot gives vnodes. The child reads their text and mounts nothing.
- The slot of a Vapor component gives one vnode with no children. The child mounts it with `Teleport` in an element outside the document and reads the text of that element. A `MutationObserver` gives each later text. The content thus mounts a second time and its components run (`VUE-129`).
- Test a vnode for the types that have children. Do not import `VaporSlot`, which Vue 3.5 does not export.
- The child does not mount the slot of an item that has a `label`, because the filter matches the `label`. The child still reads the text of the vnodes of such an item. The part gives its `label` to the child.
- `useFilterDropdownItem` keeps the rendered text of the element separate from the registered text. When `label` becomes `undefined` on a hidden item, the item uses that rendered text and not the old `label` (`VUE-129`).
- The first text that the child gives after the element goes is only a text to compare with. The rendered text of the element stays the text of the item until a later text of the child differs from that first text. The vnode of a component has no text, so the text of vnodes can be less than the rendered text.
- A hidden item with a `label` whose slot needs a mount gives no text to compare with. When that `label` becomes `undefined`, the first text of the mount is the text of the item (`VUE-129`). The child tells `useFilterDropdownItem` whether a text is the text of a mount. Do not use the first text of vnodes as the text of the item.

#### Bind styles, attributes and native events

- Give each nonzero CSS length its unit, such as `'1px'`. Vue does not add a unit to a number.
- Vue writes each key of a style again when the `style` object is not the object of the last render. A temporary inline style that the code writes to the DOM is then lost when the consumer has the same property in `style`.
- Both disclosure panels pass temporary styles to `useRenderElement` through `overridingStyle`. A page match skips the opening motion. Restore the duration before the parent's deactivation hook. On close, keep the latest bound duration or restore the duration set directly on the panel. Restore each measured alignment property with its original priority.
- `getDragStyles()` of `useSwipeDismiss` gives the drag styles at the time of the call. The offset of the drag is not reactive, so a change of the offset renders nothing. A render during a swipe writes the drag styles again. `Drawer.Popup` applies the same snap point damping to the rendered movement as it does during the drag. A `transform` or `transition` key that the part puts after the drag styles replaces the drag in that render.
- `Drawer.Popup` gives the `transform` and the `transition` of the drag to `useRenderElement` as `overridingStyle` while the drawer is swiping. The drag then wins over a `transform` or a `transition` in the `style` of the consumer.
- `Drawer.SwipeArea` gives the popup its movement and the backdrop its progress. The popup binds `transition: none` for that gesture. When the gesture ends, the backdrop and indent show the resting snap progress.
- The popup and backdrop use the same release strength and dismiss flag. A new gesture, a reopen or a replacement popup clears the release. A rejected close restores the previous snap point.
- `handleHiddenInputInvalid` writes `min-width` and `min-height`, and Base UI writes `width` and `height`. A Vue render writes each key of the style of the input again, and it writes no other property.
- `ScrollArea.Viewport` binds `scroll-snap-type` to `none` for a thumb or track press. The track jump follows the style patch. Later drag moves scroll in the pointer event.
- Restore the inline value and priority that the viewport had at the press. Release pointer capture when the viewport or thumb leaves. A held viewport or thumb takes no press.
- An attribute key in a props object is the name in Vue's `HTMLAttributes`, such as `tabindex`. `mergeProps` merges by key, so the `tabindex` of a consumer then replaces the `tabindex` of the part.
- With the key `tabIndex`, the merged props hold two keys. Vue then sets one as a DOM property and one as an attribute.
- A parameter of a composable keeps upstream's name, such as `tabIndex` of `useButton`.
- A part that turns autocorrect off gives the key `autoCorrect`, and it takes `autocorrect` out of the attributes of the consumer. The comment in `NumberFieldInput.vue` gives the reason.
- Where upstream takes a native attribute out of its props and does not use it, the part takes the key out of `attrs` in the `props` function of `useRenderElement`. It does not declare a prop for it. `Toggle` does this for `type` and `form`: `const { form, type, ...elementAttrs } = attrs`.
- Where an element can lack the DOM property, a part gives a Boolean attribute the value `true` or `undefined`, never `false`. On an `<svg>`, which has no `hidden` property, Vue writes `false` as `hidden="false"`.
- Bind `hidden="until-found"` on a closed searchable panel. An accepted page match clears the start style before the browser measures the text. If the panel stays closed, restore the matched element even if Vue has replaced it. A cached panel needs its closed attributes before the parent activation hook.
- Bind listeners on the part's own element through its props. The element in the render slot then receives them too. `Collapsible.Panel` binds `onBeforematch`. `NavigationMenu.Positioner` attaches its two focus capture listeners to the resolved element because `usePositioner` takes no element props.
- A listener that must cancel a browser default needs a non-passive listener. Vue attaches an ordinary element listener without a passive option. Browsers default wheel listeners to passive on the window, document, root element and body.
- Give a passive listener the `Passive` suffix, as in `onTouchstartPassive` on `Slider.Control`. Vue passes that option to the browser.
- Use a passive touch listener when the handler permits the browser default. The browser can then start a scroll without waiting for the handler. `usePressAndHold` binds `onTouchstartPassive`.
- `useSwipeDismiss` binds `onTouchstartPassive` and `onTouchmovePassive` for handlers that permit a scroll.
- `ContextMenu.Trigger` also binds `onTouchstartPassive` and `onTouchmovePassive`. A listener of the consumer stops such a handler with `event.preventVaseUIHandler()` only when it has the `.passive` modifier. A listener with no modifier has another key, so the handler of the part still runs.
- For the rule of Vue for the millisecond of the attach and the focus listeners of a part, see [`useRenderElement` and `useRender`](#userenderelement-and-userender). `addInputFocusListeners` in `filter-dropdown/input/FilterDropdownInput.ts` adds the focus listeners of an input in the sync flush of its function ref. Its JSDoc gives the two reasons. `useFilterDropdownInput`, `Menu.Input` and `Combobox.Input` call it.
- Measure frame work and parent and child renders when a gesture changes a style each frame. Compare the binding with a native write for the same slot content.
- The drawer popup, backdrop and indent read the current gesture sample when they render. For a dismiss gesture, native writes to the popup transform start after Vue patches the drag styles.
- `NumberField.ScrubAreaCursor` keeps its last transform for a render during a scrub. Vue owns one measurement box for the active cursor. The box enters the cursor's parent only for a measurement. Slot and portal selectors keep their original matches between samples.

#### Reconcile a native input

- An `<input>` part gives an uncontrolled default value with the key `value` on a server and with the key `defaultValue` in a browser. A server needs the key `value` to write the `value` attribute. In a browser, Vue sets the DOM property `value` again on each render, and that replaces the text that the user typed. The DOM property `defaultValue` is the `value` attribute, and Vue sets it only when its value changes. The key `^value` does not help, because a server of Vue 3.5.12 writes the attribute `^value`. `Toolbar.Input` and `Field.Control` are the examples.
- A controlled input requests a render when an edit can leave the model unchanged. `useInputRender` gives the part a `valueProps` binding and a `renderValue` function. Vue compares that binding with the input's live value and restores the text in the same element.
- Call `renderValue` after the change event. Vue renders a parent that accepts the edit before it renders the input. Move the caret or select a character after that flush.
- A value write can stop an active composition. `NumberField.Input` delays a refused edit during composition. Its timer requests a render after WebKit sends the final `input` event.
- Test the native value after accepted and refused edits, composition, autofill, reset and hydration. Restore the committed value only where it can differ from the browser value.
- Vue writes `value` of an input when it hydrates. The range input of `Slider.Thumb` thus keeps a value of before the hydration with `useHiddenValueBeforeHydration`. It takes a value that the browser restores after the mount with `useFormRestoreAsInput`. See [Parts with a hidden input](#parts-with-a-hidden-input).
- A part takes a pre-hydration edit after the mount flush because Vue writes the input value at hydration. A text input receives one `input` event. [Server render](#server-render) and [Parts with a hidden input](#parts-with-a-hidden-input) give the rules.
- The listener of the element itself gets each of these events. A Vue listener of an ancestor can skip one, because of the rule for the millisecond of the attach in [`useRenderElement` and `useRender`](#userenderelement-and-userender).
- A native reset of a form changes the value of an input and sends no `input` event. A part that holds state for that value follows the reset with `useFormReset` of `src/internals`. It clears the error of its field with the function that `useClearFieldError` returns. [Parts with a hidden input](#parts-with-a-hidden-input) gives the rules. `Field.Control` is the example.

#### Release and restore work across a KeepAlive hold

- KeepAlive preserves the part's state. A hold releases visibility-bound scroll locks, modal marks, document listeners and timers. Activation restores them.
- A dialog reports its open state to the dialog above it. While `KeepAlive` holds the dialog, it reports that it is closed. The dialog above is then the top dialog again, so Escape closes it. The report comes back at the activation.
- A drawer in a `Drawer.Provider` reports its open state to the provider, and a drawer can hold a close watcher. While `KeepAlive` holds the drawer, it reports to the provider that it is closed, and it destroys its close watcher. Both come back at the activation.
- A nested drawer reports the height and the presence of its popup to the drawer above it. While `KeepAlive` holds the nested drawer, its popup reports a height of 0 and no presence. Both come back at the activation.
- A part that clears a timer when `KeepAlive` holds it also ends the state that the timer would end. `ScrollAreaRoot.vue` ends its scrolling state.
- A part that follows a pointer ends that state when `KeepAlive` holds it, because `KeepAlive` sends no leave event. `ScrollAreaRoot.vue` does this for its hover state.
- At a `KeepAlive` hold, `useSwipeDismiss` clears a pending press and ends an active swipe. A new swipe needs a new press after activation.
- `useSwipeDismiss` calls no `onCancel` when it ends a swipe at the hold. A part that keeps a swipe state of its own thus ends that state in its own `watch` of `isHeld`. `Drawer.SwipeArea` removes its swipe styles from the popup and the backdrop, and it lets an outside press close the drawer again. It does the same when it unmounts during a gesture, because no release comes then (`VUE-57`).
- A part that reads `:hover` at mount reads it again when `isHeld` of `useKeepAliveState` becomes `false`. No enter event comes for a pointer that is already over the part. `ScrollAreaViewport.vue` does this. A part that mounted in a held branch reads it at its first activation.
- An effect that reads the DOM stops while `KeepAlive` holds the part. A `watch` of `isHeld` with `flush: 'sync'` runs the cleanup of the effect at the hold, and runs the effect again at the activation. `useCollapsiblePanel` gives its size effect and its close effect to `useDomEffect`. A panel that mounts in a held branch runs both effects at its first activation, as a panel in a shown branch does at its mount.
- The revert of a `beforematch` reveal in `useCollapsiblePanel` is an exception to the timer rule. The hold stops its timer and its frame and keeps the reveal, and the activation runs the revert (`VUE-133`). The browser removes `hidden` in the task of `beforematch`, after the listeners, so the browser can still write the element after a hold.
- `useUnmountAfterClose` is the exception. A close that is in progress when `KeepAlive` deactivates the root completes, and `onUnmount` runs one time. A wait that starts again at the activation would play a keyframe exit a second time. An open change can also complete while `KeepAlive` holds a popup that first mounted in the held branch (`VUE-137`).
- `onActivated` also runs at the first mount in a `KeepAlive`. When the part mounts with its branch, `isHeld` of `useKeepAliveState()` does not change at that call. A part reads `isHeld` and keeps no `KeepAlive` flag of its own. The part reacts to a change of `isHeld` with a `watch`. Work that must run in the hook of `KeepAlive` has `flush: 'sync'`. ESLint refuses source imports of `onActivated` and `onDeactivated` outside `useKeepAliveState.ts`.
- A part that mounts in a branch that `KeepAlive` holds gets no `onDeactivated` call. Its first `onActivated` call comes with no `onDeactivated` call before it, so a flag that only `onDeactivated` sets is not set at that call. `useKeepAliveState()` of `src/internals` starts `isHeld` with `isInHeldBranch()` in `setup`. It ignores the call in the flush of the mount only when the part mounts with its branch. A deactivation in that flush ends this rule, so a show after it sets `isHeld` to `false`. `shown` counts each other activation. An app that mounts in a detached element is not held, because no `KeepAlive` holds it.
- A part that stops an effect that reaches out of the branch reads `isHeld`. At a mount in a held branch, `isHeld` is `true` from `setup`. `useFloatingPortalNode`, `useDomEffect`, `useScrollLock`, `useDismiss`, `useFloatingFocusManager`, `useDialogRoot`, `DrawerRoot.vue`, `DrawerPopup.vue` and `DrawerViewport.vue` do this. A popup that mounts in a held branch thus stays out of the document until the activation. Until then it takes no scroll lock, no modal marks and no focus, and it does not close on a press outside it. It reports no open state to a dialog or a drawer above it, or to `Drawer.Provider`. At the activation, it takes the place that a popup that mounts in a shown branch has (`VUE-5`). `useTooltipCursor` adds no window listener until the activation. `ToastRoot.vue` and `usePopupAutoResize` measure nothing until the activation, because a read of the layout in a held branch gives 0. `ResizablePanel.vue` and `ResizableHandle.vue` give `isHeld` to their registration with the root, so a root gives no room to a panel that is not in the document. `ResizableRoot.vue` takes the panels of its first activation as the panels of its mount, so that activation emits no change. `useFloatingNodeId`, `Toast.Provider` and `useFormRestore` also read `isHeld`. The node of a popup that mounts in a held branch counts as open only from the activation, so a popup above it closes on Escape. A provider that mounts in a held branch starts no timer of a toast until the activation. `useFormRestore` adds no `pageshow` listener until the activation.
- The handle attach of `usePopupRoot` is the exception. A root that mounts in a held branch attaches until its `onMounted` hook, so that a part below it can call the handle in `onMounted`. [Popup store](#popup-store) gives the rule.
- A part does work that a user meets at the show, such as a read of `:hover`, in a `watch` of `isHeld` with `flush: 'sync'`. A part that mounted in a held branch thus does that work at its first activation. `NavigationMenuTrigger.vue` does this. `useSetFieldFocused` does this for a focus that no focus event reported.
- A part that mounts in the flush of an activation also starts held. Vue clears `isDeactivated` after the renders of that flush, and the part then gets `onActivated` in the same flush. `useKeepAliveState` reads `isInHeldBranch()` in `setup` to find such a part, and that `onActivated` call sets `isHeld` to `false`. The order of `onActivated` and `onMounted` cannot show such a part, because that order changes. The part gets `onActivated` first when a component of the branch mounts the part from its own state. It gets `onMounted` first when the root of the branch gets the part from a prop. `KeepAlive` then mounts the part in its patch of the root, before it queues the hooks of the show.
- Where the effect is a `watch` with `onCleanup`, `isHeld` is in the sources of that `watch`, and the callback returns while it is `true`. `useInputRegistration` does this for the registration of an input, and `useCollapsiblePanel` does this for the timer and the frame of the revert of a reveal.
- While `KeepAlive` holds a part, `useFormReset` and `useFormEntryValue` listen on the form of the input. At activation, the change of `isHeld` starts their root subscriptions. `useAriaLabelledBy` and `useFieldsetDisabled` have no observer while `isHeld` is true. This includes a part that detects a held branch at mount. A part compiled as a Vapor component does not know that it mounts in a held branch. Its root node is then the detached element of `KeepAlive`. The observer on the last document or shadow root, or on the owner document, sees the branch return there.
- `KeepAlive` moves a branch out of the document before it calls `onDeactivated`. An effect that a change queued earlier in the same flush can run in that gap. A read of the layout of an element of the branch then gives 0 or an empty value. An effect that runs again at the activation and only writes a measured value can run in the gap. An effect that keeps a choice from such a read returns while the element is not in the document (`isConnected`). `SelectPopup.vue` does this for the trigger in its placement. Its popup is in a `Teleport` and stays in the document in that gap.

#### Choose among registrations

- `useLabel` registers a label with the labelable context. With `registerLabelId`, it also registers the label with a root of its own.
- `useElementRegistration` watches the resolved element. If a getter still returns the same element, a later owner keeps its registration.
- A registration that the server HTML needs runs one time in `setup`. Register a getter for the value, so that a later change needs no new registration. Remove the registration in `onScopeDispose`. `useLabel` and `useRegisteredMessageId` do this.
- A server stops an immediate watcher with the default or post flush after its first run in `setup`. A cleanup that removes the registration would run before the children render.
- A registration from which a provider picks one value among many parts runs in `onMounted`. A control that replaces another control then registers after the old control left the registrations. `useLabelableId` does this for the id of a control, with a `watch` for a later change. `useRegisterFieldControl` does it for the control of a field. It registers one getter for all the values of the control. A `watch` registers the same getter again when the `id`, the `name`, the value or `enabled` of the control changes. `useLabelableId` registers the `id` of the control element in `setup` with `useRegisteredId`. That getter gives the id that the control binds before the mount, and the `id` of the control element from the mount on.
- `Collapsible.Panel` registers its id in `setup` with `useRegisteredId`, and the root takes the id of the last registration. A panel that replaces another panel then registers after it. The root has no panel id while no panel is registered, and an item of an accordion has no trigger id while no trigger is registered. Base UI gives a generated id until the first such part mounts, and that id can be the id of no element (`VUE-80`).
- `Dialog.Title` and `Dialog.Description` register a getter of the `id` of their element in `setup` with `useRegisteredId`. `useDialogInteractions` of `dialog/root/useDialogRoot.ts` makes one registry for each kind. It writes the id of the last registration to `titleElementId` or `descriptionElementId` of the store. Base UI clears that id when any part of the kind unmounts, also when another part of the kind stays.
- `Popover.Title` and `Popover.Description` register their ids in the same way. `Popover.Root` makes the two registries.
- Release a registration on watcher invalidation when its source changes. Release a lifetime registration on scope disposal. Vue disposes the old scope before the replacement's mount hook.
- A compiled template can mount a new part before it unmounts the part that it replaces. A removal by value then removes the value of the new part.
- Thus register a value that two parts can have by source: a `Map` with one entry for each part. `createIdRegistry()` of `src/internals/labelable-provider` does this for the controls, the labels and the messages, for the controls of a field, for the panels of a collapsible, for the triggers of an accordion item, for the titles and the descriptions of a dialog, of a popover and of a toast, and for the labels of `Menu.Group` and `Menu.RadioGroup`.
- `KeepAlive` takes the DOM of a deactivated part out of the document. The id of that part then must not stay in a `for`, an `aria-controls`, an `aria-owns`, an `aria-labelledby` or an `aria-describedby`.
- A registration with a provider registers a getter one time and keeps its entry and its place. The getter gives no value while `KeepAlive` holds the part. `useRegisteredId` does this for a label, a message and the panel of a collapsible, and `useLabelableId` does it for the id of a control. `usePickerPartElement` does it for the element of a picker field or trigger. `useRegisterFieldControl` does it for the control of a field, with one difference. It registers the getter again when a value of the control changes, and the entry then goes to the end of the registry.
- The getter of such a registration reads `isHeld` of `useKeepAliveState`. `KeepAlive` runs the `onActivated` hooks of one branch from the last part to the first part. A new entry in that hook would reverse the order of the parts.
- `useRegisteredLabelId` registers a getter of the referenced id and the element with the root, by source, and removes the entry in `onScopeDispose`. While the root is not mounted, the label registers in `setup`, for the server HTML and the hydration. After the root is mounted, the label registers in `onMounted`, so that the root does not name it before it has an element. The getter gives no value while `KeepAlive` holds the label.
- `useLabelId` computes `labelId` as the last registered label in document order (`VUE-131`). React runs the effects of a branch that `Activity` shows in tree order, so the last label of the branch wins there too. `KeepAlive` runs its hooks from the last part to the first part, and a label that mounted later can be before another label. A `computed` in document order does not depend on the order of the hooks or of the mounts.
- Use a computed to read the current registrations at the time of the read. The labelable provider computes `controlElementId` from the selected id and the ids on the elements. Its default-flush watcher waits for the batch of control registrations and keeps the selected id while a control still claims it.
- An action of a part that needs the registrations of other parts runs in a `watch` of `shown`. In its own hook, the parts before it are still held and give no value. `useLabelableId` does this for a control with no id: it takes the default id of the provider again.
- The first active control supplies the initial value for dirty comparisons, even when several controls mount in one patch. The active control of a field is the last control of its registry that gives a registration. A control registers again when its `id`, its `name`, its value or `enabled` changes, as the effect of Base UI does. When the active control goes away, the field uses the control that was active before it and is still there. Base UI has no control then.
- A field gives no value to its form while it has no active control. `fields` of the form context then does not list the field, so a form does not validate it, submit its value or focus its control. A form finds the first invalid control by the position of the controls in the document, as Base UI does.
- When `validation.registeredInputs` is empty, native validation uses the last input that a control gave to the field. A control releases its input before a parent deactivation hook can validate the field. The previous visible input takes its place (`VUE-83`). Inputs from the same activation return in document order.
- The registry of a composite is different: it holds elements and sorts them by their position in the document. See [Composite](#composite).

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
- `packages/vue/vitest.config.ts` sets two preferences of Firefox and runs the test files of Firefox one at a time. Its comments give the reason for each. Do not set `browser.importMapMocks` to `true`: Vitest then refuses a mock in Firefox.
- The job `test-browser` of CI runs the Firefox tests and the WebKit tests in shards. The comment of its matrix in `.github/workflows/ci.yml` gives the reasons. To run one shard on your machine, add its flag: `pnpm test:firefox --shard=1/3`. Add a WebKit shard when the files of a shard pass about 400.
- On a pull request, the job `select` runs `scripts/ci/selectTests.ts` on the changed files. Each test job and `test-nuxt` then run only what those files can change. The script gives each list of files and its reason. The merge queue skips `select`, and each test job runs each test file.
- Keep a file that a test reads by a path, and does not import, in the folder of the test or below it. For a file elsewhere, add its path to the list of files in `scripts/ci/selectTests.ts` that run each test file.
- Set the `timeout-minutes` of a CI job to 1.5 times the 95th percentile of the time of its passed runs. Use the runs of the merge queue, not of a pull request. A job of a pull request can run only some of the test files. If the result is not a multiple of 5 minutes, increase it to the next multiple. For a job with a matrix, use the slowest entry. When a passed run takes more than two thirds of the limit of its job, measure the job again.
- On macOS, `packages/vue/vitest.config.ts` starts WebKit with full keyboard access, through `test/webkitFullKeyboardAccess.sh`. The comments of both files give the reasons. Full keyboard access does not put a link in the order of the Tab key. A case that moves the focus to a link with the Tab key thus fails in WebKit on macOS.
- On Linux, Chromium keeps a block of shared memory for each module that a new test frame loads again, until a garbage collection frees it. A page that holds about 16,000 blocks loses its connections. Vitest then reports `Browser connection was closed`, and the job fails with no failed case.
- CI sets `VITEST_CHROMIUM_GC_DISK_THRESHOLD_GB`, so Vitest collects the garbage of Chromium after each test file. `.github/workflows/ci.yml` says how the variable works.
- On CI, each test file of a WebKit job adds about 23 MB to the used memory of the runner until the job ends. The runner has 16 GB. The browser command `collectGarbage` of `test/server/collectGarbage.ts` does not free this memory.
- Vitest keeps the modules that it transforms for Node in `node_modules/.vitest-cache` at the root of the repository, and the next run uses them again. These are the modules of the Node tests and the modules that `renderOnServer` imports. A CI job starts with no such folder, so it transforms each module. To measure the time of a test as CI does, add `--no-fsModuleCache`: `pnpm test:webkit --no-fsModuleCache`.
- The project `vapor` runs the browser tests in Chromium, and `render` mounts each test in a Vapor app. The project needs Vue 3.6, so `pnpm test` leaves it out. The job `test-vue-rc` runs it.
- The project `vapor-parts` compiles each part SFC as a Vapor component. Test SFCs keep their component mode. `render` mounts each test in a Vapor app, as in the project `vapor`. The keys of `packages/vue/test/vaporParts/expectedFailures.json` are the test files of the project. Each file lists the cases that fail for a cause in Vue, with a cause id. Each cause has a summary and an issue link.
- The run fails when an unlisted case fails. Correct the fault. For a cause in Vue, add the case with its cause to the list. A fault of Vase UI gets no entry.
- Vitest reports `Expect test to fail` when a listed case passes on the release candidate. Remove that entry. An entry for a case that the file lacks also fails the run. Correct or remove it. A file key that names no file stops Vitest at the start.
- To add a file, add its key with an empty `fails` object. Run `pnpm test:vapor-parts`. Add only the cases that fail for a cause in Vue.
- The project `vapor-parts` needs Vue 3.6, so `pnpm test` leaves it out. Run it alone: it cannot connect beside another browser project in one run. When CI selects package tests, the job `test-vapor-parts` runs each listed file. The job uses the Vue version of `test-vue-rc`. The job has no `continue-on-error`, so a failure stays visible. The job installs a prerelease, so `required` does not need it.
- The optional job `test-vue-minor` checks the SHA-256 digest of each Vue tarball before it installs the pinned build. When you change the pin, record the reviewed tarball digests in `.github/workflows/vue-<commit>.sha256`. The job runs both `vapor` and `vapor-parts` in the Vitest mode `vue-minor`. Use that mode for an assertion that differs between the pinned build and the release candidate. The summary counts passes, failures and cases that did not run for each cause in `expectedFailures.json`. The job runs the cases for `vue-16301` as ordinary tests.
- Return a child array directly from a JSX slot so Vue can normalize each child. A Vapor slot reads a nested Fragment before Vue normalizes its children. The `vapor-parts` project checks the Fragments that JSX and `h()` create, starting at test collection. A `null`, `undefined` or boolean child fails the check even in a case with an expected Vue failure. Omit an absent Fragment child or use `createCommentVNode()`.
- To run `vapor` or `vapor-parts` on your machine, install the Vue version of their jobs: `pnpm --filter @vase-ui/vue add --save-dev --save-exact vue@<version>`. After the run, restore `packages/vue/package.json` and `pnpm-lock.yaml` with git. Then run `pnpm install`. Do not commit the release candidate.
- The hydration helpers and a test that makes its own app use an ordinary Vue app in each project. An ordinary app needs `vaporInteropPlugin` to render a part compiled as a Vapor component. The hydration helpers give their app to `installPartsInterop`, which installs the plugin in the project `vapor-parts` only. A test file of the list that makes its own app does the same. A test with a custom element gives `installPartsInterop` as `configureApp` to `defineCustomElement`.
- A test file with a name that ends in `.node.test.ts` or `.node.test.tsx` runs in Node with no DOM. Use it for server render and for logic that must work with no DOM.
- A `.node.test` file does not import `#test-utils`, because that index loads the libraries of the DOM helpers. To render a part, such a file imports `renderToString` from `vue/server-renderer` and the part directly.
- A family can have one `.node.test.tsx` file for the server render of the whole family, in the folder of its root: `progress/root/ProgressRoot.node.test.tsx`. A `replaced` Base UI case is the exception. It goes to the `.node.test.tsx` file of the folder of its Base UI test, as [How to port a test](#how-to-port-a-test) says: `fieldset/legend/FieldsetLegend.node.test.tsx`.
- There is no jsdom.
- A file with a name that ends in `.spec.ts`, `.spec.tsx` or `.spec.vue` is a type test. vue-tsc checks it, and no test runner runs it.
- A `.spec.vue` file is the type test of a template. Its first line is `<!-- @strictTemplates true -->`. vue-tsc then reports an unknown prop in that file, as it does for a consumer that sets `strictTemplates`.
- In this package, vue-tsc reports no unknown prop on a generic SFC, in a `.spec.vue` file also. The files that are not strict give each generic SFC a type that accepts each unknown prop. For such a part, write a line that must fail: `<!-- @vue-expect-error -->` before an element that gives the prop a value of a wrong type.
- The tests of `fixtures/nuxt` run in Node. They start the Nuxt app with `@nuxt/test-utils` and read its pages in Chromium. They are not part of `pnpm test`. The job `test-nuxt` of CI runs them, and `required` needs that job.
- The browser history test in `fixtures/vite` builds a client app that mounts in its entry module, and reads it in Chromium. The job `test-nuxt` runs it with `pnpm test:vite`. Firefox and WebKit restore no input of that page, because the app makes its inputs after the parse. The comments of the fixture give the other reasons.
- Build the package before you change Vue for the published fixture. Install the same Vue version in `packages/vue` and `fixtures/vite`. The jobs `test-nuxt` and `test-vapor-parts` show the commands for `test:published:floor` and `test:published:vapor`.
- The job `test-nuxt` runs the `typecheck` script of each fixture after the package build. vue-tsc checks the Nuxt app and the Vite fixture, including its hydration test and build configuration.

### How to port a test

A ported test uses a mapped path. Its `describe` and `it` titles use the upstream text with the Vase UI form of the library name. For example, `preventBaseUIHandler` becomes `preventVaseUIHandler`, and `Base UI handler` becomes `Vase UI handler`. Each local occurrence can match one upstream case or suite call, even when suites share a file. A test title of our own can name the upstream project as "Base UI".

- A ported case asserts each behavior that the Base UI case asserts. It can assert more.
- The body of a ported case can have a better form than the body of the Base UI case. A better form never asserts less.
- Examples are a wait for an event with `nextEvent` in place of a `waitFor` on a flag, and a direct assertion in place of a negative assertion in `waitFor`. More examples are a real event of the browser in place of a dispatched event, and a stricter assertion. See [Test rules](#test-rules).
- State each such change in the body of the pull request.
- Only a rule of this section or an exception row removes a Base UI assertion or makes it less strict. An example is the rule for a warning that only React DOM gives.

Where a case has no better form, it differs from the Base UI case only by these rules:

| Base UI test | Vase UI test |
| --- | --- |
| `from '@base-ui/react/<entry>'` | `from '@vase-ui/vue/<entry>'` |
| `from '@base-ui/react'` | `from '@vase-ui/vue'` |
| `from '@base-ui/utils/<file>'` | A relative path to `src/common/<file>` |
| `vi.mock('@base-ui/utils/<file>', …)` and `vi.importActual` of that module | The same calls with the relative path to `src/common/<file>` |
| `from '@mui/internal-test-utils'` | `from '#test-utils'` |
| `userEvent` of `@testing-library/user-event`, imported in the test | `user` of the `render` result: `const { user } = await render(…)`, then `await user.click(…)`. |
| A read of a `Menu`, `Select` or `Combobox` popup, or a press, directly after `await user.click(trigger)` | To read, `await screen.findByRole…`. To press, give the open to `waitForLaterMillisecond`. The popup opens a frame after `mousedown`; `user.click` can resolve first. To expect no popup, call `await waitSingleFrame()`, then `await flushMicrotasks()`. |
| `from '@floating-ui/react-dom'` | `from '@floating-ui/vue'` |
| A global name with `BASE_UI`, such as `BASE_UI_ANIMATIONS_DISABLED` | The Vase UI name, such as `VASE_UI_ANIMATIONS_DISABLED`. See [Layout and names](#layout-and-names). |
| `event.preventBaseUIHandler()` | `event.preventVaseUIHandler()` |
| `className` | `class` |
| `tabIndex` as a prop or as a key of a props object | `tabindex`. An assertion on the DOM property keeps `tabIndex`. |
| `noValidate` as a prop or as a key of a props object | `novalidate`. An assertion on the DOM property keeps `noValidate`. |
| `crossOrigin`, `referrerPolicy` or `srcSet` as a prop or as a key of a props object | `crossorigin`, `referrerpolicy` or `srcset`. A DOM property keeps its name. |
| `minLength` or `readOnly` as a prop or as a key of a props object | `minlength` or `readonly`. A DOM property keeps its name. |
| `autoFocus` that gives the focus to an element before the case acts | A `focus()` call after `render`, or in `onMounted` for an element that mounts later. React focuses such an element when it mounts. Vue does not, and the browser can ignore `autofocus` on an element that a script adds. Do not focus it in a function ref, because Vue can run that ref before the element is in the document. |
| `render={<x />}`, an element with no props | `as` |
| `render={<x a={b} />}`, an element with props of its own | Use a compiled `#render` slot fixture. Bind the slot props before the element's own props. |
| A render function | Prefer a compiled `#render` fixture with its content on the chosen element. Type the slot argument when the case needs a render function. |
| A case that expects a part to read an attribute of its `render` element, such as an `aria-label` | No counterpart. A part does not read the attributes of the element that its `#render` slot returns, other than an `id` that another part names. Give the case a `not-applicable` row. The attribute on the part gives the same result. |
| A case that expects another part to follow the `id` of a `render` element, such as the `id` of a list | `v-slots={{ render }}` with the `id` after the spread. The part, its store or its root reads the `id` of the element. See [Popup store](#popup-store). |
| A function as children: `<Part>{(args) => …}</Part>` | `v-slots={{ default: (args: Type) => … }}` |
| A handler key of a DOM event, such as `onKeyDown` | The Vue key, such as `onKeydown`. See [DOM event names](#dom-event-names). |
| A `Capture` listener on an element, such as `onClickCapture={fn}` | A spread: `{...{ onClickCapture: fn }}` |
| `{ nativeEvent: new MouseEvent('click') }` | `new MouseEvent('click')` |
| `ref` on the outermost vnode, or on a child of a plain element | Use a named template ref in an SFC fixture. In TSX, pass a function to `render` so the ref has an owner. |
| A `Wrapper` that forwards a ref | Expose the wrapper's element. Check the exposed value after conditional removal. |
| `React.createRef()` and `ref.current` | Use a named component or element ref. Read the declared `element` on a part. |
| `inputRef={ref}` | A ref on the part. Read `inputElement` of the component. |
| A `ref` callback on a part that acts on the element | For a patch-time or ref-forwarding case, call `props.ref` from the element's function ref before the action. Vue calls a function ref again on each patch. `actOnElement` makes a slot that acts once. |
| `{ current: value }` as a ref object | `shallowRef(value)` |
| `actionsRef` and `actionsRef.current?.validate()` | Read `validate()` from the root's exposed interface through a named component ref. |
| `useMergedRefs(a, b)` | For independent observers, use one ref callback that gives each observer the element or `null`. Assert the element that each observer receives. |
| A component that keeps the first ref callback that it got, such as `StaleRefButton` | Test the exposed element after replacement if the contract promises it. For a case solely about React callback replacement, record the reason in a parity exception. |
| `React.useState` in a test component | A `shallowRef` in the setup function of `defineComponent` |
| A forced render of the parent that must render the part again, such as `forceRender` of `React.useReducer` | A `shallowRef` count that the test binds to an attribute of the part, such as `data-render` |
| `React.memo` around a test component, so that a render of its parent does not render it again | Use stable props and slots to isolate the child. Vue updates it when its props, dynamic slots or tracked render inputs change. |
| `<React.Fragment key={x}>` around a tree that must mount again when `x` changes | `<Fragment key={x}>` of `vue`. A change of the key mounts the tree again. |
| `setProps({ children: <Part … /> })` | A `shallowRef` that the test component reads |
| `useIsoLayoutEffect` or `React.useEffect` in a test component | Assert the resulting state, DOM, focus or cleanup. Use a mount hook or a Vue flush when the assertion needs that boundary. |
| A layout effect of a parent that reads what the layout effect of a child wrote | A parent's post-flush watcher can precede a child's mount hook in the same flush. Read in the parent's mount or update hook when the case needs the child's published state. |
| A case that asserts that a part acts before the passive effects of React run | Assert the result before the next task when the public behavior has that deadline. Set the timer before the change, or at mount. Vue runs mount and unmount hooks in the flush. |
| A counter of renders that `React.useEffect` raises in a test component | Count `onUpdated` calls only when the case promises update isolation. The hook excludes the initial mount. |
| A component in `render` that counts its renders, such as `LoggingRoot` | For slot update isolation, count calls to the render slot. Compare them before and after the operation under test. |
| A count of renders that starts after `render`, for the positioner of a popup | For an isolation check, await `waitForPositioned(positioner)` before the baseline. The first position pass updates the positioner and leaves its descendants alone. |
| `useStableCallback(fn)` | `fn` |
| `element.focus()` in a case that reads the scroll position of a container | `element.focus({ preventScroll: true })`. Chromium scrolls the element into view in the call. Firefox and WebKit can scroll it later. |
| A `user.click` on an input, before a case sets the scroll position of a container that holds the input | `await waitSingleFrame()` after the click. In the frame after the click, Firefox can scroll that container again. That scroll replaces the position that the case sets. The helper waits for one animation frame. |
| A case that compares the result of `React.useCallback` or `React.useMemo` in two renders | Compare references when the public contract promises stable identity. A function or object created once in setup retains its identity. Record a parity exception only for behavior that has no Vue counterpart. |
| A case that changes a plain variable that an accessor of `createItems` reads, then renders the part again | The accessor reads a `shallowRef`, and the case writes the ref. The root calls the accessor in a `computed`. A change of a plain variable does not make it call the accessor again, and a change of a ref that the accessor read does. |
| A commit count from `React.Profiler` | Assert the DOM change that the consumer can see. Count updates only when isolation is the subject. Observe the portal target for DOM mutations in a popup. |
| `store.subscribe(listener)` that records each notification of the store | Use a sync watcher for each distinct published value, a default watcher for a batch, or a listener for an imperative command. Check duplicate suppression and the value before descendants update when the contract requires them. |
| `ReactDOM.createPortal(children, container)` | `<Teleport to={container}>` |
| A case that presses a node in a React portal, or sends it a key, to show that the part ignores it | A native event follows its DOM path, including any shadow slot. When a `Teleport` moves the target outside the part, the part can still receive the event through an explicit relay. Give the case a `not-applicable` row if the event cannot reach the part. |
| `render(node, { container })`, with a container in a shadow root | `render(<Teleport to={container}>{node}</Teleport>)`. `render` has no `container` option. |
| `ReactDOM.flushSync` in a listener of a test, to unmount a part | `unmount()` of the `render` result, which unmounts synchronously |
| `ReactDOM.flushSync` in a listener of a shadow root, so that `element.click()` acts as trusted input | A trusted click: focus the button, then `await userEvent.keyboard('{Enter}')` with `userEvent` of `vitest/browser`. The browser runs a microtask checkpoint after each listener of a trusted event, so Vue applies the update before the next listener. |
| `await flushMicrotasks()` before an event that must come after a timer of 0 ms of the part | `await wait(0)`. `flushMicrotasks` resolves in a message task, which can come before the timer. |
| The unmount of one part in a listener, where the other parts stay | A second `render` with a provider of the root context, and `unmount()` of its result. See `ScrollAreaThumb.test.tsx`, "handles the scrollbar unmounting…". |
| `<React.Activity>` with `mode` | `<KeepAlive>` around a child that the test renders only while it is visible. The title of the block stays. |
| `<React.StrictMode>` around the tree | No wrapper. Vue has no Strict Mode. |
| `createRenderer({ strict })` and `render(element, { strict })` | No option. Vue has no Strict Mode. The case runs one time. |
| `describe.each([false, true])('… (strict: %s)', …)` | `describe` with the mapped title. The block runs one time. |
| `it.each([false, true])('… (strict: %s)', …)` | `it` with the mapped title. The case runs one time. |
| A row of `it.each` that runs the case in Strict Mode | The row with no Strict Mode. Its label loses the words about Strict Mode. |
| A row of `it.each` that mocks `useId` to give `undefined`, as in React 17 | No counterpart. Remove the row of `it.each`. The case still matches, so it needs no exception row. `useVaseUiId` gives an id in `setup`. |
| `React.lazy(loader)` | `defineAsyncComponent(loader)`, then `await flushMicrotasks()` before the assertions |
| `act(fn)` | `fn()`, then `await flushMicrotasks()`. Where `fn` makes the part start a 0 ms timer, see [Test rules](#test-rules). |
| `ignoreActWarnings()` | No call. Vue gives no warning about `act`. |
| `React.startTransition(() => setX(value))` | `void nextTick(() => { x.value = value; })`. Vue has no low-priority update. The write comes in the tick after the event. |
| A write in `React.startTransition` that renders a component that suspends, and a later write that drops it | A `<Suspense>` whose default slot gets a component with an `async setup` that awaits a promise that never resolves. A resolved `<Suspense>` keeps its content while a new branch is pending, as a transition does. The title stays. |
| A key press directly after an open, in a case that upstream runs only in jsdom | First wait for the focus of the item, as [Test rules](#test-rules) says for a focus in an animation frame. In a browser, the focus moves into the popup one animation frame after the open. |
| `act(() => trigger.focus())` on the trigger of a closed Select, before a key | Focus the trigger, then wait with `waitFor` until the items exist. The trigger mounts the items in a 0 ms timer. `flushMicrotasks` resolves in the next task, and a browser can run that task before the task of the timer. |
| A read of a part right after `render`, where the part mounts after the first measurement | `await flushMicrotasks()` after `render`, then the read. The `render` of Base UI runs in `act`, which runs the microtask of the measurement. |
| `toBeVisible()` on a part of an open popup that has no trigger | Add a trigger. The positioner has no anchor, so it has no first position and keeps `opacity: 0`. |
| `clock.withFakeTimers()` of `createRenderer()` | `vi.useFakeTimers()` in `beforeEach`, and `vi.useRealTimers()` in `afterEach` |
| `clock.tick(n)` | `vi.advanceTimersByTime(n)`, then `await flushMicrotasks()` |
| `clock.tickAsync(n)` | `await vi.advanceTimersByTimeAsync(n)`, then `await flushMicrotasks()` |
| `clockOptions: { shouldAdvanceTime: true }` of `createRenderer()` | `vi.useFakeTimers({ shouldAdvanceTime: true })`. A file that asserts a time limit gives no option, and a case of that file that calls `user` calls `vi.useRealTimers()` first. See [Test helpers](#test-helpers). |
| `advanceReactClock(clock, n)` | `await flushMicrotasks()`, `await vi.advanceTimersByTimeAsync(n)`, then `await flushMicrotasks()`. The async form runs the flushes of Vue between two timers. |
| `renderHook(() => useX())` | A component in the test that calls the composable in `setup` and gives the result to the test |
| `toasts` of `Toast.useToastManager()`, such as `toasts.map(…)` or `toasts[0]` | `toasts.value`, because the composable returns a ref |
| A React element as the label of a toast, such as `title: <strong>Saved</strong>` | A function that returns the vnode: `title: () => h('strong', 'Saved')`. A toast keeps no vnode. |
| A React element in a row of `it.each` or `describe.each`, or in a constant that a case renders | A function that returns the vnode. The case calls it. See [Test rules](#test-rules). |
| The label of the toast as the children of its part, such as `<Toast.Title>{toast.title}</Toast.Title>` | `<Toast.Title />`. The part shows the label of its toast. A default slot counts as content also when it renders `undefined`. |
| Children of a label part that are `undefined` in one state, such as `{explicit ? 'Title' : undefined}` | `v-slots={explicit ? { default: () => 'Title' } : {}}`. The part then has a default slot only while it has content. |
| A function component that calls a hook and spreads the rest of its props | `defineComponent` with a setup function that returns the render function. Declare the props that the hook reads. Set `inheritAttrs: false` and spread `attrs`. |
| A function component of a test with a prop that starts with `on`, such as `onRenameClick` | `defineComponent` with a setup function and `props: ['onRenameClick']`. Vue passes an undeclared `on…` prop to the root as a listener. It warns when that root renders a fragment, as a part with no element does. |
| `useTestInteractions([useX(…), …])` in a test component | The same call in `setup`. In the render function, call the functions of the result that the upstream test component calls. A call of these functions in `setup` reads the props only one time. |
| `useTestInteractions([useX(…)])`, where `useX` returns listeners with no `reference`, such as `useTriggerFocus` | Call `useX(…)` in `setup`, and spread the object that it returns on the trigger: `<button {...props} />`. The object has the listeners and no `reference` member. |
| `<CompositeList>`, `<CompositeRoot>` or `<CompositeItem>` in a test | The fixture part of `packages/vue/test/fixtures`, imported with the upstream name |
| `useFloating` of `test/floating-ui-tests` | No change. Some ports import `test/fixtures/useFloating.ts`, which re-exports the helper. Import the helper by its path. |
| `floatingStyles` and `middleware` of that `useFloating` | No counterpart. The helper returns no styles and takes no middleware. Remove the `style` binding and the option. |
| A component of `test/floating-ui-tests`, such as `Grid` | A component in the test file that renders it. It keeps only what the cases read. The upstream file has a `not-applicable` row in the family of that test file. |
| `Navigation.tsx` of `test/floating-ui-tests` | The same path, because the family `focus` ports the file. Its style sheet is a set of style objects, because the package has no type for a CSS module. |
| A direct call of `userEvent`, such as `userEvent.hover(element)`, where each call needs a new pointer | Keep the direct call. It makes a new instance, so its pointer does not leave the element of the call before. |
| `resetBrowserPointer()` of `#test-utils`, in a `beforeEach` hook or in `onTestFinished` | No counterpart. Remove the call. `test/setup.ts` moves the real pointer of the browser off the page after a test that put it there. |
| `isScrollLocked(doc)` of `#test-utils` | `isScrollLocked(doc)` of `test/fixtures/scrollDocument.ts`. It reads the computed overflow of the element that scrolls the page, and the marker `data-vase-ui-scroll-locked`. |
| `pointerEvents: 'none'` in the `style` of an element, where it only keeps the real pointer off the element | No such property. `test/setup.ts` moves the real pointer of the browser off the page after a test that put it there. |
| `{Esc}` in a `keyboard` call of user-event | `{Escape}`. user-event sends the key `Esc` for `{Esc}`. React changes that key to `Escape`. Vue gives the event of the browser, and the parts compare the key with `Escape`. |
| A `beforeEach` hook at the top of a file that also has cases of Vase UI's own | The same hook in each `describe` block of the Base UI cases. A hook at the top runs for each case of the file. |
| A `beforeEach` hook that gives `HTMLElement.prototype` the property `inert` | No counterpart. jsdom has no `inert`, and a browser has it. |
| A read directly after a `fireEvent` call, before the effects of the part run | Keep the promise of `fireEvent`, make the read, then `await` the promise. An `await` before the read lets the effects run first. |
| `renderToString` of the renderer, with no `hydrate()` | A case in the `.node.test.tsx` file of the same folder, with `renderToString` of `vue/server-renderer`. Give the upstream case a `replaced` row. |
| `renderToString` of the renderer, then `hydrate()` | The case stays in the ported test file with its mapped title, so it needs no row. Use `renderOnServer` and `hydrate`, which need a browser. A case that acts on the server HTML before `hydrate()` calls `hydrateAfter`. See [Test helpers](#test-helpers). |
| A `React.Suspense` around a part, so that the part hydrates after its root | A fixture SFC with `defineAsyncComponent(() => Promise.resolve(Part))` inside `<Suspense>`. Hydrate it by hand. See [Test helpers](#test-helpers). |
| `expect(fn).toErrorDev(message)` or `.toWarnDev(message)` | A spy that has `mockImplementation`, on `console.error` or `console.warn`. Call `fn`. Assert that the spy got that one call: `toHaveBeenCalledExactlyOnceWith(message)`. The message starts with `Vase UI:`. |
| `toErrorDev` for a warning that React DOM gives, such as the warning for a `NaN` value | No counterpart, because Vue gives no such warning. The case runs with no wrapper and keeps its other assertions. State the removal in the body of the pull request. |
| A `console.error` spy around a `render` that rejects, and no assertion on the spy | No spy. React writes the error of a component to the console, and Vue does not. Assert the Vue warning in the list of `takeReportedMessages()`. See [Test rules](#test-rules). |
| An assertion that no call of a console spy holds a text: `mock.calls.some(...)` is `false` | `expect(takeReportedMessages()).toEqual([])` at that step, with no spy. It asserts that no message of any text came until then. |
| A count of the calls of a console spy that hold a text: `mock.calls.filter(...)` | Compare `spy.mock.calls` with the whole list: `expect(spy.mock.calls).toEqual([[first], [second]])`. |
| `childNodes`, `firstChild` or `nextSibling` on the element of a part | `children` or `querySelector` |
| A number as a length in a style object, such as `top: 1` | A string with its unit, such as `top: '1px'` |
| `<style dangerouslySetInnerHTML={{ __html: style }} />` | `<style>{style}</style>` |
| `toHaveComputedStyle(obj)` | `toHaveStyle(obj)`, which also reads the computed style |
| `toHaveComputedStyle({})` | `not.toHaveAttribute('style')`, because `toHaveStyle({})` fails for an empty object |
| `expect(element).toBeInaccessible()` | `expect(isInaccessible(element)).toBe(true)`. `#test-utils` exports `isInaccessible` of `@testing-library/dom`, which gives the same answer. |
| `toBeEmptyDOMElement` on a part with an empty default slot, or on the old target of a `Teleport` | `expect(element.innerHTML).toBe('')`, because the slot leaves empty text nodes. Vue 3.5.12 leaves an empty text node in the old target of a `Teleport`. |
| An event | Add `await`. Where the case depends on a 0 ms timer of the part, group the events of one browser task as [Test rules](#test-rules) says. |
| `expect(() => fireEvent.x()).not.toThrow()` | `await fireEvent.x()`. A listener that throws fails the test. |
| `fireEvent.click(element, { button: 2 })` | `await user.pointer({ keys: '[MouseRight]', target: element })`, a real press of the right button. React drops that click, and a browser sends none. |
| A drag release: `fireEvent.mouseDown(trigger)`, then `fireEvent.mouseUp(item)` | `fireEvent.mouseDown(trigger, clientCenter(trigger))`, then the same `mouseUp` call. A dispatched event with no point has the point (0, 0). An item ignores a release at the point of the press (`VUE-84`). |
| `contextMenu` at (20, 20), then `pointerMove` and a right `mouseUp` over an item at (24, 24) | The same calls, with `pointerMove` and `mouseUp` at (30, 30): 10 px from the open point on each axis. An item ignores a release within 8 px of the point where the context menu opened (`VUE-84`). |
| An enter or leave call of `fireEvent` on a descendant of the element that has the listener | The same call on the element that has the listener. The calls are `pointerEnter`, `pointerLeave`, `mouseEnter` and `mouseLeave`. The native events do not bubble. React makes its events from events that bubble, such as `pointerover`. |
| `fireEvent.mouseOut(a, { relatedTarget: b })`, where a leave listener of `a` must run | The same call, then `fireEvent.mouseLeave(a, { relatedTarget: b })`. React makes the leave event of `a` from `mouseout`. A browser also sends `mouseleave`. |
| A `pointerout` event that a case builds and dispatches to run a leave listener | A `pointerleave` event on the element that has the listener. React makes `onPointerLeave` from `pointerout`. The native `pointerleave` does not bubble. |
| `fireEvent.change(input, { target: { value } })` on a text or range input | `fireEvent.input(input, { target: { value } })`. Vue reads edits from the native `input` event. |
| `fireEvent.focus(element)` and `fireEvent.blur(element)` on a part that has a focus handler | `fireEvent.focusIn(element)` and `fireEvent.focusOut(element)`. The part listens to `focusin` and `focusout`, and a dispatched `focus` event is not one of them. |
| `event.preventDefault()` in an `onFocus` or `onBlur` handler of a consumer | `event.preventVaseUIHandler()` in the `onFocusin` or `onFocusout` handler. See [DOM event names](#dom-event-names). |
| `fireEvent.touchStart`, `touchMove` or `touchEnd` with a plain object in `touches`. A browser refuses it. | `fireTouch.start`, `move` or `end` of `#test-utils` with the same lists. See [Test helpers](#test-helpers). |
| A `setPointerCapture` call that must capture the pointer | A real pointer: `userEvent` of `vitest/browser`. `ScrollAreaScrollbar.test.tsx`, "track click by axis" is the model. |
| `waitFor` on a state that a timer of the part ends, directly after an event | A direct assertion after the awaited event. `fireEvent` resolves after the Vue flush, in the same task, so the timer cannot end the state first. |
| An engine condition (`isWebKit`, `platform.engine.gecko`, a Blink check) | No change |
| A case with no engine condition that fails in one engine, because the source has a branch for that engine | No condition. In that engine, the case asserts what the branch does, in place of the Base UI assertion. It reads the same flag of `platform` as the source. The CI of Base UI runs its browser tests only in Chromium. |
| A `beforeEach` hook that skips each case by the user agent of Safari | Remove the hook when each case passes in WebKit. State the removal in the body of the pull request. |
| `isJSDOM` | Always `false` |
| A case under `skipIf(!isJSDOM)` that sets `process.env.NODE_ENV` to `'production'` | A case in the `.node.test` file of the same folder, with `vi.stubEnv('NODE_ENV', 'production')`. Give the upstream case a `replaced` row. Vitest sets the value when it transforms a file for a browser. |
| A function child of `Combobox.List` | The slot `item`: `{{ item: ({ item }: { item: string }) => … }}` |
| An attribute on a part that renders no element, such as `data-testid` on `Combobox.Value` | Remove the attribute. Vue warns when a part with no element gets an attribute. |
| A case that removes an attribute of a part with `{undefined}` | A `replaced` row that names `VUE-103`. The case of the family gives `null` to remove the attribute, and it asserts that `undefined` keeps it. |
| A mock of `SafeReact.captureOwnerStack` | No counterpart. Remove the mock. Vue has no owner stack. |
| `user.hover` that must move the highlight of a list | `user.hover`, then `fireEvent.mouseMove(element, { movementX: 1 })`. Before a `pointerleave`, also `fireEvent.pointerMove(element, { pointerType: 'mouse', movementX: 1 })`. In WebKit, a list ignores a `mousemove` or a `pointermove` with no movement. |
| `fireEvent.mouseMove` with no movement that must move the highlight of a list | The same call with `movementX: 1`. In WebKit, a list ignores a `mousemove` with no movement. |
| A spy in a `render` element that counts the renders of a part | A `.test.vue` fixture that calls the spy in the `#render` slot. In TSX, each render of a parent gives the part new slots, and Vue renders the part again. |
| `reactMajor < 19` in a condition | Always `false` |

- TypeScript cannot infer the type of the parameter of a `v-slots` function.
- A render function of Base UI can return nothing, because the case only records the state. The slot of a Vue part must return an element: `<div {...props} />`. Without an element, the part gives a warning.
- Vue's JSX types declare no `Capture` attribute. Vue reads the suffix at run time.
- A helper component of a test can spread its props on a part. Give these props the type of the props of the instance, such as `InstanceType<typeof NumberField.Root>['$props']`. The type `NumberField.Root.Props` has no listener of an emit, such as `onValueChange`.
- A Vue handler gets the DOM event. It has no `nativeEvent`.
- React derives `which` of a keydown event from `keyCode`, and a Vue handler reads the native `which`. A constructed event gets `which` from `keyCode` in Chromium and not in Firefox and WebKit. A case that sets `keyCode` thus sets `which` to the same value.
- Vue binds a `ref` to the component whose render function makes the vnode. A vnode from the body of a test has no such component, so Vue drops its `ref`.
- Vue calls a slot in the render of the part that has the slot. A count that a slot reads thus renders only that part again. To render a root with no element of its own again, read the count in the render function of the test component.
- Vue has no ref forwarding. `resolveElement` reads the `element` that the `Wrapper` exposes.
- Vue sets a ref object after the render, and it calls a function ref during the patch. A part reads the exposed `element` during its own patch.
- `act` is a React function. `flushMicrotasks` is one of the test helpers.
- A function in `setup` reads the current props, so it needs no `useStableCallback`.
- A case that changes a prop between `0` and `-0` writes a `shallowRef` that the composable reads. Vue compares vnode props with `!==`.
- A `MutationObserver` can deliver several DOM changes in one callback. A delivery count alone does not measure component renders.
- Vue puts empty text nodes around a fragment. `childNodes` has them. `children` does not.
- A case under `skipIf(isJSDOM)` runs.
- A case that upstream runs only in jsdom (`skipIf(!isJSDOM)`) is ported to the browser, or it gets an exception row.
- Such a case that clicks a link adds a `click` listener on `window` that calls `preventDefault()`. A browser otherwise loads the `href`, and Vitest then cannot run the test file.
- A case that upstream skips with a `skip()` call in its body runs when it passes in each engine. Remove the call, and state the removal in the body of the pull request.
- A ported case can pass while the behavior in its title is broken. Add assertions that fail when that behavior breaks. State them in the body of the pull request. When the source has a branch for one engine, an added assertion for that branch reads the same flag of `platform`.
- A case that fires its own `load` and `error` events on a real `<img>` holds the events of the browser. A capture listener on `document` stops each event that has `isTrusted`. See `holdBrowserImageEvents` in `avatar/image/AvatarImage.test.tsx`.
- The counterpart of an upstream file of test components, such as `toast/utils/test-utils.tsx`, is a `.ts` file at the mapped path. It exports each component of the upstream file from an SFC with a `.test.vue` name. The lint refuses a `.tsx` file in `src` that is not a test. See [Test helpers](#test-helpers).
- `toErrorDev` and `toWarnDev` are custom matchers of upstream. For `.not.toErrorDev()`, assert that the spy got no call.
- `renderHook` is a function of `@testing-library/react`. A composable needs the `setup` of a component.
- Without `inheritAttrs: false`, Vue also puts the attributes on the root element of the test component. Each listener then runs two times.
- `createRenderer()` has no `renderToString`. A server render runs in Node with no DOM.
- The row for `renderToString` with no `hydrate()` has one exception. A case that reads the layout of the server HTML needs a browser. It stays in the ported test file with its mapped title, so it needs no row. Each other case of its `describe` block stays with it. Each case inserts the HTML of `renderOnServer` with a fragment of a range. See `server-side rendering` in `slider/thumb/SliderThumb.test.tsx`.
- A row for a `describe` block also covers each case of the block that has no counterpart. Give the block a `replaced` row only when each case of the block moves to the `.node.test.tsx` file. `useButton` does this for `server-side rendering`.
- Vue renders an async component after its loader resolves. `flushMicrotasks` waits for that render.
- A spy as a slot gets one object with the slot props. Assert the fields of the first argument of the last call: `spy.mock.lastCall?.[0].value`.
- A module namespace is read-only. A test that must change a flag of `platform` mocks the module, as `utils/popups/event.test.ts` does.
- Vue calls a function ref again on each patch. A case that asserts the calls of a ref gives the ref to `useRenderElement`, which calls it only when the element changes.
- Where Base UI polls a state that exists only while an animation runs, a ported case records that state as [Test rules](#test-rules) says. It can also set `VASE_UI_ANIMATIONS_DISABLED` to `false`. The titles stay.
- Where Base UI waits with `waitFor` for a flag that an `animationend` or `transitionend` listener sets, the ported case waits for the event with `nextEvent`. It gives the action and the start event (`after`), as [Test rules](#test-rules) says. For an element that mounts with the action, the case listens on an ancestor that exists before the action, such as the `container` of `render`. Make sure that no other element in that ancestor runs a transition or an animation in the same frames.
- Where Base UI waits with `waitFor` for the removal of an element after its exit, the ported case gets the element before the action and waits with `waitFor`, as [Test rules](#test-rules) says. A case that asserts when the part removes the element gets the exit animations from `nextAnimationsRead`. It waits for the `finished` promise of each animation, and then for `flushMicrotasks()`. Then it asserts the removal directly. The part removes the element in the microtasks after the end of the animation.
- Vue makes each element with the `document` of the page, also in an app that it mounts in the document of a frame. Such an element has the classes of the window of the page, and the DOM matchers refuse it. Assert `isConnected` in place of `toBeInTheDocument()`.
- Where the Base UI cases of a file declare the same test component, the ported file can declare that component one time. A prop of the component gives a difference between the cases.
- Vitest fakes `requestAnimationFrame` with the other timers. With fake timers and `VASE_UI_ANIMATIONS_DISABLED` set to `false`, a closed part stays in its exit until the test moves the clock. A ported jsdom case that asserts a part in its exit thus sets the flag to `false`. With `true`, the part leaves at once.
- Where Base UI uses a short `waitFor` timeout to show that an open delay runs or does not run, a ported case asserts the open directly after the awaited event when the part opens in the task of that event. Otherwise the case records the time of the enter event and the time of the open in listeners. It then compares the difference with half of the delay. A slow run then cannot change the result.
- A Base UI case can start the timeout of a toast and then move the real pointer to the toast. On a busy machine, the command of the browser can take longer than the timeout, and the toast closes before the pointer comes. The ported case adds the toast with `timeout: 0` and moves the pointer to it. It then gives the toast its timeout with `manager.update`, and the timer starts paused because the pointer rests on the toast. Fake timers do not prevent this fault. While a command of `vitest/browser` waits for an element, as `click` and `hover` do, Vitest moves the fake clock by 50 ms every 50 ms. See `real browser input` in `toast/viewport/ToastViewport.test.tsx`.
- One `clock.tick(n)` of Base UI can run two timers. The second timer can read a state that Vue writes in the flush after the first timer. The ported case then calls `vi.useFakeTimers()` with no `shouldAdvanceTime`, and it moves the clock with `await vi.advanceTimersByTimeAsync(n)`. The async form runs the flush of Vue between the two timers, as a browser does. A clock that moves by itself can run both timers in one step. The case `closes the parent menu after a nested submenu closes on delayed hover-out` of `navigation-menu/root/NavigationMenuRoot.test.tsx` is the example.
- A case that moves the focus out of a popup with `fireEvent` dispatches all its focus events in one task: `await Promise.all([fireEvent.focusOut(…), fireEvent.focusIn(…), …])`. The Base UI case calls `fireEvent` with no `await`, so its events come in one task.
- The focus manager checks each `focusout` event in a microtask. A `focusout` event in the popup sets `insideComponentTree`, and the next check clears it. With all events in one task, the check of the first `focusout` clears the marker, and the check of the last one closes the popup. With an `await` between the events, the check of the last one clears the marker, and the popup stays open. `validates when the popup is blurred` of `Select.Root` is the model.
- A popup that is open at the mount takes the focus one animation frame later. A focus that a case gives to the trigger before that frame does not stay. The case first waits for the focus in the popup, as [Test rules](#test-rules) says for a focus in an animation frame.
- A Base UI case can press the trigger of a `Menu`, a `Select` or a `Combobox` while the exit of an earlier close runs. The popup is in the document during the exit, so a `findBy` query does not wait for the open. The ported case waits with `waitFor` for `aria-expanded="true"` on the trigger or the input before its next step.
- With `vi.useFakeTimers({ shouldAdvanceTime: true })`, the frame of a press of the trigger of a `Menu`, a `Select` or a `Combobox` runs before `await user.click(trigger)` resolves. Vitest moves that clock by 20 ms each 20 ms of real time. One step runs the timer that `user` waits for after the press. The same step runs the frame of the press, which is due 16 ms or less after the `mousedown`. The next `user` step waits for one more step of the clock, so its events come in a later millisecond of the mocked `Date.now()` than the open. A ported case under that clock can thus keep the read or the `user` step of Base UI directly after the press. The table row for such a step is for a case with a real clock.
- `Select.Trigger` mounts the popup element and its items in a 0 ms timer after it gets the focus. `Combobox.Trigger` mounts them after the focus and at `mousedown`, but not when `Combobox.Root` has the `items` prop. The popup element then stays in the document while the popup is closed, and its positioner has the `hidden` attribute. A `findByText` or `findByTestId` query thus finds an item of the closed popup, and it does not wait for the open. A `findByRole` query does not find an element inside a `hidden` element, so it waits for the open.
- A menu focuses a hovered submenu trigger in an animation frame. In a menubar, a case that hovers a submenu trigger and then moves the pointer into the submenu waits for that focus before the move. Wait as [Test rules](#test-rules) says for a focus in an animation frame. Until that frame, the menubar trigger can keep the focus. A pointer in the submenu then moves the focus from that trigger to a submenu item, and `useTriggerFocus` of the trigger closes the menu.
- `addEventListener` of `src/common` removes a listener with the `options` argument that it added it with, also when that argument is `undefined`. A case that asserts a call of `removeEventListener` with `toHaveBeenCalledWith(type, listener)` thus fails. The case asserts that one call has that type and that listener.

### Test helpers

The helpers are in `packages/vue/test`. `#test-utils` is `packages/vue/test/index.ts`. The types and the JSDoc of a helper are its contract, and the helper must obey them. The helpers keep upstream's names. This section gives only the rules that the code of one helper cannot give.

- `user` of the result of `render` is `userEvent.setup({ document })` of `@testing-library/user-event`, at the version that upstream pins.
- `user` waits for a timer after each action, so it does not return under a fake clock that does not move. A fake clock that moves with real time can end a timer of a part between two awaited steps. A browser can run the 0 ms timer of `user` in less than 1 ms. Thus a call of `user` does not wait for a later millisecond.
- `render`, `rerender`, `setProps` and `waitForLaterMillisecond(action)` end with a wait for a later millisecond of `Date.now()`. Vue then does not skip a listener that it attached during the change. Under a mocked clock, the wait moves the clock by one or more whole frames of 16 ms. `test/createRenderer.ts` gives the reasons and the limits.
- A helper file that `test/index.ts` loads imports `waitFor` from `waitFor.ts`, and `screen` and `within` from `queries.ts`, by a relative path, because `#test-utils` is that index. A test file imports them from `#test-utils`.
- After each test in a browser, `test/setup.ts` waits for each command of `userEvent` of `vitest/browser` that the test started. In Firefox, it closes any validation popup if a trusted `invalid` event reached the test window. Then it moves the real pointer off the page when the test put it there, and it waits for one 0 ms timer. The comments of that file give the reasons and the limits.
- `test/setup.ts` refuses a pointer lock in each engine. A test that needs a pointer lock mocks `requestPointerLock`.
- `describeConformance` has no hydration case. A server render needs the path of a module. The suite gets a vnode. The test of a part calls the hydration helpers.
- The `render` option of a `describeConformance` call for a portal part, and for each part in it, such as `Tooltip.Popup`, calls `await flushMicrotasks()`. The portal renders its element and its content in the flush after the mount.
- In the project `vapor-parts`, `describeConformance` also renders the part with a `#render` slot that uses no slot prop, and asserts the warning.
- Each shared suite is a function of `#test-utils`. The JSDoc of its config says what a call gives. The list below names each suite and the tests that call it:
  - `popupConformanceTests`, `positionerConformanceTests`, `detachedTriggersConformanceTests` and `viewportConformanceTests`: the tests of a popup family.
  - `popupListConformanceTests`: the tests of a popup that moves a highlight through a list of items, such as Menu, Select and Combobox.
  - `portalOwnPropsTests`: the test of each portal part that renders `FloatingPortal` and does not set `inPlace` (`VUE-135`). `Dialog.Portal` sets `inPlace`, so `DialogPortal.test.tsx` has a case of its own with `portal-owner-role`.
  - `dialogRootSharedTests`: the tests of the roots of Dialog and Alert Dialog.
  - `fieldsetDisabledTests`: the test of each native button part that reads `useFieldsetDisabled` (`VUE-112`).
  - `nestedPopupCloseTests`: the tests of Dialog and Drawer, for a popup that closes in the same update as a popup in it, before that popup, or alone (`BUG-5519`). The `BUG-6037` cases check that a popup with no trigger returns focus to the earlier menu trigger at close.
  - `hiddenInputSizeTests`: the test of a part with a hidden input that has no `name`.
  - `hiddenInputTypeTests`: the test of a part with a hidden input that `getHiddenInputType` types.
  - `heldMountFormResetTests`: the test of each family whose part calls `useFormReset`. `RadioGroup.test.tsx` calls it for `Radio.Root`, which follows a reset only in a group.
  - `heldMountListTests`: the test of each part that calls `useCompositeList` or `useCompositeRoot`.
  - `removedPartHydrationTests`: the test of a part that binds an `aria-*` value or a state attribute that a later part gives.
  - `popupFocusPropsTests`: the test of a popup that has `initialFocus` and `finalFocus`.
  - `popupAnatomyTests`: the test of a popup root with no popup part (`VUE-72`), and of a modal root whose positioner has not mounted (`VUE-61`). It also presses the Tab key past the open root in both directions (`VUE-132`), so each popup family has that case. Each family supplies `held` with its root and popup for the cases under `KeepAlive` (`VUE-137`).
- `internals/date-time/temporal.polyfill.node.test.ts` runs the cases of the `.test` files of the date and time helpers on `temporal-polyfill`. It calls `useTemporalPolyfill()` of `test/temporalPolyfill.ts` and then imports those files with `await import()`. A static import runs before the call, so a case table that reads `Temporal` when its file loads would get the native `Temporal`.
- A `.polyfill.node.test` file does not import a file that has a case with `vi.unstubAllGlobals()`, because that call removes the polyfill. To compare the server HTML of the native `Temporal` with the HTML of the polyfill, the file renders the native HTML before it calls `useTemporalPolyfill()`. `internals/date-time/field/field.polyfill.node.test.tsx` does this.
- The root of each date or time family has such a file beside its `.node.test.tsx` file. `time-clock/root/TimeClockRoot.polyfill.node.test.tsx` is an example.
- `test/animation.ts` has the helpers for a test of a transition or an animation. [Test rules](#test-rules) gives the rules for a case that uses them.
- A limit of `waitFor`, of a `findBy` query or of a helper of `test/animation.ts` is a count of frames. It is not a time. A busy machine can stall the page for some seconds. The page renders no frame during the stall, so the stall uses no frame of a limit. The browser ends a transition or an animation only in a frame. A part can move the focus into a popup in a frame.
- A test file does not write a `KeepAlive` branch with a flag for a later mount. A case of a part that mounts in a held branch renders `HeldBranch` of `createHeldBranch` in the place of the part. A form that a case needs goes into the helper.
- `expectType` is in `src/common/testUtils.ts`. In a `.ts` or `.tsx` file, put the `@ts-expect-error` of a call that must fail on the line before the name `expectType`.

The hydration helpers:

- `test/hydration.ts` has `renderOnServer(file, props)`, which renders a component on a server, and `hydrate` and `hydrateAfter`, which hydrate that HTML.
- A composition of parts, or a composable, needs a fixture SFC as `file`. Give it a name that ends in `.test.vue`, and keep it in the folder of its test. Vitest does not run such a file, and the lint rules of the source do not apply to it. Examples are `ProgressRootHydration.test.vue` and `UseIsHydratingProbe.test.vue`.
- A fixture part is a part that tests use in place of a part of a family, such as `CompositeRootPart.vue`. It is an SFC in `packages/vue/test/fixtures`. A composition of parts stays in the folder of its tests, also when more than one test file imports it.
- The props go to Node as JSON, so a prop cannot be a function.
- The browser projects share one Node process for `renderOnServer`. A fixture for a server render reads no global.
- To assert on the server HTML before the hydration, parse it in a `<template>` element. That parse has no side effect.
- The DOM matchers refuse an element of that parse, because its document has no window. Read the element with `getAttribute` and `querySelector`.
- `useValueBeforeHydration` sends the `change`, `blur` and `focusout` of a changed control one tick after its `input` event, and the events of a second control come in a later flush. A case that needs a state that these events set waits for that state with `waitFor`, such as `data-touched`.
- The navigation type of the test page depends on how the runner loaded the page. A case of a part that passes `restorable: false` thus calls `mockNavigationType(type)` of `#test-utils`.
- The `load` event of the test page has ended, so a part that mounts in a test does not wait for a `pageshow` event. A case of a render before the restore take calls `mockPageBeforeLoad()` of `#test-utils`.
- A case in which `load` ends while `KeepAlive` holds the part calls the function that `mockPageBeforeLoad()` returns, because the part reads `loadEventEnd` at its activation.
- A script that dispatches `pageshow` runs each listener in one task, with no flush between two listeners. A case in which the take of one part renders a later part before the listener of that part is thus a case of `fixtures/vite`, which a real restore of Chromium reaches. A case in which two inputs of one controlled parent take their values in two changes is also such a case. `Slider.Root` takes the inputs of all its thumbs in one change, so a case of a range slider can dispatch `pageshow`.
- To test what an inline script of the server HTML does before the app starts, insert the HTML with a fragment of a range, as `hydrate` does. Make the assertions before a mount. `internals/PrehydrationScript.test.tsx` is the model.
- To test a nonce, load an `<iframe>` whose document has a `Content-Security-Policy` in a `<meta>` element. Insert the server HTML into the document of the frame, and collect its `securitypolicyviolation` events.
- The browser sends each `securitypolicyviolation` event in a later task, in the order of the violations. A wait for animation frames does not wait for that task.
- To show that a part causes no violation, insert a control element with no nonce after the part inserts its elements. Wait for the event of the control with `nextEvent`. Then assert the whole list of events. `scroll-area/root/ScrollAreaRoot.test.tsx`, "sets the nonce, so that a policy that needs the nonce accepts the style element", is the model.
- Collect the events with a capture listener on the document of the frame. Add the listener before the mount of the part. `nextEvent` resolves in the listener of the target, and the case continues before a bubble listener of the document gets the event.

`hydrate` asserts after the mount and two ticks. It cannot test a part that hydrates later, such as an async component in `<Suspense>`. Hydrate such a part by hand, as `progress/value/ProgressValue.test.tsx` does:

1. Put the server HTML in a container in the document, and get the element.
2. Make the app with `installPartsInterop(createSSRApp(fixture, props))`.
3. Register the unmount of the app and the removal of the container with `onTestFinished`.
4. Mount the app on the container.
5. Call `await waitFor(…)` with one assertion on the new text.
6. Assert that the element is the same node. After a mismatch, Vue discards the server nodes.
7. Assert that `takeReportedMessages()` returns an empty list.

A case that acts between the server render and the hydration calls `hydrateAfter` with the action in `before`. A case that must assert before the two ticks hydrates by hand. An example is a wait for the load of an `<img>` of the server HTML. Such a case does steps 1 to 4. Where Base UI asserts immediately after `hydrate()`, it then calls `await nextTick()` and makes its assertions. Step 7 is its last step. See `avatar/image/AvatarImage.test.tsx`.

### Test rules

- Use only the Vitest APIs: `expect`, the functions of `vi`, such as `vi.fn` and `vi.spyOn`, and the DOM matchers.
- The DOM matchers are the matchers of `@testing-library/jest-dom`, as in Base UI. A ported assertion then has the same meaning.
- A `.node.test` file has no DOM matchers. `test/setup.ts` loads them only in the browser projects, and it gives the reason.
- `toHaveTextContent` passes when the text contains the string. To compare the whole text, use `expect(element.textContent).toBe(text)`.
- Give a DOM matcher an element, not a Vitest locator.
- A case that compares part HTML or asserts an empty element uses `withoutVaporAnchors`. For virtual DOM parts, it returns the element unchanged. For Vapor parts, it returns a deep clone without comments or empty text nodes. It keeps each element, attribute and nonempty text node, which includes white space.
- Put one assertion in each `waitFor`.
- In a test of `packages/vue`, do not give a wait a limit in seconds. A busy machine can stall the page for longer than the limit, and a correct part then fails the case. The tests of `fixtures/nuxt` run Playwright from Node, and their waits keep a limit of time.
- Where the absence of an element is true when the awaited action resolves, assert it directly. Advance the timers or flush first. Assert a state that a timer ends directly after the timer advances. Where a case waits for a first measurement, wait for a value that the measurement writes. Then assert the absence.
- To wait until an element goes, get the element before the action. After the action, call `await waitFor(() => { expect(element).not.toBeInTheDocument(); })`. Then assert the absence with the query.
- A part can remove an element in a timer or in a frame. `flushMicrotasks()` does not wait for a timer or a frame, so wait for the removal with the held element. An example is a popup that closes after `blur()`: the part closes it in a 0 ms timer.
- The action can be in a helper. `closeWith` of `test/detachedTriggersConformanceTests.tsx` calls `blur()` for the focus interaction. Read each awaited helper before you assert an absence directly after it.
- For a mouse, the browser sends `pointerdown` and `mousedown` of a press in one task, and the press moves the focus in that task. It sends `pointerup`, `mouseup` and `click` of a release in one task. The release comes in a later task than the press.
- A part can end a flag of such an event in a 0 ms timer. A case that depends on such a flag follows the tasks of the browser. It dispatches the events of one task in one call of `Promise.all`: `await Promise.all([fireEvent.pointerUp(…), fireEvent.mouseUp(…), fireEvent.click(…)])`. Each dispatch runs at its call, in the sequence of the list, so no task runs between them. For a press that moves the focus, the call that moves the focus is in the list, after the event. Between the press and the release, the case calls `await wait(0)`, so the timers of the press run first.
- A case of a drag whose result depends on the target of the click uses the real pointer. Call `userEvent.pointer` of `vitest/browser` with `[MouseLeft>]` and the start element as `target`. Then call it with `[/MouseLeft]` and the end element as `target`. The command scrolls to a target, and it does not scroll to coordinates. The browser selects the target of the click and sends the events of the release. Between the two calls, call `await wait(0)`. A person holds the button for more than one task, so each 0 ms timer of the press runs before the release. `dragOnto` of `utils/popups/interactions/useDismiss.test.tsx` is the model.
- A new or changed case of Vase UI's own that asserts what a part does when an element loses the focus moves the real focus. It waits until the element has the focus. Then it calls `blur()`, or `focus()` on another element. A dispatched `focusout` event does not move the focus, so `document.activeElement` is still the element.
- A part can also do other work in a 0 ms timer, such as the validation of `Field.Control` after Enter. `flushMicrotasks()` and a command of `userEvent` of `vitest/browser` do not wait for that timer. Wait for the result of that work with `waitFor`. To assert that the timer did no work, call `await wait(0)` after the action. The browser runs timers of equal delay in the order in which they started.
- To find a case that needs such a wait, wrap `window.setTimeout` in `test/setup.ts`. Add 5 ms to each delay. A message task, such as the task of `flushMicrotasks()`, then runs before a 0 ms timer. A case that then fails needs a wait. Do not commit the wrapper.
- A case that asserts that a timer did no work can pass with a broken part when the timer is late. The wrapper thus cannot find such a case. To check it, change the part so that the timer does the work that it must not do. Run the file of the case with the wrapper. The case must fail. Do not commit the change.
- Count runs, not repeats. Vitest reports a case as failed when one of its repeats fails, so `--repeats` cannot show that a case fails each time. Run the file 10 times. A case that sees the changed part fails in each run.
- One frame is not a wait for a 0 ms timer, because a frame can come before a late timer. An example is a modal popup, which locks the scroll of the page in a 0 ms timer after it opens. To assert that the page has no lock, call `await wait(0)` after the frame. To check a case that waits one frame, make the wrapper add 20 ms, not 5 ms. With 5 ms, the frame can still come after the timer, and the case then sees the work of the timer. A lag of 20 ms is longer than a frame (16.7 ms at 60 Hz). A frame that the case requests soon after the timer starts thus comes first, and the case does not see the work of the timer.
- `useTriggerFocus` starts a 0 ms timer when a trigger loses the focus. The timer must not close the popup when the focus moves to another trigger of the same popup or into the popup. A case can move the focus without a call of `focus()`. A hover of a trigger in a menubar moves the focus to that trigger while a menu of the menubar is open. A menu that opens can move the focus from its trigger into its popup. `switchTrigger` of `test/detachedTriggersConformanceTests.tsx` and `activateTrigger` of `test/viewportConformanceTests.tsx` wait for the timer for the focus interaction.
- A negative assertion on an attribute or a value can stay in `waitFor` when the case asserts the start state before the action.
- To wait for a presence, call a `getBy` query in the callback: `await waitFor(() => { expect(screen.getByRole('menu')).not.toBe(null); })`. The query throws while the element is absent.
- A case that tests the observer of the content waits for the first measurement, and then for two animation frames. The first notification of each observer then has come. If the content changes before it, the observer of the viewport measures. The case then does not test the observer of the content. `ScrollAreaContent.test.tsx` is the model.
- `waitFor` can resolve in the microtask checkpoint of a `ResizeObserver` callback, because a `MutationObserver` runs it. A change of the layout in that checkpoint gives the loop error of the browser. Call `await flushMicrotasks()` before the next change.
- A button of the real pointer stays pressed for each later test until a case releases it. A case that holds a button releases it in `onTestFinished`, with coordinates. A call with no coordinates moves the pointer to the element of the last press, which is gone by then. `releasePointerAfterTest` of `ScrollAreaScrollbar.test.tsx` does this. A case that only clicks or hovers holds no button, so it has no release.
- A case that holds a key with `userEvent.keyboard`, such as `{Shift>}`, has no release. Before the next test, Vitest releases each key that a command of the default `userEvent` holds. It also does this after a failure or a time-out in the command. Do not call `userEvent.setup()` of `vitest/browser`. Vitest does not release the keys of such an instance, and `test/setup.ts` does not wait for its commands.
- In WebKit, a list ignores a `mousemove` or a `pointermove` with no movement. WebKit gives a real pointer event the distance from the last point of the real pointer in the page as its movement. The first real pointer event of a page thus has no movement. After a hover with `userEvent` of `vitest/browser` that must move the highlight of a list, call `fireEvent.mouseMove(element, { movementX: 1 })`. Without that call, the item gets the highlight in WebKit only when an earlier test of the page moved the real pointer. Before the `pointerleave` of such a case, also call `fireEvent.pointerMove(element, { pointerType: 'mouse', movementX: 1 })`. After a key, only a `pointermove` makes the pointer the input of the list again. A `pointerleave` clears the highlight only while the pointer is the input.
- A test must fail when the behavior in its title breaks. Break the behavior in the source, make sure that the test fails, then put the source back.
- A case that changes an attribute of one part and asserts that another part follows it first waits for the renders of the open: two frames, then one task. Each render of the other part reads the attribute again. A change before the last render of the open thus passes with a part that does not follow. The cases of `VUE-109` are the model.
- A case passes each time that Vitest runs it again in one page, and each run tests the behavior in its title. `--repeats 1` runs each case a second time in the same page. The modules of the test file, the prototypes of the page and the module state of Vue and of Vase UI stay between the runs. To check a file, add the option to the command that runs it: `pnpm test:chromium SinglePart --repeats 1`.
- A case that replaces a method of a prototype or of a global object restores the original method when the case ends. `vi.resetAllMocks()` of the test setup keeps a spy in place, and `vi.spyOn` on a method that is a spy returns that spy. A later run or a later case thus gets the old spy. A spy whose implementation calls the method that it replaced then calls itself. `ignoreFocusOptions` of `FloatingFocusManager.test.tsx` is the model. A spy on `console.warn` or `console.error` does not need `mockRestore()`. `createRenderer` resets such a spy before it unmounts the apps of the test, and `vi.resetAllMocks()` resets it after each test. After a reset, the spy calls the method that it replaced, and that method records the call for the check of the test setup.
- When a case must see an async component before the component loads, its fixture calls `defineAsyncComponent` in `setup`. Vue keeps a loaded component in its definition, so a definition in the module is loaded in each later run. A server render that needs the loaded component uses a definition in the module. `CompositeItemAsyncComponent.test.vue` is the model.
- A case that counts the work that a module cache saves uses a key that no earlier run used. `combobox/root/utils/useFilter.test.tsx`, "makes no new collator when the collator options stay the same", is the model.
- Vue mounts a vnode one time. Vitest makes the table of `it.each`, `it.for` or `describe.each` one time, when it collects the file. It makes a constant of the module, or of a `describe` callback, in the same way. Each run of a case, and each case that renders such a constant, thus gets the same vnode.
- On a page that Vue hydrated, a second mount of a vnode hydrates each component of the vnode against the elements of the first mount. Vue then warns of a hydration mismatch in a case that hydrates nothing.
- Do not put a vnode in a row of a table or in such a constant. Write a function that returns the vnode. Call the function in the case. `ListboxSeparator.test.tsx` is the model.
- A type test can keep a vnode in a row or in a constant, because no test runner runs it.
- A test file that needs a Vue custom element defines the element one time, at the top of the file. `customElements.define` throws for a name that is already defined, and `--repeats` runs each case again in the same page. `number-field/scrub-area-cursor/NumberFieldScrubAreaCursor.test.tsx` is the model.
- A test fails when Vue warns in it, or when a call to `console.warn` or `console.error` reaches the console. `test/setup.ts` makes this check when the test ends.
- When a test expects a Vue warning, call `takeReportedMessages()` after the action. Assert the whole list that it returns. A `.node.test` file imports the function by a relative path to `test/reportedMessages`.
- Do not assert the error `Hydration completed but contains mismatches.` Vue writes it one time for each page. A case that expects a hydration mismatch removes that error from the result of `takeReportedMessages()`. It asserts each other message.
- A case that asserts that code handles a rejection adds a listener for `unhandledrejection` to `window` before the action. After the rejection, the case rejects a promise of its own with no handler. Then it waits for the report of that promise. The browser reports such rejections in their sequence, so each earlier report has come by then. While a case has such a listener, Vitest writes each report to the console. Assert the result of `takeReportedMessages()`. The case `toast/promise` of `test/demos.test.tsx` is the model.
- A part that throws in `setup` makes `render` reject with the error. Vue then warns `Unhandled error during execution of setup function`. Assert the messages with `expectSetupErrorWarnings(takeReportedMessages())`. With parts compiled as Vapor components, each parent part also reports the error in its render, and the helper permits those render warnings after the setup warning. A prerelease of Vue 3.6 also writes `Active effect was not restored correctly` to the console, and `test/reportedMessages.ts` drops that one message.
- Put such a case last in its file. In Vue 3.5.12, a `setup` that throws leaves the current instance set. A later case of the file can then get a Vue warning about a slot. In a Vapor app, a part of a later case can also find the context of the earlier case.
- A case that fails with virtual DOM parts in a Vapor app gets `{ fails: isVaporApp && !isVaporParts }`. Give the cause in a comment. `#test-utils` exports both flags. Vitest fails such a case when it passes, so the fix also removes the option. A case that fails only with Vapor parts gets an entry in `expectedFailures.json`, as [Where a test runs](#where-a-test-runs) describes. Do not use the modifier `it.fails`, because `pnpm parity:check` refuses it.
- After a `Maximum recursive updates exceeded` error, Vue runs no post-flush job in a later case of the file. Put a case that can give that error last in its file.
- A mock of a composable keeps the contract of the composable.
- A test that expects a `Vase UI:` message on the console asserts the list of `takeReportedMessages()`, or it uses a console spy that has `mockImplementation`.
- In the list, such a message is one string that starts with `console.warn: Vase UI:` or `console.error: Vase UI:`. Assert the whole list. The test then fails on a message that it does not expect.
- A console spy that has `mockImplementation` takes each call of its method, so those calls are not in the list. The test then fails on a call that it does not expect only if it asserts each call of the spy. A spy with no implementation passes the call to the console, and the test fails unless it takes the message from the list.
- A fixture that declares an optional Boolean prop and gives it to a part forwards its props with `useForwardProps`, or gives the prop the default `undefined`. The cast Boolean warning of the part otherwise fails the test.
- A case that has a console spy asserts each call of the spy. For one message, use `expect(spy).toHaveBeenCalledExactlyOnceWith(message)`. For more than one message, compare `spy.mock.calls` with the whole list.
- Do not select the calls of a console spy by their text. Do not use `toHaveBeenCalledWith` as the only assertion on a console spy. The case then passes on a message that it does not expect.
- Assert the calls after the last step that can give a message. When a step follows the assertion, assert the number of calls at the end of the case.
- A case that expects no message needs no console spy. To assert that no message came until a step, use `expect(takeReportedMessages()).toEqual([])`.
- A test that mounts `NavigationMenu.Viewport` with no positioner in a root that is not nested calls `allowTopLevelViewportWarning()` of `navigation-menu/utils/test-utils.ts` before the mount.
- A test that counts the transitions of an element reads no style and no layout. A read starts the transition that the part must start, and the test then passes with a broken part.
- Put the cases of such a test that use a real pointer event in a file of their own. `test/fixtures/AnimatedPanel.click.test.tsx` is an example. A real pointer event comes from `userEvent` of `vitest/browser`.
- A real pointer event makes Chromium compute style before the next frame callback. A later case of the same file then passes with a broken part.
- A test that counts each enter and each exit waits for the end event of the next enter, with `after` set to the start event, `transitionrun` or `animationstart`. The end event of an exit can come after the removal of the element. A wait for an end event alone then takes it for the end of the next enter.
- A test that counts transitions gives the handler of the counter to the part as the attribute `onTransitionrun`. A phase that the test sets after the completion can be wrong, because the browser can send `transitionrun` after the completion. For the same reason, the test waits until the count of the last exit is complete before it asserts the counts.
- Start the wait for the end event before the action: `nextEvent(target, endType, { after: startType, action })`. The JSDoc of `nextEvent` gives the reason.
- Give a real click to `nextEvent` or `nextAnimationsRead` as its `action`. The count of frames then starts when the click ends.
- In a new or changed case, do not poll for a state that exists only while an animation runs. Record the state in a `MutationObserver`, read it when `nextAnimationsRead` resolves, or read it after `nextEndingStyle` resolves. Then wait for a state that stays. Then assert on the record.
- A case that waits for the start of an exit and needs no animations of the exit gives the close to `nextEndingStyle` as `action`. Read a state of that start directly after the wait. A `waitFor` on `data-ending-style` also passes on the attribute of an earlier exit, and on an element that the part removed. After a reopen, `Collapsible.Panel` reads the animations of its open one frame after it loses `data-starting-style`. The browser sends the `transitionrun` of the enter in that frame. A close before that frame does not stop them, so `nextAnimationsRead` and `nextEvent` would take them for the exit.
- Do not record such a state in a listener of an animation event or a transition event. After a stall, one frame can start and end the animation. The part then completes, hides the element or removes it in the microtasks before the events of that frame. A `waitFor` can thus end before the events come. Firefox sends `animationstart` to a hidden element after those microtasks. Chromium and Firefox send no `animationstart` to a removed element. The part completes only after the animations of the list of `nextAnimationsRead` end. To record a state at the end, read it in a callback of the `finished` promises of that list. `useAnimationsFinished` runs the completion some microtasks after the end, so that callback runs first.
- In a listener of `animationstart` or `transitionrun`, read the fields of the event or a state that stays. Do not read `getAnimations()`. A late frame can end the animation before the browser sends the event, and the list is then empty.
- In a new or changed case that needs the animations that a part waits for, get them from `nextAnimationsRead`. Call it before the action, or give it the action.
- A case with an exit of 100 s can read `element.getAnimations()` directly after `await nextEvent(element, 'animationstart', { action })`. It can also read a state of the exit there. No late frame ends an animation of 100 s, so the animation still runs at that event. This read does not depend on a read of a part, so the case needs no wait for `openChangeComplete`. Get each `finished` promise in the task of the read. `BUG-5519: an exit animation` of `dialog/popup/DialogPopup.test.tsx` is the model.
- A wait for `transitionrun` or `animationstart` can get an event of an earlier step. In each frame, the browser first runs the microtasks that the update of the animations queues, such as the callbacks of `finished`. Then it sends the animation events of the earlier style changes. A wait that ends in those microtasks thus attaches the next listener before those events. An example is a move of a hover popup to another trigger with `user.hover`. user-event gives the leave event no `relatedTarget`, so the popup closes and opens again: the move starts an exit and reverses it. To wait for the exit of a close after such a step, give the close to `nextAnimationsRead` as `action`. The read of the exit comes only after the close.
- A case that gives a close of a popup to `nextAnimationsRead` after a move to another trigger waits for `openChangeComplete` with `true` between the open and the move. The root of a popup reads the animations of the popup when the popup loses `data-starting-style`, one frame after the open. A move with `user.hover` before that frame removes the attribute and starts an exit. The next frame cancels the exit, and the root reads the animations of the popup one more time. A later `nextAnimationsRead` on the popup would resolve with that read.
- A case that needs an exit transition first waits for the end of the enter transition, with `nextEvent` and `after`. While an element has `data-starting-style`, a close starts no transition when the start style and the end style are equal. The part then finds no animation, and it completes the close. `holds the element of a content that opens again while its exit transition runs` of `navigation-menu/content/NavigationMenuContent.test.tsx` is the model.
- A popup that opens again during its exit keeps the ending status until the next frame. A close before that frame continues the exit. The popup then gets no new `data-ending-style`, and the browser sends no second `animationstart`. In WebKit, a close timer that is due after a stall of the page runs before that frame. A case that closes the popup again after such a reopen waits for one frame first.
- A panel that is open at the mount reads its animations in the frame after the mount. Without a wait for that frame, `nextAnimationsRead` can resolve with the read of the mount. A case that gives a later step to `nextAnimationsRead` thus first waits for one frame after the mount. A close and a change of the animation are such steps. `AccordionPanel.transitions.test.tsx` is the model. For a popup, the next rule applies.
- A popup root reads the animations of one element in a frame after each open, to report the end of the open. [Popup store](#popup-store) names that element. For a select with no popup part, it is the positioner. A case that needs the animations of the exit after an open waits for `openChangeComplete` with `true`. Then it calls `nextAnimationsRead` with the close as `action`. Without that wait, `nextAnimationsRead` can get the read of the open. This occurs when the page renders a frame between the call and the close. `VUE-72: a select with no popup` in `select/root/SelectRoot.test.tsx` is the model. A case that changes the animation of an enter that still runs cannot wait for `openChangeComplete`, because the open is not complete. For a popup that mounts at the open, the read of the open comes in the frame after the mount. Such a case thus waits for one frame after the mount. Then it gives the change to `nextAnimationsRead` as `action`. A wait for the `animationstart` of the enter does not replace that frame, because WebKit sends that event before the read. The case "waits for a restarted enter animation to finish" of `DialogRoot.test.tsx` is the model.
- In a new or changed case, do not use `wait(ms)` for a state from a frame callback of a part. A stall of the page can hold the callback for longer than that time. After the step that makes the part request the frame, call `await waitSingleFrame()`. The browser runs frame callbacks in the order of their requests. Vue applies the writes of one callback before the next callback runs. `menu/popup/MenuPopupEnterTransition.test.tsx`, "clears the inherited instant type when the popup is not initially rendered", is the model.
- In a new or changed case, wait for the end of an exit with `waitFor` on the state that stays, such as `hidden` or the removal of the element.
- In a new or changed case that asserts that a part does not complete a close, wait for the end of the exit, not for a time. A stall can hold the end of a short exit for longer than a `wait(ms)`, and the case can then pass with a broken part. When the element gets `data-ending-style`, get its animations with `getAnimations()`. Get each `finished` promise at that time. Do not use `nextAnimationsRead` here, because the part can stop its wait before it reads the animations. Move the animations with `seekBeforeEnd`. Wait for the promises. Assert after `await flushMicrotasks()`. A part completes a close in the microtasks after the end of the exit. `test/popupConformanceTests.tsx`, "is not called on close when onOpenChange prevents unmounting after an await", is the model.
- Where a case needs the animations of an exit, get each `finished` promise when the read of `nextAnimationsRead` resolves. The browser can cancel a finished animation when its element goes, and `finished` then gives a new promise that never settles.
- In a new or changed case, do not wait for an event of a transition or an animation with a flag and `waitFor`. Use the helpers of `test/animation.ts`, then wait for the state that stays. A helper attaches its listener before the action, so it does not miss the event.
- Wait with `waitFor` for a focus that a part gives in an animation frame: `await waitFor(() => { expect(item).toHaveFocus(); })`. The focus is a state that stays.
- A case that asserts that a popup does not take the focus from a dialog below it sets `modal` of the dialog to `false`. With `modal` set to `true`, the dialog sets `inert` outside it (`BUG-4678`), and `focus()` does nothing on an inert element. The case then passes also when the code under test is broken.
- Give a duration of 100 s to each animation that a new or changed case ends with its own call (a seek or `finish()`). A part reads its animations some frames after the close, and a late frame can end a short animation before that read.
- Before a case calls `finish()` to show that a part waits for the end, it waits for one frame. A part that completes in a frame before the end then fails the case. The case "waits for a restarted enter animation to finish" of `DialogRoot.test.tsx` is the model.
- A case that counts the `transitionend` events of an exit waits for the event with `nextEvent`, called before the action. The part hides the element in the microtask after the end of the transition, and the browser sends `transitionend` after that microtask.
- A new case that asserts the frame in which a part removes an element uses `probeFrameAfterExit`. It also has a control case in which the removal is late, as `AnimatedPanel.test.tsx` has.
- A case for an exit that ends before the part reads its animations uses `probeFrameAfterExitBeforeRead`. It asserts that no part read the animations before the end. The control cases of that probe are in `test/animation.test.ts`.
- `probeFrameAfterExit` cannot show that a part that hides its element waits for an animation that a script made, such as a `motion-v` animation. `hidden` does not cancel such an animation, so the probe does not see a hide that comes too early.
- In Firefox, a dispatched `submit` event that no listener prevents submits the form and loads the test page again. Chromium and WebKit do not. A case that submits a valid form has a listener that calls `preventDefault()`. `observeSubmit` of `Form.test.tsx` is the model.
- A ported case that Base UI writes with `createTouches` keeps the call. The helper is in `packages/vue/test/sliderTestUtils.ts`. For WebKit, the helper uses `document.createTouch` and `document.createTouchList` when both are available. Otherwise it uses `new Touch`.
- A case that needs a cached image first loads the source with `new Image()` and waits for its `load` event. An earlier case of the file can load the same source, but the case must also pass when it runs alone.
- A case that needs the answer of the server for an image waits for the `load` or `error` event with a listener. Attach the listener before the source changes. Do not use `waitFor`: the server answers in its own time, and the page renders frames during that time. The 180 frames of `waitFor` can pass before the answer. After the event, call `await nextTick()` before you assert. `nextTick()` resolves after Vue renders the state that the part set in its listener.
- A case that changes the source of a cached image first waits for the `load` event of that image. Firefox does not cancel the event when the source changes, so the new image gets it.
- Assert the start state before the action when the end state can be true already.
- A `waitFor` on a state that the action makes before the awaited change passes at once. The `mousedown` of a press gives the focus to a `Combobox.Trigger` whose input is in the popup, and an open popup closes one frame later. A wait for the focus of the trigger after that press thus ends while the popup is open. Such a case first waits with `waitFor` for `aria-expanded="false"` on the trigger. Then it asserts the focus directly.
- A popup that closes with the focus in it returns the focus, as [Focus helpers](#focus-helpers) says. An assertion on the focus after the close thus passes also when a part gave the focus to an element of the popup. To assert that an element gets no focus, add a `focus` listener to it before the action. After the close, assert that the listener has no call. `does not focus input when closing via trigger click (input inside popup)` of `combobox/root/ComboboxRoot.test.tsx` is the model of both rules.
- Use the `firePointer` test helper when a test depends on the time of an event.
- `fireTouch` gives no `timeStamp`, so the browser stamps a touch event with its own clock, and a stalled run makes a fast swipe slow. A touch case that depends on the speed of a swipe gives each event a fixed stamp. See `stampEventTimes` in `drawer/viewport/DrawerViewport.test.tsx`.
- A case that clicks, presses a key or hovers in a popup right after the open gives the open to `waitForLaterMillisecond(action)`. Each such event reaches more than one Vue listener. The popup element of `useDismiss` gets a press first, in a capture listener. The popup element gets a key or a hover after the target. See [Test helpers](#test-helpers).
- A lint rule cannot find such a case. To check a case, mock `Date` in a copy of its file. In a `beforeEach`, call `vi.useFakeTimers({ toFake: ['Date'] })` and then `vi.setSystemTime(date)`. Only `render`, `rerender`, `setProps`, `waitForLaterMillisecond` and the fake timer calls of the case then move the clock. An event of the case thus comes in the millisecond in which Vue attached each listener after the last of these calls. The case must pass.
- A pointer call of `user` throws when the element has or inherits `pointer-events: none`. A case that clicks an element through `user` renders the element with no such style.
- `user.click` sends no `mousedown` and no `click` to a native button that has the `disabled` attribute. A `user.click` on a disabled native trigger thus cannot open a popup that opens on a press. A case for such a trigger asserts the `disabled` attribute.
- Put a case that presses a trigger with `holdPress` in a file of its own, such as `menu/trigger/MenuTrigger.press.test.tsx`. The real press focuses the trigger with the mouse, and the document keeps that input modality. A later `focus()` call in the same file then does not match `:focus-visible`, and `useTriggerFocus` opens no popup for it.
- A real touch or pen exists only in Chromium, through `cdp()` of `vitest/browser`: guard the case with `it.skipIf(!platform.engine.blink)`, and give the same behavior a dispatched case that runs in each engine.
- A case of a part in a disabled `<fieldset>` uses `userEvent` of `vitest/browser` for each press, key and Tab. `user` of `render` treats each element in a disabled fieldset as disabled, a `<span>` too, so it skips the element at Tab and drops its click. A real browser disables only a form control.
- The click of a press has `detail` 1 or more, and `element.click()` has 0: a case of a click with no press calls `element.click()`.
- Use `it.each` with object rows and `$name` titles for tests that differ only in data.
- Vitest cuts a `$name` value after 40 characters, so two rows can get one title. When a value can be longer, such as the name of a demo, make each row an array of its title and its data. Write the title as `%s`, which Vitest does not cut. `test/demos.test.tsx` is the model.
- A test of the order in which a template mounts a new part and unmounts the old part uses a `.test.vue` fixture. A render function in TSX reuses the component, so it does not show this order.
- A test that replaces one child of `KeepAlive` with another child of the same component gives each child its own `key`. `KeepAlive` then keeps both children and deactivates the one that the other child replaces.
- A case of a part that mounts in a held branch hides the branch in one flush and mounts the part in a later flush. A part that mounts in the flush of the deactivation gets `onDeactivated`.
- A test of the order of the parts of one kind renders more than one part of that kind in one branch. It hides the branch with `KeepAlive` and shows it again, and it compares the attributes before and after. Put a part before and a part after the part under test in the branch.
- A test belongs in the file of the part whose prop or behavior it asserts.
- For text in a locale format, compute the expected text with the same locale and options as the component.
- To test a server whose `Intl` data give another layout than the browser, give the server render a `-u-hc-`, `-u-ca-`, `-u-fw-` or `-u-rg-` keyword in `locale`. Hydrate with the plain locale. A locale that only one engine lacks, such as `is-IS` in Chromium, tests nothing in the other engines.
- The page `date-layout` of the Nuxt fixture uses `is-IS` with no keyword, because the tests of the fixture read it only in Chromium. A case of the page fails when Node and Chromium give the same hour cycle for `is-IS`. Then give the page a locale for which the two give another hour cycle.
- A case of a date part gives the part `today`, or a value and a time zone, so that the case does not depend on the clock of the machine. A case that must see the read of the clock spies on `Temporal.Now.plainDateISO`, and it does not fake the timers.
- A hydration case of a calendar root that reads its clock calls `mockBrowserToday`. When the page moves in a fixture with a generated id, such as the id of `Calendar.Caption`, the case hydrates by hand, because the new month gets a new id.
- Do not write a generated id in a test. The id holds a count of the earlier `useId` calls, so a new call in a part changes later ids. Read the id from the element or from the HTML.
- A case of Vase UI's own that depends on the Vue version or on the browser probes for the behavior. A condition names no engine. Each outcome has a case with `runIf`, as in `collapsible/panel/CollapsiblePanel.node.test.tsx`.
- One exception is a case that needs a command of the Chrome DevTools Protocol, such as `Input.imeSetComposition` for the input method editor. Only Chromium has that protocol, and no probe can do what the command does. Such a case has `it.runIf(platform.engine.blink)` and a comment that gives the reason. The cases of `a composition` in `number-field/input/NumberFieldInput.test.tsx` are the model.
- A second exception is a case of a part that reads `platform.engine` and renders nothing in one engine. Such a case skips that engine with the flag of `platform.engine` that the part reads, and a comment that gives the reason. The scrub area cursor case of `test/demos.test.tsx` is the model.
- The validation popup cases in `test/setup.test.tsx` select Firefox. The first case must fail if the popup does not take a press.
- A query for the role `button` while a popup is open names the button: `screen.getByRole('button', { name: 'Open' })`. In WebKit on an Apple system, the focus guards are buttons too, as [Focus helpers](#focus-helpers) says.
- A case that finds the focus guards selects `[data-vase-ui-focus-guard]`, not `[aria-hidden]`. In WebKit on an Apple system, a guard has no `aria-hidden`.
- A test of a position waits for the rectangle of the popup with `waitFor`. It does not count microtasks, frames or ticks.
- On macOS, the fonts can give a line box a fractional height, so a place or a size can be fractional. A case rounds an expected place of a positioner to the pixels of the device, as Floating UI rounds the transform. `roundToDevicePixels` of `menu/positioner/MenuPositioner.test.tsx` is the model.
- An expected size is the size that the part reads, such as the computed `height`. `offsetWidth` and `offsetHeight` round to whole pixels.
- To count position passes, mock `@floating-ui/vue` with `vi.mock` and `vi.importActual`, and count the calls of the `fn` of the `offset` middleware. To count the listeners and the observers of a popup, count the calls of `autoUpdate` and of its cleanup.
- A test that asserts "no position pass" turns anchor tracking off. With tracking, the observers of `autoUpdate` start two more passes in the first frames after the open.
- A case that asserts that `autoUpdate` follows a move with no change of size waits three frames after `autoUpdate` starts. Then it moves the element. The `ResizeObserver` of `autoUpdate` notifies in the first frame. Floating UI then observes the floating element again in a frame callback. That observation notifies in the second frame, after the frame callback of the case in that frame. Each notification measures the reference, so a move before the second notification passes also when the `IntersectionObserver` does not work. `utils/popups/InternalBackdrop.test.tsx` is the model.
- Give the pass counter an implementation that throws after a number of calls that no test reaches. A pass that starts a render that starts a pass never ends, and the test run then does not end.
- A popup that is open at hydration gets its position after the two ticks of `hydrate`. Hydrate it by hand and wait for the position, as in [Test helpers](#test-helpers).
- A test of a popup that stays mounted also changes each option that restarts work, such as `disableAnchorTracking`, while the popup is closed. It asserts that `autoUpdate` has no new call.
- A test of a position pass that ends after the popup closed asserts that the closed popup has `opacity: 0` and no transform. After the next open and one `nextTick()`, it asserts the same, and then it waits for the place of that open.

### Exception rows

`pnpm parity:check` compares each family with its extract. Each upstream thing in this table needs its counterpart or an exception row:

| Upstream thing | Counterpart in Vase UI |
| --- | --- |
| A source file or a type test | The files at its mapped paths. See [Layout and names](#layout-and-names). |
| A test case | A case at a mapped path with the titles from [How to port a test](#how-to-port-a-test). |
| A call of a shared suite, such as `describeConformance(…)` | The same call under the mapped `describe` titles. |
| An entry of a `types.md`, and each row of its props table | The export of the family, and the prop, emit, slot or exposed member that [API convention](#api-convention) gives. |

The rows of a family are in the `exceptions` list of its family file. A row names one upstream thing. The family files write the fields in this order:

| Field | Content | The row has it when |
| --- | --- | --- |
| `upstream` | One upstream path that the extract holds. | Always. |
| `describe` | The titles of the `describe` blocks, from the outermost. It is `[]` for a case at the top level. | It names a block, a case or a suite call. |
| `title` | The title of the case. | It names a case. |
| `suite` | The name of the function of the suite call. | It names a suite call. |
| `entry` | The title of an entry of the `types.md`, such as `Root`. | It names an entry or a prop row. |
| `prop` | The name of a row of the props table of that entry. | It names a prop row. |
| `kind` | One of the four kinds. | Always. |
| `test`, `engine`, `link`, `waitsOn` | See the table of the kinds. | The kind needs it. |
| `reason` | The reason. | Always. |

| Kind | Meaning | The row gives |
| --- | --- | --- |
| `replaced` | Another Vase UI test covers the thing. | `test`: the path of that test. |
| `not-applicable` | The thing is for something that only React has. The kind also covers an upstream file that no Base UI component imports. | Only the reason. Examples are StrictMode, React 17 or 18 and the React Compiler. More examples are the lazy wrapper of the React Flight client, jsdom internals and a file with no import. |
| `engine` | The case does not run in one engine because of the browser. | `engine`: `chromium`, `firefox` or `webkit`. `link`: an `https://` link to a browser bug or an upstream issue. |
| `waits-on` | The thing waits for an upstream file or folder that has no counterpart on `main`. | `waitsOn`: that upstream path. `pnpm parity:check` refuses a path with `/` at its end. A row that names a source file has no `waitsOn`, because it waits for the file itself. |

- A row that names a source file also covers the cases in that file.
- A ported case can have a condition that the Base UI case does not have only with an `engine` row. A defect of the port never goes there.
- The conditions of a case come from the `skipIf`, `runIf`, `skip` and `todo` of the case and of each `describe` block around it. A `skipIf` gives one condition for each operand of a `||` at the top level of its argument. Each operand skips the case by itself. For example, `skipIf(isJSDOM || isWebKit)` gives `skipIf(isJSDOM)` and `skipIf(isWebKit)`. A `runIf`, a `skip` and a `todo` each give one condition.
- `pnpm parity:check` compares the conditions of a ported case with those of the Base UI case, as text. A ported case can omit a condition of the Base UI case. It keeps the text of each condition that it does not omit.
- Where ESLint asks for another form of a condition of Base UI, disable that rule for the line. The case "does not set the orientation via appearance for WebKit browsers" of `slider/root/SliderRoot.test.tsx` is the example.
- An `engine` row covers each ported case that it names and that has a condition that the Base UI case does not have. A row that names a `describe` block or a test file covers each such case and suite call in it.
- The check does not read the engine from a condition. The engine, the link and the reason of a row must be true for each case that the row covers.
- A `types.md` can repeat an entry of another family. Give that entry a `not-applicable` row. The reason names the family that ports the entry. An example is the `types.md` of Radio Group, which repeats the entries of Radio.
- A `waits-on` row is valid only while its target is absent. The pull request that adds the target also adds the tests and removes the rows.
- A row for a test file that imports the entry point of its family can name that entry point in `waitsOn`. A pull request that ports some cases of the file keeps the row. The row goes when each case of the file has a counterpart.
- A component of Vase UI's own has no exception row, because Base UI has nothing for it to match.

### Rows of `parity/better`

Each behavior where Vase UI does more than Base UI has a file `parity/better/<ID>.json`:

| Key | Content |
| --- | --- |
| `id` | `BUG-<number>` for the correction of a Base UI issue, with the number of the issue. `VUE-<number>` for a behavior that is specific to the Vue port. `VUE-<number>` is also the id of a correction of Base UI that has no issue. The evidence is then a line of source at a commit. The file name is the id plus `.json`. |
| `evidence` | One or more `https://` links. Each link is an issue, a pull request, a standard, a Vue documentation page, or a line of source at a tag or a commit. |
| `behavior` | What Vase UI does. |
| `dueWith` | One upstream path. `pnpm parity:check` refuses a path with `/` at its end. The row is due when the path has a counterpart. |

- A due row needs a test. The title of that test or of its `describe` block must hold the id as a whole word: `VUE-1: the controlled Boolean prop`.
- An upstream case can assert the behavior that a row corrects. Give that case a `replaced` exception row. Its `test` is the file of the case that tests the corrected behavior, and its reason names the id of the row.
- In a case of `describe.each` or `it.each`, one entry of the table can assert the behavior that a row corrects while the other entries do not. A `replaced` row would remove the case for each entry. Keep the ported case and its title. Give that entry a fixture in which the corrected behavior does not apply. Give the reason in a comment. A case with the id of the row tests the corrected behavior.

## Documentation site

The site is the VitePress project in `docs`, the workspace package `@vase-ui/docs`. A push to `main` publishes it to <https://vase-ui.com/>.

- GitHub Pages serves the site at the root of the domain `vase-ui.com`, so `base` in `docs/.vitepress/config.ts` must be `/`. The Pages settings of the repository hold the domain. Do not add a `CNAME` file, because GitHub Pages ignores that file when a workflow publishes the site.
- A page is a Markdown file in `docs`. `scripts/docs/navigation.ts` makes the navigation from these files. Do not add a page to `docs/.vitepress/config.ts`.
- A code sample is a Vue file. A page shows its source with `<<<`. `pnpm docs:typecheck` checks the file against the built package. It also compiles the file with the SFC compiler, as the build of a consumer does. vue-tsc accepts some props types that the SFC compiler cannot read.
- When a props interface extends a package type that the SFC compiler cannot read, write `/* @vue-ignore */` before that type. The props of that type then stay in `$attrs`. `docs/utils/use-forward-props/CollapsibleRoot.vue` is an example.
- A sample wrapper forwards its props with `useForwardProps`, or gives each optional Boolean prop the default `undefined`. Vue otherwise changes an absent Boolean prop to `false`.
- Compose two parts in a sample or a demo as the Base UI code does. Where Base UI gives `render` an element with no props, give its tag or its component to `as`. Where that element has props of its own, use the `#render` slot and bind `props`.
- A page that is not a component page has its samples in `docs/examples/<page>`. `docs/quick-start.md` imports each sample and renders it.
- The folder `docs/handbook` holds the handbook pages. Their `order` follows the Base UI handbook: Styling 1, Animation 2, Composition 3, Customization 4, Forms 5, TypeScript 6. Dates and times has no Base UI page, and its `order` is 7.
- A handbook page shows the source of a sample and does not render it.
- A handbook page renders each demo inside `<DemoFrame>`. A demo that is a port of a Base UI handbook demo is in the family `handbook-<page>`, at `docs/demos/handbook-<page>/<demo>/<variant>/index.vue`. A demo that Vase UI writes, for a block where Base UI shows only code, is `docs/examples/<page>/demos/<demo>/index.vue`. The manual unmount demo of the Animation page is an example. A style block of such a demo sets no fixed color, such as `white`. It uses `currentColor` and the system colors, such as `canvas`, which follow the theme of the site.
- Each handbook page has a family, `handbook-<page>`. Its `upstreamPaths` name `docs/src/app/(docs)/react/handbook/<page>/**`. The rules of [Component pages](#component-pages) apply to its record, its style sheets and a demo that waits.
- A handbook family whose Base UI folder has no `demos` folder has no folder in `docs/demos`, and thus no record. Do not run `pnpm docs:demos` for such a family, because the command writes a record with no files.
- `pnpm parity:check` does not read the text of a page. Before you move `matchedCommit` of a handbook family, compare the page with the Base UI page at that commit. Make each change of the Base UI page in the same pull request.
- Base UI has some handbook demos only as a Tailwind variant, such as the demos of Forms. The Vue demo is then `docs/demos/handbook-<page>/<demo>/tailwind/index.vue`. The page gives it to the slot `#tailwind` of the frame, and the frame shows no select. Show its source in a `code-group` directly below the frame, with no `<DemoSource>`. `<DemoSource variant="tailwind">` hides its content while the reader has not selected Tailwind.
- Base UI gives those demos their classes through the wrapper modules in `demos/components`. Port each module to `docs/demos/handbook-<page>/components/<module>.ts`, with its export names. A wrapper is the Vase UI part with the class string of the Base UI wrapper. Where the Base UI function adds no class, export the part itself. A wrapper with parts of its own, as the toast provider has, is a component with a render function. A slot of the part that such a wrapper does not fill gets the slot of the caller with the same name. The toast provider gives each attribute of the caller to its viewport, so the `aria-label` of the caller is the name of the viewport.
- Make a wrapper with `withProps` of `components/withProps.ts`.
- A vnode from `h()` is outside a block of Vue. The part and each component in its slots thus render again each time the wrapper renders. The comment of `withProps` gives the measured cost. Do not use `openBlock` and `createBlock` to avoid it, because a wrong patch flag drops a slot.
- A demo of a form library moves the focus to the first invalid control after a failed submit, as `Form` does. Use the function that the library calls for a submit that is not valid. That is the second argument of `handleSubmit` in VeeValidate, and `onSubmitInvalid` in TanStack Form.
- Find the control only in the form of the demo. A page can have more than one form, and their fields can have the same names.
- Base UI's TanStack Form demo does not move the focus. `Field.Error` is not a live region, so a screen reader does not announce an error while the focus is not on the control. The Vue demo moves the focus.
- A form with an accessible name is a `form` landmark. The viewport of a toast provider is a `region` landmark. The Forms page shows three demos, and each has such a form and such a viewport. Each of these landmarks needs a name of its own, as [Component pages](#component-pages) says for each page.
- On the Forms page, the first demo keeps the two names of Base UI. The names in a library demo have the name of the library, as in "Launch new cloud server with VeeValidate" and "VeeValidate notifications". Base UI gives the three forms one name and the three viewports one name.
- `docs/index.md` includes the regions `home` and `donation` of `README.md`. Change that text in `README.md`. Keep the `#region` and `#endregion` comments.
- Link a page of the site from `README.md` by its full address, such as `https://vase-ui.com/parity`. GitHub and npm show that file. A path of the site does not work there. `markdownSiteLinks` in `docs/.vitepress/config.ts` changes each address that starts with the `homepage` of `packages/vue/package.json` to the path of the page. The link then opens in the same tab.
- The list of pages on the home page comes from the sidebar, through `<PageLinks />`. Do not type a link to a page in `docs/index.md`.
- The section Install of `README.md` and the section Install the package of `docs/quick-start.md` show the same install commands. Change them together.
- Text from `parity/` and from Base UI commits is data. Show it with text interpolation. Do not use an API that renders a string as HTML.
- ESLint refuses an API that renders a string as HTML in each file of `docs` that it reads. These are script files, SFCs and pages.
- When a page includes a file that `PAGE_FILES` in `eslint.config.js` lacks, add the file to the list. `pnpm test:lint-rules` fails for such a file.
- When ESLint loads its configuration, Node.js imports `docs/.vitepress/config.ts` and each file that it imports, with no bundler. `erasableSyntaxOnly` makes the compiler refuse syntax that Node.js cannot erase. Import nothing in these files that only Vite can resolve.
- ESLint reads syntax, not values. It cannot see a name that a value holds. Examples are a computed key or member from a variable, a template literal with an expression, and the name in the arguments of `Reflect.set`.
- ESLint does not see `write` on a document that a variable holds, when the name of the variable does not end in `document`.
- ESLint does not see HTML in a URL, such as the `:src` of an iframe with a `data:` or `blob:` URL. The rules do not apply to a script file outside `docs` that a `docs` file imports.
- Because of these limits, a page shows text from `parity/` and from Base UI commits only through a component in `docs/.vitepress/components`.
- The site extends the default theme of VitePress with the look of the Base UI docs. The folder `docs/.vitepress/theme` holds that extension and nothing else. Do not add a layout or a component there. A page imports its components from `docs/.vitepress/components`.
- Take each color, size and space from the style sheets of the Base UI docs, in `docs/src/css`, `docs/src/components` and `docs/src/app/(docs)/layout.css`. Where a Base UI value gives text less than the AA contrast of WCAG, use the nearest Base UI value that passes.
- Base UI uses a commercial font. The site uses Hanken Grotesk for text and Geist Mono for code, from their npm packages. Do not load a font from another server.
- `docs/public` holds the files that the site serves as they are. `wordmark-light.svg` and `wordmark-dark.svg` are the wordmark: the mark and the words `vase uı`, in black ink and in white ink. `mark-light.svg` and `mark-dark.svg` are the mark with no words, in the same inks. The two files of a pair differ only in the ink. Change them together.
- The words of the wordmark are lower case, and the last letter is the dotless i (U+0131). They are outlines of Inter Bold with a letter-spacing of -0.02 em. The `u` is the alternate of the feature `cv06`, which has no stem on the right. An SVG file in an `<img>` cannot load an external font. Do not write the words as text. The `<title>` of each file and the `alt` text in `README.md` stay `Vase UI`, the name of the product.
- The mark has two mirrored leaves. These are the first two paths of the wordmark. A mark file holds these two paths and no other path. In the wordmark, the mark is 140 units high, as high as the `viewBox`. A gap of 60 units separates it from the words. The x-height of the words is centered on the mark. The baseline is at y = 140.94, and the x-height line is at y = 59.06. When you change the mark, change each SVG and render the PNG and ICO icons again.
- `favicon.svg` shows the white mark on a black square. Render `favicon.ico` with images of 16 by 16, 32 by 32 and 48 by 48 pixels. Render `favicon.png` at 32 by 32 pixels. Render `apple-touch-icon.png` at 180 by 180 pixels. The `head` entries in `docs/.vitepress/config.ts` declare the ICO, PNG, SVG and Apple icons. If two icons are equally appropriate, a browser uses the last one. Put the SVG link after each ICO and PNG link.
- The navigation bar shows the mark, with no words, as the link to the home page, through `themeConfig.logo` in `docs/.vitepress/config.ts`. `siteTitle: false` removes the title text. The link has no text, so the `alt` text is its only name. Do not remove the `alt` text.
- The heading of `README.md` shows the wordmark. Name its two files by an absolute address on `raw.githubusercontent.com` at `main`. npm shows a copy of `README.md` from the package, and the package has no `docs/public` folder. Do not move or rename the two files, because the `README.md` of each published version names them at `main`.
- `og-image.png` in `docs/public` is the link preview image, at 1200 by 630 pixels and below 1 MB. The `head` entries in `docs/.vitepress/config.ts` declare the site-wide Open Graph and X card meta tags. Give `og:image` and `twitter:image` the full address on `vase-ui.com`, because link crawlers refuse a path. Put `og:image` before its `og:image:*` tags. `og:image:alt` is one sentence that says what the image shows. Change it when you change the image. `transformPageData` adds `og:url`, `og:title` and `og:description` to each page, with the clean address of the page. A page with no description, such as `docs/index.md`, gets the description of `packages/vue/package.json`. Do not add `twitter:title` or `twitter:description`, because X reads `og:title` and `og:description`.
- A heading of level 2 to 6 can end with white space and `[New]` or `[Preview]`, as on a Base UI page. `docs/.vitepress/markdownHeadingBadge.ts` shows that word as a badge.
- VitePress makes the index from the Markdown of each page, before Vue renders the components of the page. Text that a component renders is not in the index, unless `searchIndexHtml` adds it.
- To keep a page out of the index, write `search: false` in its front matter.
- `postcssIsolateStyles` in `docs/.vitepress/config.ts` also covers each style sheet in `docs/.vitepress/theme`, so a rule there does not reach a demo. For the same reason, a rule there cannot style the frame of a demo. Put that rule in `DemoFrame.vue`.
- In Chromium and WebKit, the selection highlight of `look.css` (`.Layout ::selection`) reaches the demos, although `postcssIsolateStyles` keeps the other rules of that file out. These engines give a highlight the style of the highlight of its parent. Firefox does not. Where the gray highlight hides the text of a demo, remove it in `DemoFrame.vue`, as the rule for a focused segment does.
- `docs/demos/tailwind.css` is not in the theme folder, because `postcssIsolateStyles` would add a selector to each utility there.
- The theme of the site is the class `dark` of the root element.
- `docs/.vitepress/postcssFollowSiteTheme.ts` changes each `@media (prefers-color-scheme: dark)` rule of a style sheet into a rule for that class.
- A style that the site writes uses the class `dark`, as `DemoFrame.vue` does.
- A copied style sheet can give text less than the AA contrast of WCAG, in one state of a part or in each state. Do not edit the sheet. For a popup, add a rule to `look.css` with the nearest value of the sheets that passes. A popup is in an element with `data-vase-ui-portal`, outside the frame of a demo, so the rule reaches it. For text in the frame, add the rule to `DemoFrame.vue` with `:deep()`. Vite adds a prefix and a suffix to each class of a CSS module, so the selector names only the middle part, as `[class*='_LinkDescription_']` does. Name the part and its state, not the demo. For the Tailwind variant, name the utility that gives the color, as `[class~='data-placeholder:text-neutral-500']` does. Where no value of the sheets passes, use the next step of the same color of the Tailwind palette. Give each selector of a rule a row in `packages/vue/test/demos.contrast.test.tsx`. A row measures the text in one state, in both themes and in each variant of the demo. Where a rule applies in each state, add a row for each state that changes the background behind the text.
- A class string or a copied style sheet of a Base UI demo can make a list cut the text of an option. Do not change the class string or the sheet. Add a rule to the part "Popups of demos" of `look.css` that lets the text wrap. Name the role and the utility or the middle part of the module class, not the demo, as `[role='option'] [class~='whitespace-nowrap']` does. The popup case of `packages/vue/test/demos.popups.test.tsx` is the test of the rule. Do not add a row to `packages/vue/test/demos.contrast.test.tsx`.
- A plugin of the site is a file in `docs/.vitepress`, and its test is beside it, as `<name>.test.ts`.
- A component of the site that shows a table puts the table in `<ScrollBox>` of `docs/.vitepress/components`. Give the box a `label` that names the table, such as `Props of Dialog.Root`. The box scrolls the table when the column is narrower than the table.
- A keyboard user scrolls a box with the arrow keys, so the box or an element in it must be able to get the focus (WCAG 2.1.1). A table of the API reference has no such element. The box thus takes the focus while it scrolls, with the role `group` and its `label` as its name. A box that does not scroll is not in the sequence of the Tab key.
- The role is `group`, not `region`. A `region` with a name is a landmark, and a table is not a part of the page that a reader goes to from the list of landmarks.
- A Markdown table is not in a box. VitePress makes it scroll itself and gives it `tabindex="0"`, so a keyboard user can scroll it.
- A heading that a component of the site writes follows the outline of its page (WCAG 1.3.1). The first level of its headings is one more than the level of the page heading above the component.
- The text of a page follows [Voice](#voice).

### Component pages

A component page is `docs/components/<family>.md`. Use `docs/components/button.md` as the model.

A family that Base UI documents in `docs/src/app/(docs)/react/utils/`, such as `merge-props`, has a utility page: `docs/utils/<family>.md`. A utility page follows the rules of this section and counts as a component page in this file. Its folder is the sidebar group Utils.

- The page has the title and one intro line. It has the sections of the Base UI page, with the code in Vue. It also has each demo of the family and the API reference.
- The front matter has `order: 1`. The group then shows its pages in the sequence of their titles.
- A demo has one Vue file for each variant that Base UI has: `docs/demos/<family>/<demo>/css-modules/index.vue` and `docs/demos/<family>/<demo>/tailwind/index.vue`. Each file keeps the elements and the attributes of the Base UI file `demos/<upstream-demo>/<variant>/index.tsx`. A heading of a demo follows the outline of its page. The hero demo of Accordion is directly below the title, so its `Accordion.Header` has `as="h2"`. Base UI's demo has the default `h3`.
- A demo can have two attributes that the Base UI file lacks, because axe reports their absence in the open state. A popup that has the role `dialog` and no title part has `aria-label`. A scroll container that holds no control has `tabindex="0"`, because WebKit gives a scroll container no keyboard focus. Both variants of a demo get the attribute.
- In a Tailwind demo, write `class` in the place of `className`. A constant that holds class names keeps its name and its text in `<script setup>`, and the template binds it with `:class="name"`. Write an array in `:class` in the place of `clsx` or a template literal. Keep each part of a string that Base UI makes with `+`. Do not write the object form of `:class`.
- The name of a constant that holds class names ends with `Class`, `ClassName` or `Classes`.
- A Tailwind demo has no import of a style sheet and no `<style>` block.
- The two Vue files of a demo are equal apart from their classes and the import of the style sheet. The two Base UI files of a demo can differ in more than their classes and their text. Each Vue file then follows the elements and the props of its own Base UI file. The text and the links of an element in both Vue files are those of the CSS-module demo.
- A demo that Base UI has in one variant has one Vue file, and its page has no select.
- A correction that the site makes to a CSS-module demo also reaches the Tailwind demo, as a rule of the site. The class strings stay equal.
- A Base UI demo can use an API that only React has, such as a form action. The Vue demo then gives the same result with the API of Vue. The page says what the demo shows.
- A demo of a date or time component sets `locale="en-US"`, so that the server and the browser show the same text.
- A demo gives a calendar no `today`, so that the calendar marks the day of the reader. The test of the demos fails for a demo that gives `today`.
- A demo sets `timeZone` only to show that prop. Without it, today is the day in the zone of a zoned value, or else in the time zone of the reader.
- For a value of a demo that follows today, such as `minDate`, make an empty `shallowRef`. Set it to `Temporal.Now.plainDateISO()` in `onMounted`. A reader can open the site on another day than its build, and the server HTML must equal the first client render.
- Each other date of a demo is a fixed date.
- Do not write `Temporal` in the template of a demo. A template reads only the globals that Vue lists, and `Temporal` is not one of them. Make each value in the script.
- The text and the links of a demo are about Vase UI. A demo does not name Base UI or React. A link to the documentation or to the source of Vase UI goes to a page of this site or to `https://github.com/vase-ui/vase-ui`. When Base UI links a page that this site does not have, link the nearest page that exists, or remove that link.
- A page shows its demos together, and a screen reader lists the landmarks of a page by role and name. Give each landmark of one role on a page a name of its own. The viewport of a toast is a `region` landmark, and its default name is "Notifications". The outer root of a navigation menu is a `navigation` landmark with no name. A root inside another root is a `div`, not a landmark. Give each of these two parts its name with `aria-label`.
- The name says what the demo shows, in the fewest words, as "Undo notifications" and "Nested submenus" do. The first demo of the Toast page keeps the default name. Base UI gives these parts no `aria-label` in its demos. A demo that names such a part thus has one attribute more than its Base UI file.
- VitePress does not add the base path of the site to a link in a demo. Start the path of a link to a page of this site with `import.meta.env.BASE_URL`. Do not use `withBase` of VitePress, because the test of the demos mounts a demo with no VitePress.
- `docs/tsconfig.json` sets `dataAttributes` to `data-*`. With `strictTemplates`, vue-tsc then accepts a `data-*` attribute on a part, such as `data-color` in the hero demo of Alert Dialog.
- A Base UI demo can import a file of `demos/<demo>` that is outside `css-modules`, such as `custom-sanitize/useInvalidFeedback.ts` of OTP Field. Port that file to the mapped path in `docs/demos/<family>`.
- A Base UI demo can import a library from npm, such as `match-sorter` or `@tanstack/react-virtual`. The Vue demo imports the same library, or its Vue counterpart, such as `@tanstack/vue-virtual`. Add it to the `devDependencies` of `docs/package.json` with an exact version: `pnpm --filter @vase-ui/docs add -D <name>@<version>`. Then commit `pnpm-lock.yaml`. The demo test of the package resolves the library from `docs/node_modules`.
- Where the library has no Vue release, the page documents a Vue library in its place. The Forms page documents VeeValidate in the place of React Hook Form.
- The Vue library of a demo can need an element that the Base UI demo does not have. `VUE_DEMO_EXTRA_CLASSES` in `scripts/docs/upstreamDemos.ts` then names the element and each class string that the Vue folder has more than its row, with the reason.
- The server render of a demo loads a library from npm as an external module, and the library takes the Vue of `docs`. The jobs `test-vue-floor` and `test-vue-rc` install another Vue in `packages/vue`. The server render then has two copies of Vue, and the test does not see a warning of the library. Add each library whose components or composables run in the server render to `server.deps.inline` of `packages/vue/vitest.config.ts`.
- The style sheet of a demo is the Base UI file, byte for byte. Do not edit it. Prettier does not format it, because `.prettierignore` names `docs/demos/**/*.module.css`. The same CSS then proves that the data attributes and the CSS variables are those of Base UI. A demo has no `<style>` block, and ESLint refuses one.
- `docs/demos/<family>/upstream.json` records the Base UI commit and the SHA-256 of the Base UI demo files at that commit. It has no row for `<demo>/index.ts`. `pnpm docs:demos --upstream <path> <family>` writes the record and the style sheets. Do not edit the record.
- Run that command after each change of `matchedCommit`. Commit the result in the same pull request. A changed hash of an `index.tsx` shows that Base UI changed that demo.
- The JSDoc of `DemoRecord` in `scripts/docs/upstreamDemos.ts` gives the keys of the record. The JSDoc of `scripts/docs/demoClasses.ts` gives the rules of the class reader.
- When a class name has no rule, add its color to the theme in `docs/demos/tailwind.css` if the theme of the Base UI docs has that color. Otherwise add the name to `CLASS_NAMES_WITHOUT_RULE` with its reason in a comment.
- A demo with no Vue file waits while one of its entry points does not exist in Vase UI. The page then has no such demo. When the last entry point exists, `pnpm test:docs` fails until the demo has its Vue file. The pull request that adds that entry point ports the demo.
- A component of Vase UI's own has no `upstream.json`. Its demos have elements and style sheets of their own. `pnpm test:docs` fails for a page that has neither a family file nor a record in `parity/own`.
- A demo of a component of Vase UI's own has the two variants. The two variants differ only in their classes and in the import of the style sheet. The page gives the Tailwind demo to the frame as it does for a demo that Base UI has in two variants.
- No record holds the class strings of such a demo. Write them as the Tailwind demos of Base UI do. Write a data attribute that has no value as `data-disabled:`, not as `data-[disabled]:`. Give each color class its `dark:` pair. Use only the colors of the theme in `docs/demos/tailwind.css`. Give each transition its curve as an arbitrary value, such as `ease-[ease]`. Without such a class, a transition class of Tailwind has the curve `cubic-bezier(0.4, 0, 0.2, 1)`. A transition of a style sheet that names no curve has `ease`.
- `pnpm test:docs` fails when a demo of such a component has only one variant. It also fails when the two variants differ in more than their classes. It reads these demos for the checks of the class names and of the frames, as it reads the demos of a family. When a class name of such a demo has no rule, change the name in the demo. A name of such a demo goes into `CLASS_NAMES_WITHOUT_RULE` only when it is a marker, such as `group`.
- `packages/vue/test/demos.ownVariants.test.tsx` finds each demo of such a component by itself. It compares `text-decoration-line` and the duration and curve of each property of `transition-property`, as the engine applies them.
- A demo that cannot be disabled is in `DEMOS_WITHOUT_DISABLED_STATE` in the test, with its reason in a comment.
- A state that only a pointer or a layout gives needs a row in `ATTRIBUTE_STATES` in the test.
- A demo that hides a part at rest needs a step in `SHOW_EACH_PART` in the test. The step shows the part.
- The test skips the duration and curve of a transition whose `transition-property` is `none`.
- A date or time segment sets `field-sizing: content` in its own style, so a demo needs no such rule. An `<input>` cuts text that is wider than its box. The width that the `size` attribute gives is too narrow for `AM`, `PM` and `mm` in some engines and fonts.
- Two buttons with a gap between them each keep their whole border. For a demo with a `TimeClock.DayPeriod` part, the test has a case that fails when a day period button has a side with no border.
- Do not give a width to the grid of a range calendar or to its calendar. The day buttons then give the grid its width, so the days of a range touch and the grid fills its month. For a demo with a `RangeCalendar.DayButton` part, the test has a case that fails when two middle days of a row do not touch. It has a second case that fails when a grid is not as wide as its month.
- Give a range day button `position: relative` and a positive `z-index` on `:focus-visible`. Adjacent day backgrounds then cannot cover its outline. Keep the positive outline offset, because the range endpoints have the same color as the outline. The focus case uses an arrow key, checks the position, and compares the `z-index` with adjacent days.
- The test finds the demos of these cases by the name of the part in the source of the CSS-module demo. The day period, range gap and focus cases run in each variant and theme at widths of 390 and 1280 pixels.
- The segment case of the test fails when the text of a segment is wider than its box. It measures each demo as mounted, with one-digit and two-digit hours, with each day period, and empty. It has a row for the font of the site, a row for the fallback font and a row for the letter spacing of WCAG 1.4.12. It loads the font of the site from `docs/node_modules`.
- On the page, a demo is inside `<DemoFrame>`. The frame has the class `vp-raw`, so the styles of the site do not reach the demo. Show the Vue file and the style sheet directly below it in one `code-group`. The frame and the code group then make one card.
- A demo that Base UI has in two variants gives its Tailwind component to the slot `#tailwind` of the frame. The import name is the name of the CSS-module import and `Tailwind`, as `DemoButtonHeroTailwind`. The page shows the source of each variant in its own `<DemoSource variant="css-modules">` or `<DemoSource variant="tailwind">`, with one `code-group` in it. `<DemoSource>` shows only the source of the chosen variant. `docs/components/button.md` is the model.
- The frame shows a select with the label "Styling method" only when it has both variants. The choice is for the whole site, and it stays in `localStorage`. The default is CSS Modules.
- A demo declares its props itself, in a type literal: `defineProps<{ as?: string | Component | undefined }>()`. It does not extend a type of `@vase-ui/vue`. The SFC compiler then reads the props from the demo file, and not from a type of the built package.
- A code sample that is not a demo is `docs/components/<family>/<Name>.vue`, or `docs/utils/<family>/<Name>.vue` on a utility page. The page shows its source and does not render it. `pnpm docs:typecheck` checks it.
- The docs package has no router. A sample that imports one, such as `RouterLink` of `vue-router` or `NuxtLink` of Nuxt, is a component of the Nuxt fixture in `fixtures/nuxt/app/components`. The page shows it with `<<< ../../fixtures/nuxt/app/components/<Name>.vue`. The type check of the Nuxt fixture checks it. `pnpm docs:typecheck` compiles it. The link samples of the Navigation Menu page are the examples.
- A page can show a part of a sample. Mark the part with `// #region <name>` and `// #endregion <name>` in the script of the sample. Show it with `<<< ./<family>/<Name>.vue#<name>{ts}`. The `ts` gives it the colors of TypeScript.
- Write `<ApiReference />` under the heading `## API reference`. The site build makes the reference from the types and the JSDoc of the source. The reference lists the parts in the sequence of the Base UI page, which the extract records. Do not write a table by hand. To change a text of the reference, change the JSDoc.
- The development server, `pnpm docs:dev`, makes the reference of a page each time it renders the page. After an edit of a file in `packages/vue/src`, an open family page shows the new reference with no reload. Each other family page shows it at the next visit. An edit of a test file starts no render. A test file has `.test.` or `.spec.` in its name. The file watcher can miss a save of a file that comes while the server renders a page after the last save of the same file. The page then keeps the reference of that last save. Save the file again. The search of the development server keeps the reference text of its last index of a page. To index a page again, save the page file or start the server again. After a change of a file in `parity` or of an installed package, start the server again. The site build keeps one reference for each family.
- A Base UI page can end the heading of a part of its API reference with `[New]` or `[Preview]`, as in `### FilterProvider [Preview]`. The extract records the word, and the reference shows it as a badge on the heading of the part. Do not write the word on the page.
- A Base UI page can also end another heading of its API reference with `[New]` or `[Preview]`, such as the heading of a function. The extract records the word. The page of the site writes that heading, so the reference cannot show the badge. The site build and `pnpm test:docs` then fail, and the message says what to do.
- The description of an event is its JSDoc in `defineEmits`. Write a JSDoc for each event, `update:x` included.
- `<ApiReference name="<name>" />` shows one function, class or type of the family, with no heading for its name and no description. The name is the path of the export, such as `mergeProps`, `Tooltip.Handle`, `useRender.Parameters` or `ToastManagerAddOptions`. A type is an entry of the section API Reference or Additional Types of the `types.md`. The page writes the heading and the text. The build fails when the reference has no function, class or type with that name. For a function or a class, the component writes headings, such as Parameters and Return value. Give it `:heading-level` one more than the level of the heading above it: `<ApiReference name="Dialog.createHandle" :heading-level="3" />` below `## createHandle`. The build fails when such a reference has no `heading-level`. Base UI writes these headings at level 3 in each place.
- When the Base UI page has the section Additional types, write `## Additional types` at the end of the page. Under it, write a `### <name>` heading and `<ApiReference name="<name>" />` for each type that `showAdditionalTypes` of the Base UI page names.
- A type text writes the members of each union in the sequence of its declaration, and `null` and `undefined` last, as TypeScript does. A union in a function type, an array, a tuple, an intersection or a type argument keeps the text of TypeScript.
- The column Default shows the text of the `@default` tag in the JSDoc of the prop or the property. For a prop, the reference reads the tag from the exported props interface of the part, such as `TooltipTriggerProps`. It does not show the default of Vue. To show a default, write a `@default` tag.
- The reference reads the tags of a property only from its own declaration. A property that an interface declares again does not get the `@default` tag of the base interface. Write the tag again when the default stays the same.
- Each demo is a test fixture. `packages/vue/test/demos.test.tsx` mounts each demo of both variants, checks it with axe and hydrates its server render, in each engine. The file also mounts the demos of each page in a table together: Toast, Navigation Menu and Forms. Add a page whose demos have a landmark to that table. A new demo needs no new test.
- The hydration case gives the browser a day two months after the day of the server render, so a demo that reads the clock in `setup` fails. It passes `renumberIds` when the server HTML has `data-vase-ui-today`, because a calendar page that moves to the month of the browser gets new generated ids. A case that mounts a demo with a calendar calls `mockToday` first, so the demo has the same day in each run.
- The mount case of `demos.test.tsx` mounts each demo closed, so axe and the warning check do not see the content of a popup. `packages/vue/test/demos.popups.test.tsx` has the popup case for this: one case for each demo and variant whose folder names a `Portal` part.
- The popup case mounts the demo in `<DemoFrame>`. It loads the base layer of VitePress, `tokens.css`, `look.css` and `docs/demos/tailwind.css`, so a popup has the styles that the site gives it. The test page has no `postcssIsolateStyles`, so the frame gets the base layer too.
- The popup case finds a trigger by `aria-haspopup`, or by the attribute of a Tooltip trigger or of a Navigation Menu trigger. `unmarkedTriggers` in that file has a rule for each other trigger. Add a rule for a new trigger that has no such attribute. Do not add an attribute to the demo.
- The popup case turns off the axe rule `aria-hidden-focus`, because axe reports the focus guards of an open popup under it. [Automated accessibility checks](docs/quick-start.md#automated-accessibility-checks) says why the report is a false positive, and gives the exclusion for an app. The case thus does not see a demo that writes `aria-hidden` on a control inside a popup.
- The popup case accepts three other reports of axe, each for one kind of element and not for the whole rule. `ACCEPTED` in that file has them. A row is for a state that a part sets on purpose. Do not add a row for a fault of a demo. Correct the demo.
- The popup case fails when an option of a list cuts its text. It compares the `scrollWidth` of each option with its `clientWidth`. It also compares the box of the text with the box of the option and with the part of the list that shows. The page of the test has the default width of Vitest, 414 px. The case thus does not see a cut that shows only in a wider page.
- The popup case does not open a popup whose trigger has no attribute that the case knows and no rule in `unmarkedTriggers`, and it does not fail for such a popup. It runs in the light theme, as the mount case does.

### Thanks page

- `docs/thanks.md` includes the region `thanks` of `THANKS.md`.
- `pnpm thanks:render` writes `THANKS.md`. Do not edit the file.
- A name in `THANKS.md` is data. The owner of an account controls a display name. The author of a commit controls the name of a person with no linked account. The include puts each name into the page with no component, and VitePress compiles the page as a Vue template.
- `isDisplayName` and `isPlainText` of `scripts/thanks/render.ts` decide which names the script writes.
- After a change of the fixed text in `scripts/thanks/render.ts`, run `pnpm thanks:render` and commit `THANKS.md` in the same pull request. Until then, `pnpm test:thanks` fails, because `THANKS.md` differs from the text that the script writes.
- Run `pnpm thanks:render` before each release, and commit `THANKS.md`.

## Releases

The workflow `.github/workflows/release.yml` stages each release of `@vase-ui/vue` on npm. The repository holds no npm token.

- A version is `YYYY.M.MICRO`, such as `2026.12.0`. The month has no leading zero, and `MICRO` starts at 0.
- The tag of a release is `v` plus the version: `v2026.12.0`. A ruleset lets only an organization admin create, change or delete a `v*` tag.
- Each release has the dist-tag `latest`. A release can hold a breaking change. Its section of `CHANGELOG.md` lists each breaking change first.
- The trusted publisher of the package on npmjs.com names the file `release.yml` and the environment `npm`. npm refuses the release after a change of either name.
- The trusted publisher allows `npm stage publish` only. Do not give it `--allow-publish`. Each step of the job `stage` can get an OIDC token. With `--allow-publish`, each of these steps can make a version public with no approval.
- The workflow writes no release notes and makes no GitHub Release. `CHANGELOG.md` holds the notes of each release, one section for each version. The GitHub Release of a tag has the same text as its section.
- A maintainer publishes the first version of a package by hand, because npm sets a trusted publisher only for a package that exists.

The workflow runs on a push of a `v*` tag. It has two jobs:

- `check` runs the commands of the job `check` of CI. Change the two lists together.
- `stage` installs `@vase-ui/vue` and the workspace root, with `--filter @vase-ui/vue`. Keep the filter when you add a workspace project.

To make a release:

1. Do the step that [Thanks page](#thanks-page) gives for a release.
2. Merge a pull request that changes `version` in `packages/vue/package.json` and adds the section of that version to `CHANGELOG.md`.
3. Make sure that the check `required` passed on that commit of `main`. [Pull requests](#pull-requests) says which run gives the commit its checks. The workflow does not run `pnpm test`.
4. As an organization admin, push the tag of that commit: `git tag v2026.12.0 <commit>`, then `git push origin v2026.12.0`.
5. On npmjs.com, approve the staged version with two-factor authentication. Only a maintainer of the package can do this. The version is then public. When more than one version is staged, approve them in order, from the lowest version to the highest.
6. Make the GitHub Release of the tag. Its text is the section of that version in `CHANGELOG.md`.

## Text

- Write commit messages, pull requests, code comments and this file in Simplified Technical English (ASD-STE100).
- Use short sentences, the active voice and one instruction in each sentence.
- Give a thing the name of what it is. Do not use metaphors in names.
- Do not name a GitHub account with the at sign in a pull request. GitHub sends a notification to an account that a pull request names in that form. Use a link to the profile, as `THANKS.md` does.

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
