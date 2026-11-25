---
order: 5
description: The features, the behavior, the size and the render time of Vase UI and of other component libraries.
---

<script setup lang="ts">
import BenchmarksBehavior from './.vitepress/components/BenchmarksBehavior.vue';
import BenchmarksBehaviorSummary from './.vitepress/components/BenchmarksBehaviorSummary.vue';
import BenchmarksFeatures from './.vitepress/components/BenchmarksFeatures.vue';
import BenchmarksLosses from './.vitepress/components/BenchmarksLosses.vue';
import BenchmarksRun from './.vitepress/components/BenchmarksRun.vue';
import BenchmarksSize from './.vitepress/components/BenchmarksSize.vue';
import BenchmarksSpeed from './.vitepress/components/BenchmarksSpeed.vue';
import BenchmarksTime from './.vitepress/components/BenchmarksTime.vue';
</script>

# Benchmarks

This page compares Vase UI with other unstyled component libraries: the features of each library, its behavior with real input, the size of an app that uses it, and the time that the app takes to render. The site build makes the tables from `benchmarks/results.json`, `benchmarks/features.json`, `benchmarks/notes.json` and the checks of `benchmarks/behavior` of the repository.

<BenchmarksRun />

## Summary

Vase UI is a port of Base UI to Vue. It gives the users and the developers of an app these behaviors:

