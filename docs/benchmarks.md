---
order: 5
description: The size and the render time of Vase UI and of other component libraries.
---

<script setup lang="ts">
import BenchmarksFeatures from './.vitepress/components/BenchmarksFeatures.vue';
import BenchmarksLosses from './.vitepress/components/BenchmarksLosses.vue';
import BenchmarksRun from './.vitepress/components/BenchmarksRun.vue';
import BenchmarksSize from './.vitepress/components/BenchmarksSize.vue';
</script>

# Benchmarks

This page compares Vase UI with other unstyled component libraries: the features of each library, and the size of an app that uses it. The site build makes the tables from `benchmarks/results.json` and `benchmarks/features.json` of the repository.

<BenchmarksRun />

## How to read the numbers

- Each Vue library has two setups. A virtual DOM app is a Vue 3.5 app of `createApp`. A Vapor app is a Vue 3.6 app of `createVaporApp`.
- Each library on this page is made of virtual DOM components. A Vapor app renders them through `vaporInteropPlugin`, so each app of a library in that setup also holds the runtime of the plugin.
- Vue 3.6 is a prerelease. A failure in a Vapor app can be a fault of the prerelease.
- Each comparison is between libraries in one setup. The page does not compare the two setups.
- Base UI is a React library, and Vase UI is its port to Vue. Its column is a reference from another framework, in the tables of the virtual DOM app.
- shadcn-vue and Nuxt UI use Reka UI for their behavior, so the Reka UI column applies to them.
- PrimeVue 5 needs a license key, so this page does not measure it.
- Vase UI is not affiliated with the other projects.

## Features

Each cell links to its source: the docs or the package of the library, at the measured version. A note that starts with "Our check" gives the result of our own check of the example in the docs. [Method](#method) tells how we check.

<BenchmarksFeatures />

## Size

Each app renders one component of one library, with the parts of the example in the docs of the library. The row "All ten components" renders each of the ten components once. The bytes are the sum of the JavaScript and CSS files of the production build. They count the app, the library, the dependencies of the library and the framework. The tables show gzip bytes. Open "Raw bytes" or "Brotli bytes" below a table for the other measures.

### App size

The first row is the empty app of each setup: the framework and one button. The empty app of the Vapor app has no interop plugin.

<BenchmarksSize measure="app" />

### Size that a component adds

Each cell is the app minus the empty app of its setup.

<BenchmarksSize measure="added" />

## Where Vase UI is larger or slower

The site build makes this list from the tables above. It has each row where another library adds fewer gzip bytes than Vase UI. The percent is the difference divided by the bytes of the other library.

<BenchmarksLosses />

## Method

- **Build.** Vite builds each app with its defaults for production, into one JavaScript file, with no module preload polyfill. Each app has one copy of its framework.
- **Bytes.** The size is the sum of the bytes of each `.js` and `.css` file of the app. The compressed sizes come from the default levels of gzip and Brotli in Node.js. The results also record the versions of zlib and Brotli.
- **Fixtures.** Each fixture uses the parts and the import form of the anatomy, or of the first example, in the docs of the library. It uses the default props and the same text as the other fixtures. It has no CSS, icons, animations or virtualization.
- **Our checks.** We render the Dialog example of the docs on the server with `renderToString` of Vue and hydrate it in Chromium with `createSSRApp`, or with `createVaporSSRApp` and `vaporInteropPlugin`. A teleport to `body` goes at the end of `body`. We then record each hydration message of Vue, click the trigger and press Escape. For a dialog in a dialog, we open both dialogs, then press Escape, then press outside the top dialog. Each time, the top dialog closes and the dialog below it stays open.
- **Commands.** `pnpm build`, then `pnpm benchmarks:size`, writes the sizes. [`benchmarks`](https://github.com/vase-ui/vase-ui/tree/main/benchmarks) holds the fixtures and the build.
