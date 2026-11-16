---
order: 1
description: A direction provider component that enables RTL behavior for Vase UI components.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoDirectionProviderHero from '../demos/direction-provider/hero/css-modules/index.vue';
import DemoDirectionProviderHeroTailwind from '../demos/direction-provider/hero/tailwind/index.vue';
</script>

# Direction Provider

Enables RTL behavior for Vase UI components.

<DemoFrame>
  <DemoDirectionProviderHero />
  <template #tailwind>
    <DemoDirectionProviderHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/direction-provider/hero/css-modules/index.vue

<<< ../demos/direction-provider/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/direction-provider/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and wrap it around your app:

<<< ./direction-provider/Anatomy.vue

`<DirectionProvider>` lets the Vase UI components below it adjust their behavior to RTL text direction. It does not affect HTML and CSS. Your own code must also set the `dir="rtl"` HTML attribute or the `direction: rtl` CSS style.

## API reference

<ApiReference />

### useDirection

Use this composable to read the current text direction. It is useful for a portaled component that renders outside your application root. The `dir` attribute that you set inside the root does not affect such a component.

Call it in `setup`. It returns a `ComputedRef` of `'ltr'` or `'rtl'`. Read `.value` where you use the direction. When no `DirectionProvider` is above the component, it gives `'ltr'`.

<ApiReference name="useDirection" :heading-level="4" />
