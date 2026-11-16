---
order: 1
description: An unstyled Vue fieldset component with an easily stylable legend.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoFieldsetHero from '../demos/fieldset/hero/css-modules/index.vue';
import DemoFieldsetHeroTailwind from '../demos/fieldset/hero/tailwind/index.vue';
</script>

# Fieldset

A native fieldset element with an easily stylable legend.

<DemoFrame>
  <DemoFieldsetHero />
  <template #tailwind>
    <DemoFieldsetHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/fieldset/hero/css-modules/index.vue

<<< ../demos/fieldset/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/fieldset/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./fieldset/Anatomy.vue

In the server HTML, a root with no `aria-label` has the id of `Fieldset.Legend` in `aria-labelledby`, when the legend has no `id` prop. The `id` prop of a legend is in the `aria-labelledby` of the root only after the root is mounted. To have it in the server HTML too, give the root an `aria-labelledby` with that id. Until the root is mounted, a root with no `Fieldset.Legend` and no `aria-label` has an `aria-labelledby` with an id that no element has. A page with no client code never mounts the root, so the attribute stays. The attribute gives the root no name, and a native `<legend>` in the root still names it. Give such a root an `aria-label`, and the server HTML has no `aria-labelledby`.

## API reference

<ApiReference />
