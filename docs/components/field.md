---
order: 1
description: An unstyled Vue field component that gives a form control a label and validation.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoFieldHero from '../demos/field/hero/css-modules/index.vue';
import DemoFieldHeroTailwind from '../demos/field/hero/tailwind/index.vue';
</script>

# Field

A group of parts that gives a form control a label and validation.

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

Import the components and assemble their parts:

<<< ./field/Anatomy.vue

## Examples

### Show a message for one failure

The default slot of `Field.Root` gives the validity, the errors and the value of the field. Use them in the content of a `Field.Error`, so that the control names the message in `aria-describedby`:

<<< ./field/RootSlot.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
