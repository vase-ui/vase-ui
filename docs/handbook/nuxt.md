---
order: 10
description: A guide to the Nuxt module of Vase UI.
---

# Nuxt

A guide to the Nuxt module of Vase UI.

## Add the module

The package has a Nuxt module for Nuxt 4. Add it to `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@vase-ui/vue/nuxt'],
});
```

The module is optional. Without it, import each component from its entry point, such as `@vase-ui/vue/dialog`, as in a Vue app.

## Components with no import

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
- A component of your app wins over a component of Vase UI with the same name. Nuxt reads `<Dialog.Root>` as `DialogRoot`, so `components/dialog/Root.vue` wins over `Dialog.Root`. Use the option `prefix` to keep the two apart.

## Options

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

## Temporal polyfill

The date and time components need the global `Temporal`. See [Dates and times](/handbook/dates-and-times#polyfill). When your app has the package `temporal-polyfill`, the module loads `temporal-polyfill/global`:

- It loads the polyfill on the server and in the browser, before the app renders.
- It loads the polyfill only where the engine has no `Temporal`, such as Safari and Node.js 24.

For the calendars other than ISO and Gregorian, set `temporal` to `'temporal-polyfill/full/global'`. When your app does not have the module that `temporal` names, the module loads no polyfill.
