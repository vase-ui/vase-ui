---
order: 1
description: An unstyled Vue input component that works with Field.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoInputHero from '../demos/input/hero/css-modules/index.vue';
import DemoInputHeroTailwind from '../demos/input/hero/tailwind/index.vue';
</script>

# Input

A native input element that works with [Field](/components/field).

<DemoFrame>
  <DemoInputHero />
  <template #tailwind>
    <DemoInputHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/input/hero/css-modules/index.vue

<<< ../demos/input/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/input/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Give the input a `<label>` element, or put it in a `Field`. See the [forms guide](/handbook/forms).

## Anatomy

Import the component and use it as a single part:

<<< ./input/Anatomy.vue

Text that a visitor types, or that the browser fills, before the page hydrates stays in the input. After the hydration, `Input` emits `valueChange` and `update:modelValue` with that text. When the visitor left the input before the page hydrated, the input then also gets `change`, `blur` and `focusout`.

Chromium can restore the form state of a page after its app is mounted, with no event. At the `pageshow` event, `Input` takes a restored value as one `input` event, and it emits `valueChange` and `update:modelValue`. An input that does not have the focus then also gets `change`, `blur` and `focusout`. An input that `KeepAlive` holds at that event takes the value when `KeepAlive` shows it again.

## API reference

<ApiReference />
