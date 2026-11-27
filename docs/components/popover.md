---
order: 1
description: An unstyled Vue popover component that shows an accessible popup anchored to a button.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoPopoverDetachedTriggersControlled from '../demos/popover/detached-triggers-controlled/css-modules/index.vue';
import DemoPopoverDetachedTriggersControlledTailwind from '../demos/popover/detached-triggers-controlled/tailwind/index.vue';
import DemoPopoverDetachedTriggersFull from '../demos/popover/detached-triggers-full/css-modules/index.vue';
import DemoPopoverDetachedTriggersFullTailwind from '../demos/popover/detached-triggers-full/tailwind/index.vue';
import DemoPopoverDetachedTriggersSimple from '../demos/popover/detached-triggers-simple/css-modules/index.vue';
import DemoPopoverDetachedTriggersSimpleTailwind from '../demos/popover/detached-triggers-simple/tailwind/index.vue';
import DemoPopoverHero from '../demos/popover/hero/css-modules/index.vue';
import DemoPopoverHeroTailwind from '../demos/popover/hero/tailwind/index.vue';
import DemoPopoverOpenOnHover from '../demos/popover/open-on-hover/css-modules/index.vue';
import DemoPopoverOpenOnHoverTailwind from '../demos/popover/open-on-hover/tailwind/index.vue';
</script>

# Popover

An accessible popup anchored to a button.

<DemoFrame>
  <DemoPopoverHero />
  <template #tailwind>
    <DemoPopoverHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/popover/hero/css-modules/index.vue

<<< ../demos/popover/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/popover/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./popover/Anatomy.vue

Give the `z-index` of the popup to `Popover.Positioner`: see [Portals](/quick-start#portals).

## Examples

### Opening on hover

To open the popover when the mouse rests on the trigger, set `openOnHover` on `Popover.Trigger`. The `delay` prop gives the time in milliseconds before the open.

<DemoFrame>
  <DemoPopoverOpenOnHover />
  <template #tailwind>
    <DemoPopoverOpenOnHoverTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/popover/open-on-hover/css-modules/index.vue

<<< ../demos/popover/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/popover/open-on-hover/tailwind/index.vue

:::

</DemoSource>

### Detached triggers

A trigger can be inside or outside `Popover.Root`. For a simple popover, put `Popover.Trigger` inside `Popover.Root`, as the demo at the top of this page does.

When the content of the popover cannot be next to its trigger, use a detached trigger. Put `Popover.Trigger` outside `Popover.Root`, and connect the two with a handle from `Popover.createHandle()`.

The methods `open()` and `close()` of the handle need a mounted `Popover.Root` with the same handle. The handle ignores a call while no root uses it: before a root mounts, and after it unmounts. Each root starts with a new state at its mount. It does not replay an earlier call, and it does not keep the open state of an earlier root.

<<< ./popover/DetachedTriggers.vue{4,8,10}

<DemoFrame>
  <DemoPopoverDetachedTriggersSimple />
  <template #tailwind>
    <DemoPopoverDetachedTriggersSimpleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/popover/detached-triggers-simple/css-modules/index.vue

<<< ../demos/popover/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/popover/detached-triggers-simple/tailwind/index.vue

:::

</DemoSource>

### Multiple triggers

One popover can have more than one trigger. Give the same `handle` to more than one detached trigger, or put more than one `Popover.Trigger` in one `Popover.Root`.

<<< ./popover/MultipleTriggers.vue

<<< ./popover/MultipleDetachedTriggers.vue

The popover can show different content for each trigger. Give a `payload` to each `Popover.Trigger`. The default slot of `Popover.Root` gets the `payload` of the active trigger. The type argument of `createHandle()` gives the payload its type:

<<< ./popover/DetachedTriggersPayload.vue{4,8,12,16,22,23}

### Controlled mode with multiple triggers

To control the open state, use `v-model:open` on `Popover.Root`, or the `open` prop and the `openChange` event. With more than one trigger, control the active trigger with `v-model:trigger-id` on `Popover.Root` and the `id` prop of each `Popover.Trigger`.

The second argument of `openChange` has `trigger`, the element of the trigger that started the change.

<DemoFrame>
  <DemoPopoverDetachedTriggersControlled />
  <template #tailwind>
    <DemoPopoverDetachedTriggersControlledTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/popover/detached-triggers-controlled/css-modules/index.vue

<<< ../demos/popover/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/popover/detached-triggers-controlled/tailwind/index.vue

:::

</DemoSource>

### Animating the Popover

A popover can animate its position, its size and its content when it moves from one trigger to another.

#### Position and size

To animate the position, give `Popover.Positioner` a CSS transition of `left`, `right`, `top` and `bottom`. To animate the size, give `Popover.Popup` a transition of `width` and `height`.

#### Content

To animate the content, put it in `Popover.Viewport`. The default slot of the viewport gets `triggerId`, the `id` of the active trigger. Put the content in a `<Transition>`, with `triggerId` as its `key`. At a move, the old content leaves while the new content enters. Select the old content with the leave classes, and the viewport while it has old content with `:has(> .x-leave-active)`.

The `data-activation-direction` attribute of the viewport gives the place of the new trigger from the old trigger. Its value has one or two tokens, one for each axis: `left` or `right`, and `up` or `down`, such as `right down`. Match one token with the `~=` selector, such as `[data-activation-direction~='right']`.

Use a viewport only when one popup has more than one trigger, and the content changes with an animation at a move to another trigger. With a viewport, give `Popover.Positioner` the styles `width: var(--positioner-width)` and `height: var(--positioner-height)`. The positioner then keeps the measured size during the transition. Without these styles, the size of the content can change the size of the popup in each frame, or move the popup to another side.

<DemoFrame>
  <DemoPopoverDetachedTriggersFull />
  <template #tailwind>
    <DemoPopoverDetachedTriggersFullTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/popover/detached-triggers-full/css-modules/index.vue

<<< ../demos/popover/detached-triggers-full/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/popover/detached-triggers-full/tailwind/index.vue

:::

</DemoSource>

## API reference

<ApiReference />

### createHandle

Makes a `Popover.Handle` with the type argument as the type of its payload.

<ApiReference name="Popover.createHandle" :heading-level="4" />

### Handle

A handle opens and closes the popover from code, and connects the triggers outside the root to it.

<ApiReference name="Popover.Handle" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
