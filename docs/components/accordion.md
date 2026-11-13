---
order: 1
description: An unstyled Vue accordion component that displays a set of collapsible panels with headings.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoAccordionHero from '../demos/accordion/hero/css-modules/index.vue';
import DemoAccordionHiddenUntilFound from '../demos/accordion/hidden-until-found/css-modules/index.vue';
import DemoAccordionMultiple from '../demos/accordion/multiple/css-modules/index.vue';
</script>

# Accordion

A set of collapsible panels with headings.

<DemoFrame>
  <DemoAccordionHero />
</DemoFrame>

::: code-group

<<< ../demos/accordion/hero/css-modules/index.vue

<<< ../demos/accordion/_index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./accordion/Anatomy.vue

## Examples

### Open multiple panels

Set the `multiple` prop to let the user open more than one panel at a time.

<DemoFrame>
  <DemoAccordionMultiple />
</DemoFrame>

::: code-group

<<< ../demos/accordion/multiple/css-modules/index.vue

<<< ../demos/accordion/_index.module.css

:::

### Hidden until found

The `hiddenUntilFound` prop hides the closed panels with [`hidden="until-found"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden). The find-in-page search of the browser can then search their contents and reveal the panel that has a match. Set the prop on each `<Accordion.Panel>`, or one time on `<Accordion.Root>` to apply it to all panels.

To try it, press <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>Cmd</kbd>+<kbd>F</kbd> on macOS) and search for "restocking". The browser opens the closed panel that has the match. With the prop, a closed panel always stays mounted in the DOM, so search engines can also index its contents.

A browser that does not support `hidden="until-found"` keeps each panel hidden until its trigger opens it, and find-in-page skips the contents.

<DemoFrame>
  <DemoAccordionHiddenUntilFound />
</DemoFrame>

::: code-group

<<< ../demos/accordion/hidden-until-found/css-modules/index.vue

<<< ../demos/accordion/_index.module.css

:::

## API reference

<ApiReference />
