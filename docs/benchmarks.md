---
order: 5
description: The features, the size and the render time of Vase UI and of other component libraries.
---

<script setup lang="ts">
import BenchmarksFeatures from './.vitepress/components/BenchmarksFeatures.vue';
import BenchmarksLosses from './.vitepress/components/BenchmarksLosses.vue';
import BenchmarksRun from './.vitepress/components/BenchmarksRun.vue';
import BenchmarksSize from './.vitepress/components/BenchmarksSize.vue';
import BenchmarksTime from './.vitepress/components/BenchmarksTime.vue';
</script>

# Benchmarks

This page compares Vase UI with other unstyled component libraries: the features of each library, the size of an app that uses it, and the time that the app takes to render. The site build makes the tables from `benchmarks/results.json` and `benchmarks/features.json` of the repository.

<BenchmarksRun />

## How to read the numbers

- We measure each Vue library in two setups. A virtual DOM app is a Vue 3.5 app of `createApp`. A Vapor app is a Vue 3.6 app of `createVaporApp`.
- Each library on this page is made of virtual DOM components. A Vapor app renders them through `vaporInteropPlugin`, so each app of a library in that setup also holds the runtime of the plugin.
- Vue 3.6 is a prerelease. A failure in a Vapor app can be a fault of the prerelease.
- Each comparison is between libraries in one setup. The page does not compare the two setups.
- A time or memory cell gives the median and the 90th percentile (p90) of the samples. In each column except Vase UI, it also gives the ratio to Vase UI, with its 99% interval.
- A time cell reads "Slower" or "Faster" only when the whole interval is above 1.05 or below 0.95. A memory cell reads "More" or "Less" by the same rule. Each other cell reads "No difference above 5% detected". A wide interval does not show that two libraries take the same time.
- The numbers of two engines do not compare.
- Base UI is a React library, and Vase UI is its port to Vue. Its column is a reference from another framework, in the tables of the virtual DOM app.
- shadcn-vue and Nuxt UI use Reka UI for their behavior, so the Reka UI column applies to them.
- PrimeVue 5 needs a license key, so this page does not measure it.
- Vase UI is not affiliated with the other projects.

## Features

