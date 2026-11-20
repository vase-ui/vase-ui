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

`Fieldset.Root` renders a `<fieldset>`, and `Fieldset.Legend` renders a `<legend>`. HTML takes the first `<legend>` of a fieldset as its name. The id of the legend also names a group in the root that nothing else names, such as a `RadioGroup`.

`Fieldset.Root` with `disabled`, or a native `<fieldset disabled>`, disables each Vase UI form part in it, as the `disabled` prop of the part does. A part in the first `<legend>` of a native fieldset stays enabled, as in HTML. `Form` leaves out the value of each field that a fieldset disables. A part reads a native fieldset after the mount. A disabled `Fieldset.Root` disables its parts also in the server HTML, and also when the `element` slot renders another element than a `<fieldset>`.

A disabled fieldset also disables these native button parts: `Button`, `Toggle`, and the triggers of Accordion and Collapsible. It disables the native button triggers of Dialog, Alert Dialog, Drawer, Menu, Popover, Date Picker, Date Range Picker, Time Picker, Navigation Menu and Tooltip too. Each has the `disabled` slot state. `Button` and the triggers of Accordion and Collapsible match `:disabled`, and each other part shows `data-disabled`. A disabled trigger cannot open its popup on hover. The browser disables a `Tabs.Tab` in a disabled fieldset, and `:disabled` matches it. Its panel stays open. A fieldset does not disable a `Button` or a trigger of Accordion or Collapsible whose element is not a native button, or a part with `:native-button="false"`.

For `Tooltip.Trigger`, the fieldset rule applies when its element is a native button, also through `as` or `#render`. With `#render` or a component in `as`, the part reads its element after the mount, so the server HTML shows it enabled also in `Fieldset.Root`. Its `disabled` prop still suppresses only the tooltip; `data-trigger-disabled` marks that state.

## Styling

Select a disabled fieldset with `:disabled`, and its legend with `fieldset:disabled > legend`. A root that the `element` slot renders as another element has `data-disabled`.

## API reference

<ApiReference />
