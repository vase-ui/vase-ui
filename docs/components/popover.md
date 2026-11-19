---
order: 1
description: An unstyled Vue popover component that shows an accessible popup anchored to a button.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

## Examples

### Opening on hover

To open the popover when the pointer is on the trigger, set the `openOnHover` prop of `<Popover.Trigger>`.

The `delay` prop gives the time in milliseconds to wait before the popover opens on hover.

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

A trigger can be inside or outside `<Popover.Root>`. For a simple interaction, put `<Popover.Trigger>` inside `<Popover.Root>`, as the demo at the top of this page does.

If the content of the popover cannot be next to its trigger, use a detached trigger. Put `<Popover.Trigger>` outside `<Popover.Root>`, and connect the two with a handle from `Popover.createHandle()`.

The methods of the handle, `open()` and `close()`, need a mounted `<Popover.Root>` with the same handle. The handle ignores a call while no root uses it: before a root mounts, and after it unmounts. Each root that mounts starts with a new state. It does not replay an earlier call, and it does not keep the open state of an earlier root.

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

One popover can have more than one trigger. Give the same `handle` to more than one detached trigger, or put more than one `<Popover.Trigger>` in one `<Popover.Root>`.

<<< ./popover/MultipleTriggers.vue

<<< ./popover/MultipleDetachedTriggers.vue

The popover can show a different content for each trigger. Give a `payload` to each `<Popover.Trigger>`. The default slot of `<Popover.Root>` gets the `payload` of the active trigger.

The type argument of `createHandle()` gives the payload its type:

<<< ./popover/DetachedTriggersPayload.vue{4,8,12,16,22,23}

### Controlled mode with multiple triggers

To control the open state, use `v-model:open` on `<Popover.Root>`, or the `open` prop with the `openChange` event. With more than one trigger, control the active trigger with the `triggerId` prop of `<Popover.Root>` and the `id` prop of each `<Popover.Trigger>`.

The root has no event for a change of the trigger. The `openChange` event gives a second argument, `eventDetails`. Its `trigger` is the trigger element that started the change.

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

To animate the position, add CSS transitions for `left`, `right`, `top` and `bottom` to the Positioner part. To animate the size, add transitions for `width` and `height` to the Popup part.

#### Content

A popover can animate its content when each trigger has a different content.

Put the content in `<Popover.Viewport>`. Its `div` has the `data-activation-direction` attribute, which gives the position of the new trigger relative to the old trigger. The value has at most two tokens, one for each axis: `left` or `right`, and `up` or `down`, for example `right down`. Match one token with the `~=` attribute selector, such as `[data-activation-direction~='right']`.

In `<Popover.Viewport>`, a `div` holds each content. Use their attributes to style the animations:

- `data-current`: the content that shows when no transition runs, or the new content in a transition.
- `data-previous`: the old content in a transition.

Use `Popover.Viewport` only when one popup has more than one trigger, the content changes with the trigger, and the change is animated. With a viewport, set `width: var(--positioner-width)` and `height: var(--positioner-height)` on the Positioner. Its box then keeps the measured size during the transition. Without these styles, the size of the content can change the size of the popup in each frame, or move the popup to another side.

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

## Portal target

Set `to` on `Popover.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />

## createHandle

Creates a handle that connects a `<Popover.Root>` with detached `<Popover.Trigger>` parts. The type argument of the function is the type of the payload.

<ApiReference name="Popover.createHandle" :heading-level="3" />

### Handle

`Popover.createHandle()` returns a `Popover.Handle`. Give it to the `handle` prop of the root and of each trigger outside the root.

<ApiReference name="Popover.Handle" :heading-level="4" />

While a root is mounted, `open()` throws when the handle has no trigger with that `id`.
