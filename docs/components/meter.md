---
order: 1
description: An unstyled Vue meter component that provides a graphical display of a numeric value.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoMeterHero from '../demos/meter/hero/css-modules/index.vue';
import DemoMeterHeroTailwind from '../demos/meter/hero/tailwind/index.vue';
</script>

# Meter

A graphical display of a numeric value within a range.

<DemoFrame>
  <DemoMeterHero />
  <template #tailwind>
    <DemoMeterHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/meter/hero/css-modules/index.vue

<<< ../demos/meter/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/meter/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./meter/Anatomy.vue

`Meter.Label` names the meter, also in the server HTML. A label with an `id` prop names the meter from the mount on. To name the meter in the server HTML too, give `Meter.Root` an `aria-labelledby` with that id. Give the label its `id` with the `id` prop. An `id` in the `element` slot of the label does not name the meter. A meter with no `Meter.Label` needs an `aria-label` or an `aria-labelledby`. Such an attribute names the meter also when it has a `Meter.Label`. Use one `Meter.Label` in each meter.

The default element of `Meter.Root` holds a visually hidden text after its content, because NVDA and JAWS can need text in a meter to say its name. When the `element` slot replaces the element, put text in your element. A `Meter.Label` is such text.

The default `locale` is `en-US`, on the server and in the browser. Give `locale` the locale of the page, so that the text of the value has the language of the page.

## API reference

<ApiReference />
