---
order: 1
description: An unstyled Vue accordion component that displays a set of collapsible panels with headings.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoAccordionHero from '../demos/accordion/hero/css-modules/index.vue';
import DemoAccordionHeroTailwind from '../demos/accordion/hero/tailwind/index.vue';
import DemoAccordionHiddenUntilFound from '../demos/accordion/hidden-until-found/css-modules/index.vue';
import DemoAccordionHiddenUntilFoundTailwind from '../demos/accordion/hidden-until-found/tailwind/index.vue';
import DemoAccordionMultiple from '../demos/accordion/multiple/css-modules/index.vue';
import DemoAccordionMultipleTailwind from '../demos/accordion/multiple/tailwind/index.vue';
</script>

# Accordion

A set of collapsible panels with headings.

<DemoFrame>
  <DemoAccordionHero />
  <template #tailwind>
    <DemoAccordionHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/accordion/hero/css-modules/index.vue

<<< ../demos/accordion/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/accordion/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./accordion/Anatomy.vue

## Examples

### Open multiple panels

Set the `multiple` prop to let the user open more than one panel at a time.

<DemoFrame>
  <DemoAccordionMultiple />
  <template #tailwind>
    <DemoAccordionMultipleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/accordion/multiple/css-modules/index.vue

<<< ../demos/accordion/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/accordion/multiple/tailwind/index.vue

:::

</DemoSource>

### Hidden until found

The `hiddenUntilFound` prop hides the closed panels with [`hidden="until-found"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden). The find-in-page search of the browser can then search their contents and open the panel that has a match. Set the prop on each `<Accordion.Panel>`, or one time on `<Accordion.Root>` for all panels.

To try it, press <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>Cmd</kbd>+<kbd>F</kbd> on macOS) and search for "restocking". The browser opens the closed panel that has the match. With the prop, a closed panel always stays in the DOM, so search engines can also index its contents.

A browser that does not support `hidden="until-found"` keeps the panels hidden until their trigger opens them, and find-in-page skips the contents. The panels of this demo have no `<Transition>` and no size transition. The [Collapsible page](/components/collapsible#hidden-until-found) gives the reasons.

<DemoFrame>
  <DemoAccordionHiddenUntilFound />
  <template #tailwind>
    <DemoAccordionHiddenUntilFoundTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/accordion/hidden-until-found/css-modules/index.vue

<<< ../demos/accordion/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/accordion/hidden-until-found/tailwind/index.vue

:::

</DemoSource>

### Animate the panels

Put each panel in a `<Transition>`, as the demo at the top of this page does. Before each open and each close, a panel writes the size of its content in the CSS variables `--accordion-panel-height` and `--accordion-panel-width`. The [Collapsible page](/components/collapsible#animate-the-panel) shows the classes. When one item opens and another closes, one panel leaves while the other enters.

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
