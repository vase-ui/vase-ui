---
order: 1
description: An unstyled Vue accordion component that displays a set of collapsible panels with headings.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

### Animate the panels

Put each panel in a `<Transition>`, as the demo above does. Before each open and each close, a panel writes the size of its content in the CSS variables `--accordion-panel-height` and `--accordion-panel-width`. The [Collapsible page](/components/collapsible#animate-the-panel) shows the classes. When one item opens and another closes, one panel leaves while the other enters.

With `keepMounted` on the root or on a panel, a closed panel stays in the DOM with `hidden` and `inert`. Animate a kept panel with CSS on `[hidden]`.

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

The `hiddenUntilFound` prop hides the closed panels with [`hidden="until-found"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden). The find-in-page search of the browser can then search their contents and open the panel that has a match. Set the prop on each `<Accordion.Panel>`, or one time on `<Accordion.Root>` to apply it to all panels.

To try it, press <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>Cmd</kbd>+<kbd>F</kbd> on macOS) and search for "restocking". The browser opens the closed panel that has the match. With the prop, a closed panel always stays mounted in the DOM, so search engines can also index its contents.

The panels of this demo have no `<Transition>` and no size transition. The [Collapsible page](/components/collapsible#hidden-until-found) gives the reasons, and what a browser without the feature and an earlier Vue do.

In a [wrapper of `Accordion.Panel`](/handbook/composition#wrap-a-part), give `keepMounted` and `hiddenUntilFound` the default `undefined` to keep the root values.

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

### Headings and regions

`Accordion.Header` renders an `<h3>`. Give it another level with `as`, such as `<Accordion.Header as="h2">`, or render your own heading in its `element` slot.

Each panel has `role="region"`, with the name of its trigger. The WAI-ARIA Authoring Practices say to avoid the role with more than about six panels that can be open at one time. Give such panels another `role`, such as `role="group"`. The `role` of the developer wins.

An item has no index. Use the index of your `v-for`, or `:nth-child()` in CSS.

## API reference

<ApiReference />
