---
order: 1
description: A utility to merge multiple sets of Vue props. It handles event handlers, class and style.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoMergePropsPreventBaseUiHandler from '../demos/merge-props/prevent-base-ui-handler/css-modules/index.vue';
</script>

# mergeProps

A utility to merge multiple sets of Vue props.

`mergeProps` merges sets of props, such as internal props and user props, into one object that you bind with `v-bind`. It behaves like `Object.assign`: the rightmost set wins. A few keys have special rules.

## How merging works

- For most keys, the value from the rightmost set wins. The exceptions are `class`, `style` and event handlers. This call returns `{ id: 'b', dir: 'ltr' }`:

  <<< ./merge-props/MergeRules.vue#rightmost{ts}

- `ref` is not merged. Only the rightmost `ref` is kept. In this call, only `refB` is used:

  <<< ./merge-props/MergeRules.vue#ref{ts}

- `class` values are joined, rightmost first. A value can be a string, an array or an object. In this call, `class` is `'b a'`:

  <<< ./merge-props/MergeRules.vue#class{ts}

- `style` values are merged, and the rightmost value of each property wins. A value can be a string, an array or an object.
- Event handlers are merged and run from right to left, with the rightmost handler first. A handler is a key such as `onClick`. In this call, `b` runs before `a`:

  <<< ./merge-props/MergeRules.vue#handlers{ts}

  - An array of handlers is one handler.
  - A falsy handler in a later set keeps the handler of an earlier set.
  - When the first argument is a DOM event, a handler can call `event.preventVaseUIHandler()`. The handlers to its left then do not run. This does not call `preventDefault()` or `stopPropagation()`.
  - When the first argument is not a DOM event, all handlers run.

### Preventing Vase UI's default behavior

When you use the `#render` slot, you bind `props` on your own element. To add listeners of your own to `props`, use `mergeProps`. Your handlers run first, and `event.preventVaseUIHandler()` stops the handlers of the part.

In this demo, a click does not change the Toggle while `locked` is `true`:

<DemoFrame>
  <DemoMergePropsPreventBaseUiHandler />
</DemoFrame>

::: code-group

<<< ../demos/merge-props/prevent-base-ui-handler/css-modules/index.vue

<<< ../demos/merge-props/prevent-base-ui-handler/css-modules/index.module.css

:::

## Passing a function instead of an object

Each argument can be a props object or a function. The function gets the props that are merged up to that point, from left to right. It returns a props object. Use it when you compute the next props from the props that are already merged.

The return value of the function replaces the props that are merged up to that point. To chain the event handlers of those props, call them in the function:

<<< ./merge-props/FunctionSet.vue#function{ts}

`event.preventVaseUIHandler()` does not stop a handler that such a function returns. That handler must read `event.vaseUIHandlerPrevented` and stop when it is `true`.

## API reference

### mergeProps

This function accepts up to 5 arguments. Each one is a props object or a function that returns a props object. To merge more than 5 sets of props, use `mergePropsN`.

The type argument is the tag of the element that gets the result: `mergeProps<'button'>`. With no type argument, the tag is `div`. The sets and the result then have only the attributes that each HTML element has.

<ApiReference name="mergeProps" />

### mergePropsN

This function accepts an array of props objects or functions that return props objects. It is slightly less efficient than `mergeProps`. Use it only to merge more than 5 sets of props.

<ApiReference name="mergePropsN" />
