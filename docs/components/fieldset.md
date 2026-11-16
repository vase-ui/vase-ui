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

`Fieldset.Root` with `disabled`, or a native `<fieldset disabled>`, disables each Vase UI form part in it, as the `disabled` prop of the part does. A part in the first `<legend>` of a native fieldset stays enabled, as in HTML. `Form` leaves out the value of each field that a fieldset disables. The parts read a native fieldset after the mount, so the server HTML shows them enabled.

A disabled fieldset also disables these native button parts: `Button`, `Toggle`, `Tabs.Tab`, and the triggers of Accordion and Collapsible. It disables the native button triggers of Dialog, Alert Dialog, Drawer, Menu, Popover, Navigation Menu and Tooltip too. Each shows `data-disabled` and the `disabled` slot state. A disabled trigger cannot open its popup on hover. The selected tab panel stays visible. A fieldset does not disable a part with `:native-button="false"`.

For `Tooltip.Trigger`, the fieldset rule applies when its element is a native button, also through `as` or `#render`. With `#render` or a component in `as`, the part reads its element after the mount, so the server HTML shows it enabled also in `Fieldset.Root`. Its `disabled` prop still suppresses only the tooltip; `data-trigger-disabled` marks that state.

## API reference

<ApiReference />
