---
order: 1
description: A locale provider component that gives the locale of the page to the Vase UI components below it.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
</script>

# Locale Provider

Gives a locale to the Vase UI parts below it.

## Anatomy

Import the component and wrap it around your app:

<<< ./locale-provider/Anatomy.vue

## Which locale a part uses

A part with a `locale` prop formats its text, or compares the text of its items, in the first locale of this list:

1. The `locale` prop of the part.
2. The locale of the nearest `LocaleProvider` above the part.
3. `en-US`.

<<< ./locale-provider/Order.vue

These parts are the roots of Meter, Progress, Slider, Number Field, Date Field, Time Field, Time Clock, Calendar, Range Calendar, Date Picker, Date Range Picker, Time Picker, Combobox and Autocomplete, and `Menu.FilterProvider`. `useFilter` of Combobox and Autocomplete uses the same list for its `locale` option.

A part never uses the locale of the browser, because a server cannot know that locale. The server HTML and the page in the browser thus have the same text, and the text does not change after the hydration. Give the locale of the page to the provider, so that the text has the language of the page.

A change of the `locale` prop of the provider reaches each part below it.

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
