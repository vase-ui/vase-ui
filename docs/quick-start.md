---
order: 1
description: Install Vase UI, set up your app and assemble your first component.
outline: deep
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

In a Nuxt app, add the [Nuxt module](#nuxt) of the package. Your components then use each component with no import.

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

Give the `z-index` of a popup that has a positioner, such as a [Select](/components/select) or a [Popover](/components/popover), to its positioner. While a modal popup of this kind is open, an element with a lower `z-index` gets no pointer, the same as the rest of the page.

### Server rendering

Vase UI components render on the server, and the browser hydrates them.

#### What the server renders

Each part renders with `renderToString` of Vue. The server HTML has what the first render of the browser has: the elements, their attributes, the text and the form inputs.

A closed panel that `keepMounted` or `hiddenUntilFound` keeps in the DOM, such as a panel of `Collapsible` or `Tabs`, is in the server HTML too. A search engine can then read its text. Find-in-page finds only the text of a `hiddenUntilFound` panel: a closed panel with `keepMounted` is `hidden` and `inert`.

#### Popups and portals

A `Portal` part renders its content after its mount, as the [Vue guide](https://vuejs.org/guide/scaling-up/ssr.html#teleports) says for a `<Teleport>`. The server HTML thus has the triggers and no popup. The popup of a root that is open at the mount comes one update after the mount.

With `disabled`, a `Portal` part renders its content in its place, also on the server. A CSS selector in `to` is read in the browser only, so the server needs no document.

#### Values that the server cannot know

The server and the browser must render the same HTML. So no part reads a value of the visitor in a render. Give each such value, or the part uses one fixed value on both sides.

- **Locale.** A part uses its `locale` prop, else the nearest [`LocaleProvider`](/utils/locale-provider), else `en-US`. It never reads the locale of the visitor. A server and a browser can still have other `Intl` data for one locale. Then the text of the browser wins after the hydration. Give `data-allow-mismatch="text"` to your own element that shows such a text.
- **Time zone and today.** No part reads the clock in a render. A part that needs today reads it after the mount. A server that knows the day of the visitor gives it with the data of the page, such as the `today` prop of `Calendar`. In your own template, an expression of `Temporal.Now` can give the browser another day than the server. See [Dates and times](/handbook/dates-and-times).
- **Direction.** A server cannot read the direction of an element around a part. `Slider.Root` places its thumbs in the server HTML, so give it its own `dir`. See [Text direction](/handbook/styling#text-direction).
- **The element of a component.** A part knows the element of a component in `as`, or of the `element` slot, only at the mount. Before the mount, a part that acts as a button writes the attributes that suit a `<button>` and each other element: `type="button"`, `role="button"`, a tab stop and the disabled state. At the mount, the part keeps the attributes of its element.
- **Measures.** A server cannot measure the page. A part that places itself by a measure takes the measure after the mount. Examples are `Tabs.Indicator` and a panel of `Resizable` with a length size. With `renderBeforeHydration`, `Tabs.Indicator` places itself with an inline script before the app starts.

The server HTML and the first render of the browser can differ in a value that the browser corrects. The part then has `data-allow-mismatch`, and Vue shows no message for that value.

#### Before the hydration

A part handles the events of the browser after the hydration. Before it, a part does not read text that the visitor types, a press on a label, or form state that the browser restores.

#### Content Security Policy

Some parts render an inline `<style>` or `<script>` element. Under a strict Content Security Policy, give the nonce of each request to [`CSPProvider`](/utils/csp-provider). The parts below it write the nonce on these elements.

### Nuxt

With the Nuxt module of the package, your components use each component of Vase UI with no import. When your app has `temporal-polyfill`, the module also loads it where the engine has no `Temporal`.

For a link of the router in a part, see [The element slot](/handbook/composition#the-element-slot).

#### Add the module

The package has a Nuxt module for Nuxt 4. Add it to `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@vase-ui/vue/nuxt'],
});
```

The module is optional. Without it, import each component from its entry point, such as `@vase-ui/vue/dialog`, as in a Vue app. Vase UI needs no other configuration.

#### Components with no import

The module adds each component of Vase UI to the app. A template uses a component with no import:

```vue
<template>
  <Dialog.Root>
    <Dialog.Trigger>Open</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup>
        <Dialog.Title>Notifications</Dialog.Title>
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
```

A script uses the namespace of a component, such as `Dialog`, and `useElement` with no import:

```vue
<script setup lang="ts">
const handle = Dialog.createHandle();
</script>
```

- A page loads only the components that it uses.
- `nuxt prepare` writes the types of the components and the namespaces, so vue-tsc checks a template with no import.
- A type has no auto-import. Import it from the entry point, such as `import type { DialogRootProps } from '@vase-ui/vue/dialog'`.
- A component of your app wins over a component of Vase UI with the same name. Nuxt reads `<Dialog.Root>` as `DialogRoot`, so `components/dialog/Root.vue` wins over `Dialog.Root`. Use the option `prefix` to keep the two apart.

#### Options

Give the options in the key `vaseUi`:

```ts
export default defineNuxtConfig({
  modules: ['@vase-ui/vue/nuxt'],
  vaseUi: {
    prefix: 'Vase',
  },
});
```

| Option     | Default                      | Description                                                                                                                                                               |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prefix`   | `''`                         | A text before each name that the module adds. With `'Vase'`, a template uses `<VaseDialog.Root>` and `<VaseButton>`, and a script uses `VaseDialog` and `useVaseElement`. |
| `temporal` | `'temporal-polyfill/global'` | The module that sets the global `Temporal`. See [Temporal polyfill](#temporal-polyfill). `false` loads no module.                                                         |

#### Temporal polyfill

The date and time components need the global `Temporal`. See [Dates and times](/handbook/dates-and-times#polyfill). When your app has the package `temporal-polyfill`, the module loads `temporal-polyfill/global`:

- It loads the polyfill on the server and in the browser, before the app renders.
- It loads the polyfill only where the engine has no `Temporal`, such as Safari and Node.js 24.

For the calendars other than ISO and Gregorian, set `temporal` to `'temporal-polyfill/full/global'`. When your app does not have the module that `temporal` names, the module loads no polyfill.

Without the Nuxt module, load the polyfill in a plugin, as [Dates and times](/handbook/dates-and-times#polyfill) shows.

## Assemble a component

This sample imports the [Popover](/components/popover) component, assembles its parts and styles them. Vase UI ships no styles, so you can use plain CSS, CSS Modules, Tailwind CSS or another tool.

<DemoFrame>
  <PopoverExample />
</DemoFrame>

<<< ./examples/quick-start/PopoverExample.vue

## Next steps

The [handbook](/handbook/styling) shows how to style, animate and compose the components. Each component has its own page, such as the page of [Popover](/components/popover). [Releases](/releases) shows the state of each component against Base UI, and the changes of each release.
