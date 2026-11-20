---
order: 1
description: An unstyled Vue slider component that works like a range input and is easy to style.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

`Slider.Root` renders a `<div role="group">`. Each `Slider.Thumb` renders a `<div>` with an `<input type="range">` after its content. The input has the role `slider` and takes the focus. A part outside `Slider.Root` throws an error.

The input gets each `aria-*` attribute, `tabindex`, `autofocus`, and the `focus`, `blur` and `keydown` listeners of `Slider.Thumb`. The thumb element gets each other attribute. The `element` slot of `Slider.Thumb` also gives `inputProps` and `inputRef`. Render the input in your element, or in another place:

<<< ../examples/composition/ThumbElementSlot.vue{10-14}

Bind the value with `v-model`, or give `defaultValue` to an uncontrolled slider. An array makes a range slider. Each change of the user emits `valueChange` and then `update:modelValue`. A drag emits them at each move. To keep the value, call `details.cancel()` in `valueChange`. `valueCommitted` comes when the user ends an action that changed the value: at once for a key or an `input` event of an input, and at the end of a press.

The slider shows each value on the grid that starts at `min` and goes up by `step`. It shows a value of the parent at the nearest value of the grid, with no event.

A slider with a `name` gives its form one entry for each enabled thumb, as native range inputs do. A disabled slider gives no entry. A native reset of the form puts the slider back to its first value, and emits only `update:modelValue`. In a `Field`, a reset clears the error of the field.

### Keyboard

| Key                                         | Action                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| Arrow Up, Arrow Right                       | Moves the thumb one `step` up. In right-to-left text, Arrow Left does it.    |
| Arrow Down, Arrow Left                      | Moves the thumb one `step` down. In right-to-left text, Arrow Right does it. |
| Shift with an arrow key, Page Up, Page Down | Moves the thumb one `largeStep`, to the next value of the grid.              |
| Home, End                                   | Moves the thumb to `min`, or to the largest value of the grid.               |

In a range, a thumb stops at its neighbour, and `minStepsBetweenValues` keeps a distance between them. A key with Ctrl, Alt or Meta changes no value, so the browser keeps its shortcuts.

### Pointer

A press on the control moves the nearest thumb to the point, and a drag moves it with the pointer. `Slider.Control` has the inline style `touch-action: none`, so a touch drag does not scroll the page. To let the page scroll across a horizontal slider, give `Slider.Control` the style `touch-action: pan-y`.

## Styling

Each part has these attributes, and the slots give the same state:

| Selector                         | State                                                |
| -------------------------------- | ---------------------------------------------------- |
| `[data-orientation="vertical"]`  | The slider is vertical.                              |
| `[data-disabled]`                | The slider is disabled. On a thumb, also that thumb. |
| `[data-dragging]`                | A press on the control is on.                        |
| `[data-touched]`                 | The focus left the slider in a field.                |
| `[data-dirty]`                   | The value differs from the first value of the field. |
| `[data-valid]`, `[data-invalid]` | The field is valid or invalid.                       |

`:focus-within` matches each part around the input that has the focus. Select the thumb whose input shows a focus ring with `:has(:focus-visible)`. A press gives the input the focus with no ring. A key that changes the value, and a click on `Slider.Label`, show the ring. A browser without the `focusVisible` option of `focus()`, such as Chrome before 145 or Safari before 18.4, decides the ring itself after a press and after a click on the label.

## Direction and text

The slider reads the text direction of its element. For a right-to-left page that renders on a server, give `Slider.Root` the attribute `dir="rtl"`, so that the server HTML has each thumb at its place. On a page that changes its direction, bind `dir`.

`format` and `locale` give the text of `Slider.Value`, and `aria-valuetext` of each input when `format` is set. The default `locale` is `en-US` on the server and in the browser, so give the locale of the page.

## Examples

### Labeling a slider

A slider with one thumb and no visible label, such as a volume control, takes its name from `aria-label` on `Slider.Thumb`:

<<< ./slider/InvisibleLabel.vue{10}

`Slider.Label` gives the slider a visible label:

<<< ./slider/VisibleLabel.vue{7}

`Slider.Label` is a `<label>` for the input of the first thumb. A click on it gives that input the focus in each browser. The root and each input with no `aria-label` and no `aria-labelledby` have the id of the label in `aria-labelledby`. With no `Slider.Label`, they take the label of the field, else the legend of a `Fieldset.Root` around the slider. A range slider with a visible label also needs an `aria-label` on each `Slider.Thumb`, so that each thumb has a name of its own:

<<< ./slider/RangeLabels.vue{11-12}

### Range slider

To make a range slider, give `Slider.Root` an array of values. Render one `Slider.Thumb` for each value in the array.

A thumb takes the index of its place among the thumbs, also in the server HTML. Set `index` on each thumb only when the thumbs do not render in the order of their values.

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

By default, the center of the thumb is on the edge of the control when the value is at `min` or `max`, so the thumb goes past the control. With `thumbAlignment="edge"`, the thumb stays in the control, and its edge is on the edge of the control.

CSS places each thumb, also in the server HTML. After the mount, `Slider.Indicator` ends at the centre of each thumb.

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

## API reference

<ApiReference />
