<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/vase-ui/vase-ui/main/docs/public/wordmark-dark.svg">
    <img src="https://raw.githubusercontent.com/vase-ui/vase-ui/main/docs/public/wordmark-light.svg" alt="Vase UI" height="28">
  </picture>
</h1>

[![Tested in Chromium, Firefox and WebKit](https://img.shields.io/badge/tested%20in-Chromium%20%C2%B7%20Firefox%20%C2%B7%20WebKit-161616)](https://github.com/vase-ui/vase-ui/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@vase-ui/vue?label=npm&logo=npm)](https://www.npmjs.com/package/@vase-ui/vue) [![CI status](https://img.shields.io/github/actions/workflow/status/vase-ui/vase-ui/ci.yml?event=merge_group&label=CI&logo=githubactions)](https://github.com/vase-ui/vase-ui/actions/workflows/ci.yml) [![Docs deploy status](https://img.shields.io/github/actions/workflow/status/vase-ui/vase-ui/docs.yml?branch=main&label=docs)](https://vase-ui.com) [![License](https://img.shields.io/npm/l/@vase-ui/vue)](LICENSE) [![Vue peer dependency](https://img.shields.io/npm/dependency-version/@vase-ui/vue/peer/vue?label=vue&logo=vuedotjs)](https://vuejs.org) [![Socket supply-chain score](https://socket.dev/api/badge/npm/package/@vase-ui/vue)](https://socket.dev/npm/package/@vase-ui/vue) [![Base UI release that Vase UI tracks](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fvase-ui%2Fvase-ui%2Fmain%2Fparity%2Fupstream.json&query=%24.release&label=Base%20UI)](https://vase-ui.com/parity)

<!-- #region home -->

Base UI, arranged for Vue.

Unstyled Vue components from [Base UI](https://base-ui.com). Actively maintained. All 38 Base UI components, plus date, time and resizable panels. It ships no styles. A vase should not pick your flowers.

Vase UI is maintained independently: every Base UI release is ported within two weeks, and more than 6,500 tests run in each of Chromium, Firefox and WebKit before each merge.

Vase UI also has some components that Base UI does not have, such as Resizable. [The parity page](https://vase-ui.com/parity) lists them.

Vase UI is an independent project. It is not affiliated with MUI.

## Our guarantee

Every Base UI feature has a Vase UI form. The parity page names each feature that Vue or the browser gives in a better way.

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
