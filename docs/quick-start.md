---
order: 1
description: Install Vase UI and use your first component.
---

<script setup lang="ts">
import ButtonExample from './examples/quick-start/ButtonExample.vue';
import SeparatorExample from './examples/quick-start/SeparatorExample.vue';
</script>

# Quick start

## Install the package

::: code-group

```sh [pnpm]
pnpm add @vase-ui/vue@next
```

```sh [npm]
npm install @vase-ui/vue@next
```

```sh [yarn]
yarn add @vase-ui/vue@next
```

:::

`vue` is a peer dependency, and the lowest version that the package accepts is 3.5.12.

The package is published with the `next` tag, so each command above names that tag.

## Set up

### Portals

A component that renders a popup, such as [Tooltip](/components/tooltip) or [Preview Card](/components/preview-card), puts the popup in a portal. By default, the portal is in `<body>`, outside the root element of your app.

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

## Use a component

Each component has its own entry point, such as `@vase-ui/vue/button`. The entry point `@vase-ui/vue` exports them together.

### Button

<ButtonExample />

<<< ./examples/quick-start/ButtonExample.vue

### Separator

<SeparatorExample />

<<< ./examples/quick-start/SeparatorExample.vue

## Style a part

Vase UI ships no styles.

The `class` and `style` that you set on a part go to its element.

A part sets data attributes for its state, such as `data-disabled` on Button and `data-orientation` on Separator.

A selector can use these attributes, as the two examples above do.

The `stateClass` and `stateStyle` props give a class or a style that depends on the state.

The [parity page](/parity) shows the state of Vase UI against Base UI.
