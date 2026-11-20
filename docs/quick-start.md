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
pnpm add @vase-ui/vue
```

```sh [npm]
npm install @vase-ui/vue
```

```sh [yarn]
yarn add @vase-ui/vue
```

:::

`vue` is a peer dependency, and the lowest version that the package accepts is 3.5.12.

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

### Automated accessibility checks

An open popup keeps focus guards beside its trigger and around the popup. A guard is a `<span>` with `data-vase-ui-focus-guard`, `tabindex="0"` and `aria-hidden="true"`. The guards keep the Tab order correct between the page and the portal.

[axe-core](https://github.com/dequelabs/axe-core) reports the guards under the rule `aria-hidden-focus`. The report is a violation when the page shows no dialog, such as with a Menu that has `modal` set to `false`. With a dialog on the page, the report is "needs review".

The report is a false positive. A guard moves the focus immediately, and [ACT rule 6cfa84](https://www.w3.org/WAI/standards-guidelines/act/rules/6cfa84/) does not count such an element as focusable. Base UI and Floating UI render the same guards ([base-ui#5237](https://github.com/mui/base-ui/issues/5237), [floating-ui#2758](https://github.com/floating-ui/floating-ui/issues/2758)).

Exclude the guards from the check. Do not turn the rule off for the page.

::: code-group

```ts [axe-core]
await axe.run({ exclude: ['[data-vase-ui-focus-guard]'] });
```

```ts [@axe-core/playwright]
await new AxeBuilder({ page }).exclude('[data-vase-ui-focus-guard]').analyze();
```

:::

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

A part sets attributes for its state, such as `aria-orientation` on Separator. A disabled Button matches `:disabled`, or `[aria-disabled='true']` when it keeps the focus.

A selector can use these attributes, as the two examples above do.

To calculate a class or style from state, bind `:class` or `:style` on your element in the slot that replaces the element. That slot is `#element` on Button and Separator.

The [styling guide](/handbook/styling) has more on styling.

The [parity page](/parity) shows the state of Vase UI against Base UI.
