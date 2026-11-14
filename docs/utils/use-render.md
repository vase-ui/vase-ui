---
order: 1
description: A composable that gives a component the as prop and the render slot of a Vase UI part.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoUseRenderRender from '../demos/use-render/render/css-modules/index.vue';
import DemoUseRenderRenderCallback from '../demos/use-render/render-callback/css-modules/index.vue';
</script>

# useRender

A composable that gives a component the `as` prop and the `#render` slot of a Vase UI part.

Use `useRender` to build custom components. A consumer sets `as`, or fills `#render`, to replace the default element.

## Examples

The `as` prop of a custom Text component lets a consumer replace the default `p` element. The consumer sets another tag or component.

<DemoFrame>
  <DemoUseRenderRender />
</DemoFrame>

::: code-group

<<< ../demos/use-render/render/css-modules/index.vue

<<< ../demos/use-render/render/css-modules/Text.vue

<<< ../demos/use-render/render/css-modules/index.module.css

:::

The `#render` slot gives more control over how the props go to the element. It also gives the internal `state` of the component.

<DemoFrame>
  <DemoUseRenderRenderCallback />
</DemoFrame>

::: code-group

<<< ../demos/use-render/render-callback/css-modules/index.vue

<<< ../demos/use-render/render-callback/css-modules/Counter.vue

<<< ../demos/use-render/render-callback/css-modules/index.module.css

:::

A component that calls `useRender` sets `inheritAttrs: false`. It passes its props object to `useRender` and does not destructure it. It exposes `element` with `defineExpose`. Its template has the two lines of the demos above.

## Merging props

The `mergeProps` function merges two or more sets of Vue props. Event handlers, `class` values and `style` values have rules of their own. For the other keys, a later set overwrites an earlier set. See [mergeProps](/utils/merge-props) for the rules. Merging props is useful when you create custom components. It is also useful in the `#render` slot of any Vase UI part.

In this sample, `mergeProps` adds a class to the `props` that the `#render` slot of Button gives:

<<< ./use-render/MergingProps.vue

The `props` parameter of `useRender` also merges its sets. The function that you give to it returns one set or an array of sets. `useRender` merges them with the same rules.

## Merging refs

When you build a custom component, you often need the element inside the component, and the consumer needs it too. The `ref` parameter of `useRender` takes a callback, or an array of callbacks. Each callback gets the element, and it gets `null` when the element goes away.

The component also exposes `element`. A consumer reads it through a template ref.

<<< ./use-render/MergingRefs.vue{16,20-22}

## TypeScript

Three types are for the props and the slot of a component:

- `useRender.ComponentProps<State>` types the external (public) props of a component: `as`, `stateClass` and `stateStyle`. `State` is the state that `stateClass` and `stateStyle` get.
- `useRender.ElementProps<'button'>` types the native attributes and listeners of a tag. Extend it behind `/* @vue-ignore */`. The SFC compiler then makes no props of them, and they stay in `$attrs`.
- `useRender.RenderProp<State>` types the `#render` slot. Use it in `defineSlots`.

In `defineProps`, the flat names `UseRenderComponentProps` and `UseRenderElementProps` name the same types.

<<< ./use-render/TypingProps.vue{4-5,18,21}

## Migrating from asChild

Some libraries give a component an `asChild` prop. The component then renders its child in place of its own element. Vase UI has no `asChild` prop. Use the `as` prop to set a tag or a component. Use the `#render` slot to bind `props` on your own element. The [composition guide](/handbook/composition) has more on both.

`useRender` lets you build a component that has both:

<<< ./use-render/ActionButton.vue

Then use the `#render` slot to render your own element:

<<< ./use-render/ActionButtonUsage.vue

## as, #render and polymorphism

The `#render` slot is mainly for composing event handlers and behavioral props. In most cases, the element has the same tag as the default element.

To render a different tag with the `as` prop or the `#render` slot, take more care. Some default props are not valid on the new element. For example, `type="button"` is valid only on a `<button>`. `useRender` gives `type="button"` to a default `button` tag and `alt=""` to a default `img` tag. A different tag does not get them.

A part cannot know which element the `as` prop or the `#render` slot gives. [Button](/components/button) has the `nativeButton` prop to tell it which defaults to apply.

## API reference

### useRender

<<< ./use-render/Usage.vue#usage{ts}

<ApiReference name="useRender" />

### useRender.ComponentProps

The props that a component declares for `useRender`.

<ApiReference name="useRender.ComponentProps" />

### useRender.Parameters

The second parameter of `useRender`.

<ApiReference name="useRender.Parameters" />

### useRender.ReturnValue

The value that `useRender` returns.

<ApiReference name="useRender.ReturnValue" />
