---
order: 1
description: An unstyled Vue toggle group component that provides shared state to a series of toggle buttons.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoToggleGroupHero from '../demos/toggle-group/hero/css-modules/index.vue';
import DemoToggleGroupHeroTailwind from '../demos/toggle-group/hero/tailwind/index.vue';
import DemoToggleGroupMultiple from '../demos/toggle-group/multiple/css-modules/index.vue';
import DemoToggleGroupMultipleTailwind from '../demos/toggle-group/multiple/tailwind/index.vue';
</script>

# Toggle Group

Provides a shared state to a series of toggle buttons.

<DemoFrame>
  <DemoToggleGroupHero />
  <template #tailwind>
    <DemoToggleGroupHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/toggle-group/hero/css-modules/index.vue

<<< ../demos/toggle-group/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/toggle-group/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and use it as a single part:

<<< ./toggle-group/Anatomy.vue

`ToggleGroup` renders a `<div role="group">`, and each `Toggle` in it renders a `<button>`. Bind the values of the pressed toggles with `v-model`, or give `defaultValue` to an uncontrolled group. The value is always an array. A press emits `valueChange` and then `update:modelValue`. To keep the value, call `details.cancel()` in `valueChange`.

Give each toggle a `value` when the group has a model. A toggle with no `value` gets a value of its own.

The group is one tab stop: the toggle that had the focus last, or else the first enabled toggle. In a toolbar, the toolbar holds the tab stop and the keys.

| Key                      | Action                                                                            |
| ------------------------ | --------------------------------------------------------------------------------- |
| ArrowRight and ArrowLeft | In a horizontal group, move the focus to the next or the previous enabled toggle. |
| ArrowDown and ArrowUp    | In a vertical group, move the focus to the next or the previous enabled toggle.   |
| Home and End             | Move the focus to the first or the last enabled toggle.                           |
| Enter and Space          | Press the toggle that has the focus.                                              |

With right-to-left text, ArrowLeft moves to the next toggle of a horizontal group. The arrow keys go from the last toggle to the first, unless `loopFocus` is `false`.

## Styling

The group has `data-orientation` with its orientation, and `data-disabled` while it is disabled. Select the states of a toggle with `[aria-pressed='true']` and `:disabled`, as on [Toggle](/components/toggle#styling).

## Examples

### Multiple

Set the `multiple` prop to let the user press more than one toggle at a time.

<DemoFrame>
  <DemoToggleGroupMultiple />
  <template #tailwind>
    <DemoToggleGroupMultipleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/toggle-group/multiple/css-modules/index.vue

<<< ../demos/toggle-group/multiple/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/toggle-group/multiple/tailwind/index.vue

:::

</DemoSource>

## API reference

<ApiReference />
