---
order: 1
description: An unstyled Vue field component that provides labeling and validation for form controls.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoFieldHero from '../demos/field/hero/css-modules/index.vue';
import DemoFieldHeroTailwind from '../demos/field/hero/tailwind/index.vue';
</script>

# Field

A component that provides labeling and validation for form controls.

<DemoFrame>
  <DemoFieldHero />
  <template #tailwind>
    <DemoFieldHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/field/hero/css-modules/index.vue

<<< ../demos/field/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/field/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./field/Anatomy.vue

In the server HTML, `Field.Control` already has the id of the label in `aria-labelledby` and the ids of the messages in `aria-describedby`. The parts can be in any order. A screen reader can name the control before the page hydrates. `Field.Control` has the id of `Field.Error` in `aria-describedby` only while the error shows.

A native reset of the form puts an uncontrolled `Field.Control` back to its default value. The field then clears its error, and `data-filled` and `data-dirty` follow the new value. The reset starts no validation.

`Field.Root` exposes `validate()`. Call it through a template ref to validate the field.

Text that a visitor types, or that the browser fills, before the page hydrates stays in `Field.Control`. After the hydration, `Field.Control` emits `valueChange` and `update:value` with that text. When the visitor left the control before the page hydrated, the control then also gets `change`, `blur` and `focusout`.

Chromium can restore the form state of a page after its app is mounted, with no event. At the `pageshow` event, `Field.Control` takes a restored value as one `input` event, and it emits `valueChange` and `update:value`. A control that does not have the focus then also gets `change`, `blur` and `focusout`.

## API reference

<ApiReference />
