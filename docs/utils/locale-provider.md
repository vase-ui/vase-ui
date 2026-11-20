---
order: 1
description: A locale provider component that gives the locale of the page to the Vase UI components below it.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
</script>

# Locale Provider

Gives a locale to the Vase UI components below it.

## Anatomy

Import the component and wrap it around your app:

<<< ./locale-provider/Anatomy.vue

`Meter`, `Progress` and `NumberField` format their text in this locale. Give the locale of the page, so that the text has the language of the page.

## Which locale a part uses

`Meter.Root`, `Progress.Root` and `NumberField.Root` use the first locale of this list:

1. The `locale` prop of the part.
2. The locale of the nearest `LocaleProvider` above the part.
3. `en-US`.

<<< ./locale-provider/Order.vue

These parts never use the locale of the browser, because a server cannot know that locale. The server HTML and the page in the browser thus have the same text, and the text does not change after the hydration.

A change of the `locale` prop of the provider formats the text of each part again.

## API reference

<ApiReference />
