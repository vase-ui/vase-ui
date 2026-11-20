---
order: 1
description: A composable that gives a component the native element that it renders, so that the component and a Vase UI part can be the element of each other.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoUseElementRender from '../demos/use-render/render/css-modules/index.vue';
import DemoUseElementRenderCallback from '../demos/use-render/render-callback/css-modules/index.vue';
</script>

# useElement

A composable that gives a component the native element that it renders.

Use `useElement` and Vue to build a component in the form of a Vase UI part. It is the Vue form of `useRender` of Base UI.

## Build a component

The component renders its own element, or the element that a consumer renders in its `element` slot:

<<< ./use-element/Notice.vue

- Bind `setElement` on the element with `:ref`. Vapor mode ignores a `ref` in `v-bind`.
- `element` is that element. For a component in the slot, it is the `element` that the component exposes. It is `null` on a server, before the mount and after the unmount.
- Expose `element`. A template ref of the consumer then reads the native element.
- A Vase UI part exposes `element` too. The component can be the element of a part, and a part can be the element of the component.
- `inheritAttrs: false` keeps the attributes off the slot. `mergeProps` of Vue merges them with the attributes of the component, and the value of the consumer wins. It joins `class` and `style`, and keeps each listener.
- `ElementSlotProps` of `@vase-ui/vue/types` types the scope of the `element` slot.

## Examples

A consumer renders a `strong` element in the `element` slot of a Text component:

<DemoFrame>
  <DemoUseElementRender />
</DemoFrame>

::: code-group

<<< ../demos/use-render/render/css-modules/index.vue

<<< ../demos/use-render/render/css-modules/Text.vue

<<< ../demos/use-render/render/css-modules/index.module.css

:::

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

<ApiReference name="useElement" :heading-level="3" />
