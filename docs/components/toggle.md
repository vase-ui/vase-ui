---
order: 1
description: An unstyled Vue toggle component that displays a two-state button that can be on or off.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoToggleHero from '../demos/toggle/hero/css-modules/index.vue';
import DemoToggleHeroTailwind from '../demos/toggle/hero/tailwind/index.vue';
</script>

# Toggle

A two-state button that can be on or off.

<DemoFrame>
  <DemoToggleHero />
  <template #tailwind>
    <DemoToggleHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/toggle/hero/css-modules/index.vue

<<< ../demos/toggle/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/toggle/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and use it as a single part:

<<< ./toggle/Anatomy.vue

`Toggle` renders a `<button type="button">` with `aria-pressed`. Bind the pressed state with `v-model`, or give `defaultPressed` to an uncontrolled toggle. A press emits `pressedChange` and then `update:modelValue`. To keep the state, call `details.cancel()` in `pressedChange`.

## Styling

Select the states of a toggle with these selectors:

| Selector                 | State                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `[aria-pressed='true']`  | The toggle is pressed.                                                                       |
| `[aria-pressed='false']` | The toggle is not pressed.                                                                   |
| `:disabled`              | The toggle is disabled.                                                                      |
| `[aria-disabled='true']` | The toggle is disabled, and its element is not a `<button>` or keeps the focus in a toolbar. |
| `:focus-visible`         | The toggle has the focus from the keyboard.                                                  |

## Examples

### Rendering another element

Give a tag or a component to `as`. Or render the element in the `element` slot, and bind `props` and `elementRef` to it. The slot also gives `state`. An element that is not a `<button>` gets `role="button"`, a tab stop, and the keys Enter and Space.

## API reference

<ApiReference />
