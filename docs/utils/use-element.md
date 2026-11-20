---
order: 1
description: A composable that gives a component the native element that it renders, so that the component and a Vase UI part can be the element of each other.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoUseElementRender from '../demos/use-render/render/css-modules/index.vue';
import DemoUseElementRenderCallback from '../demos/use-render/render-callback/css-modules/index.vue';
</script>

# useElement

A composable that gives a component the native element that it renders.

## Examples

### Render another element

Use `useElement` to build a component in the form of a Vase UI part. The component renders its own element, or the element that a consumer renders in its `element` slot. Here a consumer renders a `strong` element in the `element` slot of a Text component:

<DemoFrame>
  <DemoUseElementRender />
</DemoFrame>

::: code-group

<<< ../demos/use-render/render/css-modules/index.vue

<<< ../demos/use-render/render/css-modules/Text.vue

<<< ../demos/use-render/render/css-modules/index.module.css

:::

- Bind `setElement` on the element with `:ref`, and give it to the `element` slot as `elementRef`.
- Expose `element`. A template ref of the consumer then reads the native element. The component can also be the element of a Vase UI part, and a part can be the element of the component.
- With `inheritAttrs: false`, merge the attributes of the consumer with the attributes of the component in `mergeProps` of Vue. The value of the consumer wins. `class` and `style` join, and each listener stays.
- `ElementSlotProps` of `@vase-ui/vue/types` types the scope of the `element` slot.

### Read the state

The `element` slot also gives the `state` of the component:

<DemoFrame>
  <DemoUseElementRenderCallback />
</DemoFrame>

::: code-group

<<< ../demos/use-render/render-callback/css-modules/index.vue

<<< ../demos/use-render/render-callback/css-modules/Counter.vue

<<< ../demos/use-render/render-callback/css-modules/index.module.css

:::

## API reference

<ApiReference />

### useElement

Gives the native element of a component, and the function ref that sets it.

<ApiReference name="useElement" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
