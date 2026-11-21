---
order: 1
description: Install Vase UI and assemble your first component.
---

<script setup lang="ts">
import DemoFrame from './.vitepress/components/DemoFrame.vue';
import PopoverExample from './examples/quick-start/PopoverExample.vue';
</script>

# Quick start

A guide to install Vase UI and assemble your first component.

## Install the package

Install Vase UI with a package manager:

::: code-group

```sh [pnpm]
pnpm add @vase-ui/vue
```

```sh [npm]
npm install @vase-ui/vue
```

```sh [yarn]
yarn add @vase-ui/vue
```

:::

The package needs:

- Vue 3.5.46 or later. `vue` is a peer dependency of the package.
- A browser that has the web platform features that are [Baseline Widely available](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility).
- The global `Temporal` for the date and time components. Where the JavaScript engine does not have it, load a [polyfill](/handbook/dates-and-times#polyfill).

Each component has its own entry point, such as `@vase-ui/vue/popover`. The entry point `@vase-ui/vue` exports each component, except the date and time components. The package has no side effects, so a bundle holds only the components that your app imports.

## Set up

### Portals

A component that renders a popup, such as [Dialog](/components/dialog) or [Popover](/components/popover), puts the popup in a portal. By default, the portal is in `<body>`, outside the root element of your app.

Give the root element the style `isolation: isolate`. In a Vue app, the root element is the element that `createApp().mount()` gets, such as `#app`. In a Nuxt app, it is `#__nuxt`.

::: code-group

```css [Vue]
#app {
  isolation: isolate;
}
```

```css [Nuxt]
#__nuxt {
  isolation: isolate;
}
```

:::

The root element then has its own stacking context. A popup shows above the page, and a `z-index` inside the root element cannot put an element above the popup.

## Assemble a component

This sample imports the [Popover](/components/popover) component, assembles its parts and styles them. Vase UI ships no styles, so you can use plain CSS, CSS Modules, Tailwind CSS or another tool.

<DemoFrame>
  <PopoverExample />
</DemoFrame>

<<< ./examples/quick-start/PopoverExample.vue

## Next steps

The [handbook](/handbook/styling) shows how to style, animate and compose the components. Each component has its own page, such as the page of [Popover](/components/popover). The [parity page](/parity) shows the state of each component against Base UI.
