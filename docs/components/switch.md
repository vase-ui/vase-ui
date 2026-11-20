---
order: 1
description: An unstyled Vue switch component that shows whether a setting is on or off.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoSwitchHero from '../demos/switch/hero/css-modules/index.vue';
import DemoSwitchHeroTailwind from '../demos/switch/hero/tailwind/index.vue';
</script>

# Switch

A control that shows whether a setting is on or off.

<DemoFrame>
  <DemoSwitchHero />
  <template #tailwind>
    <DemoSwitchHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/switch/hero/css-modules/index.vue

<<< ../demos/switch/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/switch/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Give the switch a `<label>` element, or a `Field.Label` in a `Field`. See [Labeling a switch](#labeling-a-switch) and the [forms guide](/handbook/forms).

## Anatomy

Import the component:

<<< ./switch/Anatomy.vue

## Examples

### Labeling a switch

A `<label>` around the switch is the simplest pattern to label it:

<<< ./switch/EnclosingLabel.vue{6,9}

A `<label>` beside the switch names it with `for` and `id`:

<<< ./switch/SiblingLabel.vue{6,7}

### Show a thumb

Give the input `appearance: none`, and put an element of your own after it for the thumb. Select the thumb with `:checked + .thumb`:

<<< ./switch/ThumbBeside.vue

The `element` slot renders the input and gives its state. Render the thumb from `state.checked`:

<<< ./switch/ThumbInElementSlot.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
