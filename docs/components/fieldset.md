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

`Fieldset.Root` renders a `<fieldset>`, and `Fieldset.Legend` renders a `<div>`. The root names the group with `aria-labelledby` and the id of its first legend. The legend thus names the group also in a wrapper, and when the `element` slot of the root renders another element. The server HTML has this name. An `aria-label` or `aria-labelledby` that you give to `Fieldset.Root` replaces it.

The legend also names a group in the root that nothing else names, such as a `RadioGroup`. When the `element` slot of the root renders a `RadioGroup`, a `CheckboxGroup` or a `Slider.Root`, that group gets the name of the legend. When the slot renders a `<div>`, give the `<div>` `role="group"`, because a `<div>` with no role takes no name.

To render a native `<legend>`, put it in the `element` slot of `Fieldset.Legend`:

<<< ./fieldset/NativeLegend.vue

`Fieldset.Root` with `disabled`, or a native `<fieldset disabled>`, disables each Vase UI form part in it, as the `disabled` prop of the part does. A disabled `Fieldset.Root` also disables the parts in `Fieldset.Legend`, because the legend is a `<div>`. A part in the first `<legend>` of a fieldset is enabled after the mount, as in HTML, also when the `element` slot of `Fieldset.Legend` renders that `<legend>`. `Form` leaves out the value of each field that a fieldset disables. A part reads a native fieldset after the mount. A disabled `Fieldset.Root` disables its parts also in the server HTML, and also when the `element` slot renders another element than a `<fieldset>`.

A disabled fieldset also disables these native button parts: `Button`, `Toggle`, and the triggers of Accordion and Collapsible. It disables the native button triggers of Dialog, Alert Dialog, Drawer, Menu, Popover, Date Picker, Date Range Picker, Time Picker, Navigation Menu and Tooltip too. Each has the `disabled` slot state. `Button`, `Toggle`, `Popover.Trigger` and the triggers of the pickers match `:disabled`, and each other part shows `data-disabled`. A disabled trigger cannot open its popup on hover. The browser disables a `Tabs.Tab` in a disabled fieldset, and `:disabled` matches it. Its panel stays open. A fieldset does not disable a `Button`, a `Toggle`, a `Popover.Trigger` or a trigger of a picker whose element is not a native button, or a part with `:native-button="false"`.

For `Tooltip.Trigger`, the fieldset rule applies when its element is a native button, also through `as` or `#render`. With `#render` or a component in `as`, the part reads its element after the mount, so the server HTML shows it enabled also in `Fieldset.Root`. Its `disabled` prop still suppresses only the tooltip; `data-trigger-disabled` marks that state.

## Styling

Select a disabled fieldset with `:disabled`, and its legend with `.Fieldset:disabled .Legend`. A root that the `element` slot renders as another element has `data-disabled`, so select its legend with `[data-disabled] .Legend`. A disabled `RadioGroup` has `aria-disabled="true"`, so select its legend with `[aria-disabled="true"] .Legend`.

## API reference

<ApiReference />
