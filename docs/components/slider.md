---
order: 1
description: An unstyled Vue slider component that works like a range input and is easy to style.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoSliderEdgeAlignment from '../demos/slider/edge-alignment/css-modules/index.vue';
import DemoSliderEdgeAlignmentTailwind from '../demos/slider/edge-alignment/tailwind/index.vue';
import DemoSliderHero from '../demos/slider/hero/css-modules/index.vue';
import DemoSliderHeroTailwind from '../demos/slider/hero/tailwind/index.vue';
import DemoSliderMarks from '../demos/slider/marks/css-modules/index.vue';
import DemoSliderMarksTailwind from '../demos/slider/marks/tailwind/index.vue';
import DemoSliderRangeSlider from '../demos/slider/range-slider/css-modules/index.vue';
import DemoSliderRangeSliderTailwind from '../demos/slider/range-slider/tailwind/index.vue';
import DemoSliderSteps from '../demos/slider/steps/css-modules/index.vue';
import DemoSliderStepsTailwind from '../demos/slider/steps/tailwind/index.vue';
import DemoSliderVertical from '../demos/slider/vertical/css-modules/index.vue';
import DemoSliderVerticalTailwind from '../demos/slider/vertical/tailwind/index.vue';
</script>

# Slider

An easily stylable range input.

<DemoFrame>
  <DemoSliderHero />
  <template #tailwind>
    <DemoSliderHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/slider/hero/css-modules/index.vue

<<< ../demos/slider/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/slider/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Use `Slider.Label`, or give each `Slider.Thumb` an `aria-label` when the slider has no visible label. See [Labeling a slider](#labeling-a-slider) and the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./slider/Anatomy.vue

## Examples

### Labeling a slider

A slider with one thumb and no visible label, such as a volume control, takes its name from `aria-label` on `Slider.Thumb`:

<<< ./slider/InvisibleLabel.vue{10}

`Slider.Label` gives the slider a visible label:

<<< ./slider/VisibleLabel.vue{7}

A range slider with a visible label also needs an `aria-label` on each `Slider.Thumb`, so that each thumb has a name of its own:

<<< ./slider/RangeLabels.vue{11-12}

### Range slider

To make a range slider, give `Slider.Root` an array of values. Render one `Slider.Thumb` for each value in the array.

The `thumbCollisionBehavior` prop of `Slider.Root` sets what the thumbs do when they meet during a pointer drag.

<DemoFrame>
  <DemoSliderRangeSlider />
  <template #tailwind>
    <DemoSliderRangeSliderTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/slider/range-slider/css-modules/index.vue

<<< ../demos/slider/range-slider/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/slider/range-slider/tailwind/index.vue

:::

</DemoSource>

### Steps

The `step` prop sets the increment of the value. The `largeStep` prop sets the increment of Page Up, Page Down, and an arrow key with Shift.

<DemoFrame>
  <DemoSliderSteps />
  <template #tailwind>
    <DemoSliderStepsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/slider/steps/css-modules/index.vue

<<< ../demos/slider/steps/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/slider/steps/tailwind/index.vue

:::

</DemoSource>

### Marks

Render your own tick marks. Put each mark on the track at the percentage of its value in the range.

<DemoFrame>
  <DemoSliderMarks />
  <template #tailwind>
    <DemoSliderMarksTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/slider/marks/css-modules/index.vue

<<< ../demos/slider/marks/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/slider/marks/tailwind/index.vue

:::

</DemoSource>

The marks do not change the values that the thumb can have. To snap the thumb to each mark, set [`step`](#steps) to the distance between two marks.

### Thumb alignment

By default, the centre of the thumb is on the edge of the control when the value is at `min` or `max`, so the thumb goes past the control. With `thumbAlignment="edge"`, the thumb stays in the control, and its edge is on the edge of the control.

<DemoFrame>
  <DemoSliderEdgeAlignment />
  <template #tailwind>
    <DemoSliderEdgeAlignmentTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/slider/edge-alignment/css-modules/index.vue

<<< ../demos/slider/edge-alignment/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/slider/edge-alignment/tailwind/index.vue

:::

</DemoSource>

### Vertical

Set `orientation="vertical"` on `Slider.Root` to make a vertical slider.

<DemoFrame>
  <DemoSliderVertical />
  <template #tailwind>
    <DemoSliderVerticalTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/slider/vertical/css-modules/index.vue

<<< ../demos/slider/vertical/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/slider/vertical/tailwind/index.vue

:::

</DemoSource>

### Render on the server

The slider reads the text direction of its element. On a right-to-left page that renders on a server, give `Slider.Root` the attribute `dir="rtl"`, so that the server HTML has each thumb at its place.

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