- Vase UI has each component of Base UI, and a Vase UI test runs each Base UI test case that applies to Vue ([Components of Base UI](#feature-components-of-base-ui), [Parity](/parity)).
- A dialog or a drawer can open from another one, and the one below gets a style hook while the one on top is open ([dialogs](#feature-a-style-hook-on-a-dialog-while-a-dialog-on-top-of-it-is-open), [drawers](#feature-a-style-hook-on-a-drawer-while-a-drawer-on-top-of-it-is-open)).
- A touch outside an open popup closes it only at a tap, so a touch that scrolls the page closes no popup ([Popover](/components/popover#differences-behavior)).
- Toasts have a manager that a script calls, a stack, a limit, a swipe to close, and an announcement at once of an important toast ([Toast](#feature-a-toast-manager-that-a-script-calls), [swipe](#behavior-toasts-swipe-closes), [announcement](#behavior-toasts-important-is-assertive)).
- The values of the date and time components are `Temporal` values ([Dates and times](#behavior-dates-and-times-value-type)).
- In a virtual DOM app, the server HTML of each app hydrates with no message, and the docs show Vapor mode and a Nuxt module ([hydration](#feature-hydration-of-the-server-html-of-each-app-in-a-virtual-dom-app), [Vapor mode](#feature-vapor-mode-in-the-docs), [Nuxt](#feature-nuxt-module)).

The first table gives the behavior checks of each group that each library passes in Chromium, Firefox and WebKit, of the checks that have a fixture of the library ([Behavior](#behavior)). A `*` marks each group where Vase UI does not pass a check. It links to the check in the list of the losses.

<BenchmarksBehaviorSummary />

The second table gives the time of each other Vue library over the time of Vase UI, in each engine ([Render time](#render-time)). Above 1, Vase UI is faster.

<BenchmarksSpeed />

A cell is the geometric mean of the ratios of all time measures of the two setups. It also gives the count of measures where Vase UI is faster.
A `*` marks each cell below 1, where the other library is faster. It links to the list of the losses ([Where Vase UI is larger, slower or fails a check](#where-vase-ui-is-larger-slower-or-fails-a-check)).

## How to read the numbers

- We measure each Vue library in two setups. A virtual DOM app is a Vue 3.5 app of `createApp`. A Vapor app is a Vue 3.6 app of `createVaporApp`.
- Each library on this page is made of virtual DOM components. A Vapor app renders them through `vaporInteropPlugin`, so each app of a library in that setup also holds the runtime of the plugin.
- Vue 3.6 is a prerelease. A failure in a Vapor app can be a fault of the prerelease.
- Each comparison is between libraries in one setup. The page does not compare the two setups.
- A time or memory cell gives the median and the 90th percentile (p90) of the samples. In each column of a Vue library except Vase UI, it also gives the ratio to Vase UI, with its 99% interval.
- A time cell reads "Slower" or "Faster" only when the whole interval is above 1.05 or below 0.95. A memory cell reads "More" or "Less" by the same rule. Each other cell reads "No difference above 5% detected". A wide interval does not show that two libraries take the same time.
- A `*` marks each loss of Vase UI to another Vue library: on the Vase UI cell of a size row, after "Faster" or "Less" in a time or memory cell, and after a ratio below 1 in the summary. It links to the behavior that costs the bytes, the time or the memory.
- A `*` also marks each Vase UI cell of a behavior check that Vase UI does not pass in one engine or more. It links to the check in the list of the losses.
- The numbers of two engines do not compare.
- Base UI is a React library, and Vase UI is its port to Vue. Its column is a reference from another framework, in the tables of the virtual DOM app. The page gives no ratio and no verdict for it.
- shadcn-vue and Nuxt UI use Reka UI for their behavior, so the Reka UI column applies to them.
- PrimeVue 5 needs a license key, so this page does not measure it.
- Vase UI is not affiliated with the other projects.

## Features

Each cell links to its source: the docs or the package of the library, at the measured version. A note that starts with "Our check" gives the result of our own check of the example in the docs, or of the apps on this page. [Method](#method) tells how we check. "No" means that the docs do not give the feature, or that our check failed. A feature that a behavior check measures has no row here ([Behavior](#behavior)).

<BenchmarksFeatures />

## Behavior

Each row is a check that we run in Chromium, Firefox and WebKit with real input: the mouse, the keyboard and the touch input of Playwright. The expectation of each row comes from a standard or a platform, such as the WAI-ARIA Authoring Practices or the HTML Standard. In each row, "Expectation" links to that source, and "Code" links to the code of the check.

- Each case of a check runs 3 times in each engine, each time in a new browser context. A case needs 2 valid runs, else it reads "Not measured: frame gaps". A case passes when each valid run passes. "Not stable" means that some runs of a case pass and others do not.
- A cell reads "Pass" when each case passes, "Fail" when no case passes, and "Partly" when some cases pass. Below the verdict, it names each case that does not pass, with the reason. "Not provided" means that the library has no such component.
- When the engines do not agree, the cell gives the result of each engine. When they agree, the reason comes from the first of Chromium, Firefox and WebKit. A touch case runs in Chromium only.
- "Measures" in a cell gives the measure of each case in each engine. "Fixture" links to the code of the app of the library.
- Each fixture uses the pattern of the docs of its library, with the same sizes and colors in each library. [Method](#method) gives the rules and the limits.
- A fact row gives a value and no verdict.
- Base UI is a React library. Its column is a reference, and the page does not compare it with Vase UI.

### Nested dialogs

<BenchmarksBehavior group="nested-dialogs" />

### Drawers

<BenchmarksBehavior group="drawers" />

### Toasts

<BenchmarksBehavior group="toasts" />

### Resizable panels

<BenchmarksBehavior group="resizable-panels" />

### Dates and times

<BenchmarksBehavior group="dates-and-times" />

### Popup animations

<BenchmarksBehavior group="popup-animations" />

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

## Where Vase UI is larger, slower or fails a check

The site build makes this list from the tables above. It has each row where another Vue library adds fewer gzip bytes than Vase UI. The percent is the difference divided by the bytes of the other library. It also has each time or memory cell that reads "Faster" or "Less". Each group starts with the behavior that costs the bytes, the time or the memory. The last table has each behavior check that Vase UI does not pass in one engine or more, with the reason and the other Vue libraries that pass it.

<BenchmarksLosses />

## Method

- **Build.** Vite builds each app with its defaults for production, into one JavaScript file, with no module preload polyfill. Each app has one copy of its framework.
- **Bytes.** The size is the sum of the bytes of each `.js` and `.css` file of the app. The compressed sizes come from the default levels of gzip and Brotli in Node.js. The results also record the versions of zlib and Brotli.
- **Fixtures.** Each fixture uses the parts and the import form of the anatomy, or of the first example, in the docs of the library. It uses the default props and the same text as the other fixtures. It has no CSS, icons, animations or virtualization.
- **Our checks.** We render each app of each library on the server with `renderToString` of Vue, and hydrate it in Chromium, Firefox and WebKit with `createSSRApp`, or with `createVaporSSRApp` and `vaporInteropPlugin`. For Base UI, we use `renderToString` and `hydrateRoot` of React. A teleport to `body` goes at the start of `body`, where the hydration of Vue looks for it. We record each message of the server render and of the hydration, and then use the app once. We also load each app with no server render in the three browsers, with three instances. A click or `ArrowDown` opens each popup, `ArrowDown` moves the highlight, the filter `9` leaves 271 of 1,000 options, and a real Escape press closes the popup. In a virtual DOM app and in the React app, each app of each library passes this check.
- **Behavior fixtures.** Each behavior fixture uses the parts, the import form and the pattern of the docs of its library, such as its nested dialog example. Each library has the same sizes and colors. A dialog and a popup enter and leave in 500 ms, linear, from an opacity of 0 and a scale of 0.8. Where the docs show a CSS transition, the fixture uses it. Else it uses the CSS keyframes of the docs. A drawer and a stack of toasts use the CSS of the example of the docs for the part that moves. A fixture has no code that makes a check pass: no focus code and no key or pointer listener. The notes above a table give the animation form of a fixture, and each library whose docs give no pattern for a step or call the component Alpha or Preview. The Vue libraries run in a virtual DOM app, and Base UI in a React app.
- **Behavior input.** Each run opens a new browser context of 1280 by 720 pixels, with the locale `en-US`, the time zone UTC and no reduced motion. The mouse and the keyboard of Playwright give the input. Touch input goes through the Chrome DevTools Protocol, so a touch case runs in Chromium only. Each tooltip and preview card opens and closes with a delay of 0. A close or an open that interrupts an animation comes 250 ms after the first visible frame of the enter, or 250 ms after the close.
- **Animation samples.** A recorder in the page reads each marker in each animation frame: whether it shows, its opacity and its rectangle. A layer is at rest when it shows at full opacity, no animation runs on it, and its rectangle and its opacity stay the same for 100 ms. A jump is a change of the opacity between two frames of more than 0.2, beyond the change that a 500 ms animation gives in that time. An enter starts at an opacity of 0.2 or less and gets to 0.99 or more after 500 ms, within 150 ms. An exit ends at an opacity of 0.2 or less after 500 ms, within 150 ms. After an interruption, the opacity can go on in the old direction by 0.15 at most. The checks measure jumps and times, not the frame rate.
- **Behavior limits.** A drawer can be 10 px from the pointer in a drag, and a splitter handle 4 px. After a release, no frame moves a drawer by more than 100 px. The input on the layer below comes 100 ms after the close of the layer on top. A layer has 1 s to close or to take the focus, and 2 s to be at rest after it opens. `benchmarks/behavior/samples.ts` holds the limits above. The file of each group holds the other limits of its checks, and the link "Code" of a row opens that file.
- **Behavior verdicts.** A run with a gap of more than 100 ms between two frames is not valid. A console error, an uncaught error or a step that throws fails the run, and the cell gives the first line as the reason.
- **Pages.** Playwright opens each app from a local server, in a new browser context for each sample. Each page is cross-origin isolated, so `performance.now()` has steps of 5 microseconds in Chromium and of 20 microseconds in Firefox and WebKit.
- **Durations.** A step starts in a frame callback, as in Speedometer 3. A timer after that callback checks the end state, and when the state is not there, the check runs again after each frame. A duration counts the script, style, layout and paint work of the frame of the step.
- **Close.** A browser closes a native dialog or a popover only on a real Escape press, so each library gets a real Escape press. The time starts at the `keydown` event. In Chromium, the next frame comes before the check, so a close also counts that frame. Before each Escape press, the runner waits for two frames, so each close starts at the same point of a frame.
- **Start state.** Each timed open starts from a closed popup. Five untimed pairs of open and close come before the timed pair. A mount and a hydration have no untimed run.
- **Failures.** A console error, a console warning or an uncaught error in one sample fails the cell. A server render that reports an error fails the hydration. A cell that fails shows the reason.
- **Rounds.** In each round, each visit opens the page of each library once. The sequence of the libraries is random in each visit. The table "Runs of the render time" gives the count of rounds.
- **Statistics.** The ratio to Vase UI is the median of the ratios of the same round, so the noise of the machine in a round reaches both sides. Each interval is a 99% bootstrap interval of 10,000 resamples. Each cell has the same 99% level and the same 5% band, so few verdicts come by chance.
- **Machine.** The workflow `Benchmarks` runs on the `ubuntu-latest` machine of GitHub, in the Playwright image of the CI. The tables "Runs of the render time" and "Runs of the behavior checks" give the CPU and the browser version.
- **Commands.** `pnpm build`, then `pnpm benchmarks:size`, writes the sizes. `pnpm benchmarks:build`, then `pnpm benchmarks:time`, writes the render times, and `pnpm benchmarks:behavior` writes the behavior results. The page shows only the results of the workflow `Benchmarks`. [`benchmarks`](https://github.com/vase-ui/vase-ui/tree/main/benchmarks) holds the fixtures, the build and the runner.
