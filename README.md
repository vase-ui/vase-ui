<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/vase-ui/vase-ui/main/docs/public/wordmark-dark.svg">
    <img src="https://raw.githubusercontent.com/vase-ui/vase-ui/main/docs/public/wordmark-light.svg" alt="Vase UI" height="28">
  </picture>
</h1>

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

Report bugs in [Bugs](https://github.com/vase-ui/vase-ui/discussions/new?category=bugs). Request changes or features in [Ideas](https://github.com/vase-ui/vase-ui/discussions/new?category=ideas). Our AI agents write the code through the process in [CONTRIBUTING.md](https://github.com/vase-ui/vase-ui/blob/main/CONTRIBUTING.md).

Do not report a security problem in public. Use [GitHub's private vulnerability reporting](https://github.com/vase-ui/vase-ui/security/advisories/new).

<!-- #region donation -->

> This project is free and open-source work by a 501(c)(3) non-profit. If you find it useful, please consider [donating](https://github.com/sponsors/mathematic-inc).

<!-- #endregion donation -->
