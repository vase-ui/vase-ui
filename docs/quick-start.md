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

`vue` is a peer dependency, and the lowest version that the package accepts is 3.5.0.

The package is published with the `next` tag, so each command above names that tag.

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
