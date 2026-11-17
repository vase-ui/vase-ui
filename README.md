<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/vase-ui/vase-ui/main/docs/public/wordmark-dark.svg">
    <img src="https://raw.githubusercontent.com/vase-ui/vase-ui/main/docs/public/wordmark-light.svg" alt="Vase UI" height="28">
  </picture>
</h1>

[![npm version](https://img.shields.io/npm/v/@vase-ui/vue?label=npm&logo=npm)](https://www.npmjs.com/package/@vase-ui/vue) [![Monthly npm downloads](https://img.shields.io/npm/dm/@vase-ui/vue)](https://www.npmjs.com/package/@vase-ui/vue) [![CI status](https://img.shields.io/github/actions/workflow/status/vase-ui/vase-ui/ci.yml?event=merge_group&label=CI&logo=githubactions)](https://github.com/vase-ui/vase-ui/actions/workflows/ci.yml) [![Docs deploy status](https://img.shields.io/github/actions/workflow/status/vase-ui/vase-ui/docs.yml?branch=main&label=docs)](https://vase-ui.com) [![Base UI parity](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fvase-ui%2Fvase-ui%2Fmain%2Fparity%2Fupstream.json&query=%24.release&label=matches%20Base%20UI)](https://vase-ui.com/parity) [![License](https://img.shields.io/npm/l/@vase-ui/vue)](LICENSE) [![TypeScript types](https://img.shields.io/npm/types/@vase-ui/vue?logo=typescript)](https://vase-ui.com/handbook/typescript) [![Vue peer dependency](https://img.shields.io/npm/dependency-version/@vase-ui/vue/peer/vue?logo=vuedotjs)](https://vuejs.org) [![GitHub discussions](https://img.shields.io/github/discussions/vase-ui/vase-ui)](https://github.com/vase-ui/vase-ui/discussions) [![Tested in Chromium, Firefox and WebKit](https://img.shields.io/badge/tested%20in-Chromium%20%C2%B7%20Firefox%20%C2%B7%20WebKit-161616)](https://github.com/vase-ui/vase-ui/actions/workflows/ci.yml) [![Nuxt supported](https://img.shields.io/badge/Nuxt-supported-161616?logo=nuxt)](https://vase-ui.com/quick-start) [![npm provenance signed](https://img.shields.io/badge/npm%20provenance-signed-161616)](https://www.npmjs.com/package/@vase-ui/vue#provenance)

[![styles: bring your own flowers](https://img.shields.io/badge/styles-bring%20your%20own%20flowers-161616)](https://vase-ui.com/handbook/styling) [![React: had it first](https://img.shields.io/badge/React-had%20it%20first-161616)](#why) [![Vue: has it now](https://img.shields.io/badge/Vue-has%20it%20now-161616)](#why)

<!-- #region home -->

Base UI, arranged for Vue.

Vase UI is a port of [Base UI](https://base-ui.com) to Vue 3: the same unstyled, accessible components, with the same parts, data attributes and CSS variables, written as Vue components. It ships no styles. A vase should not pick your flowers.

Vase UI also has some components that Base UI does not have, such as Resizable. [The parity page](https://vase-ui.com/parity) lists them.

Vase UI is an independent project. It is not affiliated with MUI.

## Our guarantee

Every Base UI component and documented API has a Vase UI counterpart.

- When Base UI publishes a release, Vase UI has every improvement of that release within two weeks.
- [The parity page](https://vase-ui.com/parity) shows, for every component, the Base UI commit it matches, and every Base UI change with its state: mirrored, queued, or not applicable to Vue, with the reason.
- Where Vue or the browser lets us handle an edge case better than the original, we do, and we list each one with its test.

## Install

```sh
pnpm add @vase-ui/vue
```

```sh
npm install @vase-ui/vue
```

```sh
yarn add @vase-ui/vue
```

[The quick start](https://vase-ui.com/quick-start) shows the setup and your first component.

## Why

React gets the good component libraries first. Vue gets to wait. We think the Vue ecosystem deserves the same love as React's, so we stopped waiting.

<!-- #endregion home -->

## Thanks

Vase UI is a port, so the hard part was done before we started. The engineers behind Base UI, and behind Floating UI and aria-hidden before it, spent years on focus management, screen readers and browser bugs. We carried their work across. Every one of them is named in [THANKS.md](THANKS.md).

## Contributing

Report bugs in [Bugs](https://github.com/vase-ui/vase-ui/discussions/new?category=bugs). Request changes or features in [Ideas](https://github.com/vase-ui/vase-ui/discussions/new?category=ideas). See [Contributing](https://vase-ui.com/contributing) for the process and [CONTRIBUTING.md](https://github.com/vase-ui/vase-ui/blob/main/CONTRIBUTING.md) for our code rules.

Do not report a security problem in public. Use [GitHub's private vulnerability reporting](https://github.com/vase-ui/vase-ui/security/advisories/new).

<!-- #region donation -->

> This project is free and open-source work by a 501(c)(3) non-profit. If you find it useful, please consider [donating](https://github.com/sponsors/mathematic-inc).

<!-- #endregion donation -->