Each cell links to its source: the docs or the package of the library, at the measured version. A note that starts with "Our check" gives the result of our own check of the example in the docs, or of the apps on this page. [Method](#method) tells how we check. "No" means that the docs do not give the feature, or that our check failed.

<BenchmarksFeatures />

## Size

Each app renders one component of one library, with the parts of the example in the docs of the library. The row "All ten components" renders each of the ten components once. The bytes are the sum of the JavaScript and CSS files of the production build. They count the app, the library, the dependencies of the library and the framework. The tables show gzip bytes. Open "Raw bytes" or "Brotli bytes" below a table for the other measures.

### App size

The first row is the empty app of each setup: the framework and one button. The empty app of the Vapor app has no interop plugin.

<BenchmarksSize measure="app" />

### Size that a component adds

Each cell is the app minus the empty app of its setup.

<BenchmarksSize measure="added" />

## Render time

Each table gives one engine and one setup. Chromium runs with its CPU four times slower, which is the setting of Lighthouse for a phone of the middle class. Firefox and WebKit run with no CPU slowdown, because Playwright has no such control for them. Firefox and WebKit are the builds of Playwright for Linux, not the releases of Firefox and Safari.

### Mount 100 instances

The time from the start of the app to 100 instances of the component in the document.

<BenchmarksTime group="mount" />

### Open and close a popup

A click on the trigger opens Dialog and Popover. ArrowDown on the focused trigger opens Menu and Select, and ArrowDown on the focused input opens Combobox. A real Escape press closes each popup.

<BenchmarksTime group="popup" />

### A list of 1,000 options

Select and Combobox open with 1,000 options. Then ArrowDown moves the highlight. Then the filter `9` of Combobox leaves 271 options.

<BenchmarksTime group="list" />

### Hydration

The time to hydrate the server HTML of the app of all ten components.

<BenchmarksTime group="hydration" />

### Memory

The heap that the mount of 100 instances adds in Chromium, after a garbage collection. Playwright gives no heap measure in Firefox and WebKit.

<BenchmarksTime group="memory" />

## Where Vase UI is larger or slower

The site build makes this list from the tables above. It has each row where another library adds fewer gzip bytes than Vase UI. The percent is the difference divided by the bytes of the other library. It also has each time or memory cell that reads "Faster" or "Less".

<BenchmarksLosses />

## Method

- **Build.** Vite builds each app with its defaults for production, into one JavaScript file, with no module preload polyfill. Each app has one copy of its framework.
- **Bytes.** The size is the sum of the bytes of each `.js` and `.css` file of the app. The compressed sizes come from the default levels of gzip and Brotli in Node.js. The results also record the versions of zlib and Brotli.
- **Fixtures.** Each fixture uses the parts and the import form of the anatomy, or of the first example, in the docs of the library. It uses the default props and the same text as the other fixtures. It has no CSS, icons, animations or virtualization.
- **Our checks.** We render each app of each library on the server with `renderToString` of Vue, and hydrate it in Chromium, Firefox and WebKit with `createSSRApp`, or with `createVaporSSRApp` and `vaporInteropPlugin`. For Base UI, we use `renderToString` and `hydrateRoot` of React. A teleport to `body` goes at the start of `body`, where the hydration of Vue looks for it. We record each message of the server render and of the hydration, and then use the app once. We also load each app with no server render in the three browsers, with three instances. A click or `ArrowDown` opens each popup, `ArrowDown` moves the highlight, the filter `9` leaves 271 of 1,000 options, and a real Escape press closes the popup. In a virtual DOM app and in the React app, each app of each library passes this check. For a dialog in a dialog, we open both dialogs, then press Escape, then press outside the top dialog. Each time, the top dialog closes and the dialog below it stays open.
- **Pages.** Playwright opens each app from a local server, in a new browser context for each sample. Each page is cross-origin isolated, so `performance.now()` has steps of 5 microseconds in Chromium and of 20 microseconds in Firefox and WebKit.
- **Durations.** A step starts in a frame callback, as in Speedometer 3. A timer after that callback checks the end state, and when the state is not there, the check runs again after each frame. A duration counts the script, style, layout and paint work of the frame of the step.
- **Close.** A browser closes a native dialog or a popover only on a real Escape press, so each library gets a real Escape press. The time starts at the `keydown` event. In Chromium, the next frame comes before the check, so a close also counts that frame. Before each Escape press, the runner waits for two frames, so each close starts at the same point of a frame.
- **Start state.** Each timed open starts from a closed popup. Five untimed pairs of open and close come before the timed pair. A mount and a hydration have no untimed run.
- **Failures.** A console error, a console warning or an uncaught error in one sample fails the cell. A server render that reports an error fails the hydration. A cell that fails shows the reason.
- **Rounds.** In each round, each visit opens the page of each library once. The sequence of the libraries is random in each visit. The table "Runs of the render time" gives the count of rounds.
- **Statistics.** The ratio to Vase UI is the median of the ratios of the same round, so the noise of the machine in a round reaches both sides. Each interval is a 99% bootstrap interval of 10,000 resamples. Each cell has the same 99% level and the same 5% band, so few verdicts come by chance.
- **Machine.** The workflow `Benchmarks` runs on the `ubuntu-latest` machine of GitHub, in the Playwright image of the CI. The table "Runs of the render time" gives the CPU and the browser version.
- **Commands.** `pnpm build`, then `pnpm benchmarks:size`, writes the sizes. `pnpm benchmarks:build`, then `pnpm benchmarks:time`, writes the render times. The page shows only the results of the workflow `Benchmarks`. [`benchmarks`](https://github.com/vase-ui/vase-ui/tree/main/benchmarks) holds the fixtures, the build and the runner.
