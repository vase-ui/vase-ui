---
order: 1
description: An unstyled Vue slider component that works like a range input and is easy to style.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSliderEdgeAlignment from '../demos/slider/edge-alignment/css-modules/index.vue';
import DemoSliderHero from '../demos/slider/hero/css-modules/index.vue';
import DemoSliderMarks from '../demos/slider/marks/css-modules/index.vue';
import DemoSliderRangeSlider from '../demos/slider/range-slider/css-modules/index.vue';
import DemoSliderSteps from '../demos/slider/steps/css-modules/index.vue';
import DemoSliderVertical from '../demos/slider/vertical/css-modules/index.vue';
</script>

# Slider

An easily stylable range input.

<DemoFrame>
  <DemoSliderHero />
</DemoFrame>

::: code-group

<<< ../demos/slider/hero/css-modules/index.vue

<<< ../demos/slider/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Form controls must have an accessible name**: Use `Slider.Label`, or give each `Slider.Thumb` an `aria-label` when the slider has no visible label. See [Labeling a slider](#labeling-a-slider) and the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./slider/Anatomy.vue

Each `Slider.Thumb` renders an `<input type="range">` in its element. The inputs give the slider the form behavior of a native range input. A slider with a `name` submits the value of each thumb under that name. A disabled slider submits nothing.

A reset of the form puts an uncontrolled slider back to `defaultValue`, or to `min` when it has none. A controlled slider does not change. In a `Field`, a reset clears the error of the field. The reset starts no validation.

Bind the value with `v-model:value`. The root emits `valueChange` with the new value and `eventDetails`, and then `update:value`. To stop the change, call `eventDetails.cancel()` before the `valueChange` listener returns. The root then emits no `update:value` and keeps its value.

In the server HTML, the root already has the id of `Slider.Label` in `aria-labelledby`. So does the input of each thumb that has no name of its own from `aria-label`, `aria-labelledby` or `getAriaLabel`. The label can come before or after the control.

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

A thumb takes the index of its place among the thumbs, also in the server HTML. Set `index` on each thumb only when the thumbs do not render in the order of their values.

The `thumbCollisionBehavior` prop of `Slider.Root` sets what the thumbs do when they meet during a pointer drag.

<DemoFrame>
  <DemoSliderRangeSlider />
</DemoFrame>

::: code-group

<<< ../demos/slider/range-slider/css-modules/index.vue

<<< ../demos/slider/range-slider/css-modules/index.module.css

:::

### Steps

The `step` prop sets the increment of the value. The `largeStep` prop sets the increment of Page Up, Page Down, and an arrow key with Shift.

<DemoFrame>
  <DemoSliderSteps />
</DemoFrame>

::: code-group

<<< ../demos/slider/steps/css-modules/index.vue

<<< ../demos/slider/steps/css-modules/index.module.css

:::

### Marks

Render your own tick marks. Put each mark on the track at the percentage of its value in the range.

<DemoFrame>
  <DemoSliderMarks />
</DemoFrame>

::: code-group

<<< ../demos/slider/marks/css-modules/index.vue

<<< ../demos/slider/marks/css-modules/index.module.css

:::

The marks do not change the values that the thumb can have. To snap the thumb to each mark, set [`step`](#steps) to the distance between two marks.

### Thumb alignment

By default, the center of the thumb is on the edge of the control when the value is at `min` or `max`, so the thumb goes past the control. With `thumbAlignment="edge"`, the thumb stays in the control, and its edge is on the edge of the control.

With `edge`, the server HTML has an inline script that places the thumbs before the app starts. The script has the nonce of `CSPProvider`. With `edge-client-only`, the server HTML has no script, and each thumb stays hidden until the slider is mounted.

<DemoFrame>
  <DemoSliderEdgeAlignment />
</DemoFrame>

::: code-group

<<< ../demos/slider/edge-alignment/css-modules/index.vue

<<< ../demos/slider/edge-alignment/css-modules/index.module.css

:::

### Vertical

Set `orientation="vertical"` on `Slider.Root` to make a vertical slider.

<DemoFrame>
  <DemoSliderVertical />
</DemoFrame>

::: code-group

<<< ../demos/slider/vertical/css-modules/index.vue

<<< ../demos/slider/vertical/css-modules/index.module.css

:::

## API reference

<ApiReference />
