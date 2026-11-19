---
order: 1
description: An unstyled Vue tooltip component that appears when an element is hovered or focused, and shows a hint for sighted users.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoTooltipDetachedTriggersControlled from '../demos/tooltip/detached-triggers-controlled/css-modules/index.vue';
import DemoTooltipDetachedTriggersControlledTailwind from '../demos/tooltip/detached-triggers-controlled/tailwind/index.vue';
import DemoTooltipDetachedTriggersFull from '../demos/tooltip/detached-triggers-full/css-modules/index.vue';
import DemoTooltipDetachedTriggersFullTailwind from '../demos/tooltip/detached-triggers-full/tailwind/index.vue';
import DemoTooltipDetachedTriggersSimple from '../demos/tooltip/detached-triggers-simple/css-modules/index.vue';
import DemoTooltipDetachedTriggersSimpleTailwind from '../demos/tooltip/detached-triggers-simple/tailwind/index.vue';
import DemoTooltipHero from '../demos/tooltip/hero/css-modules/index.vue';
import DemoTooltipHeroTailwind from '../demos/tooltip/hero/tailwind/index.vue';
</script>

# Tooltip

A popup that appears when an element is hovered or focused, and shows a hint for sighted users.

<DemoFrame>
  <DemoTooltipHero />
  <template #tailwind>
    <DemoTooltipHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/tooltip/hero/css-modules/index.vue

<<< ../demos/tooltip/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/tooltip/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Use a tooltip only as a visual label**: A tooltip is a supplementary label for sighted users with a mouse or a keyboard. Touch users and screen reader users do not get it. See [Alternatives to tooltips](#alternatives-to-tooltips).
- **Give the trigger an accessible name**: A tooltip does not label its trigger. Give the trigger an `aria-label` that matches the text of the tooltip, so that a screen reader user gets the same information.

## Anatomy

Import the component and assemble its parts:

<<< ./tooltip/Anatomy.vue

## Alternatives to tooltips

A tooltip gives clarity that is not necessary in a dense interface. A user who never sees a tooltip must not miss important information.

A touch screen has no pointer that hovers. A touch user cannot find a tooltip before a tap on its trigger.

iOS has no standard tooltip gesture for touch. Android can show a tooltip on a long press, but on the web a long press usually opens the context menu of the browser. For this reason, a tooltip does not open for a touch pointer.

### Infotips

A popup that opens when the pointer is on an info icon is a popover, not a tooltip. Use [Popover](/components/popover) with `openOnHover` on its trigger, so that touch users and screen reader users can get the content.

Look at the purpose of the trigger. If the trigger only opens the popup, use a popover. If the trigger has a different purpose, use a tooltip.

### Description text

A tooltip is for sighted users. It does not give important information to touch users or to assistive technology. If the user must have the description to understand the element, show it as text on the page. If the space is small, use [Popover](/components/popover).

An icon trigger with no text label must show its purpose with its icon, because a mobile screen can hide the text label.

A tooltip can give extra clarity that is not necessary to sighted users with a mouse or a keyboard.

### Contextual feedback messages

To show a feedback message next to an element, use an [anchored toast](/components/toast#anchored-toasts). A screen reader then announces the message, and the message can hold complex content.

## Examples

### Detached triggers

A trigger can be inside or outside `<Tooltip.Root>`. For a simple tooltip, put `<Tooltip.Trigger>` inside `<Tooltip.Root>`, as the demo at the top of this page does.

If the content of the tooltip cannot be next to its trigger, use a detached trigger. Put `<Tooltip.Trigger>` outside `<Tooltip.Root>`, and connect the two with a handle from `Tooltip.createHandle()`.

The methods of the handle, `open()` and `close()`, need a mounted `<Tooltip.Root>` with the same handle. The handle ignores a call while no root uses it: before a root mounts, and after it unmounts. A development build then shows a warning. Each root that mounts starts with a new state. It does not replay an earlier call, and it does not keep the open state of an earlier root.

<<< ./tooltip/DetachedTriggers.vue{4,8,10}

<DemoFrame>
  <DemoTooltipDetachedTriggersSimple />
  <template #tailwind>
    <DemoTooltipDetachedTriggersSimpleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/tooltip/detached-triggers-simple/css-modules/index.vue

<<< ../demos/tooltip/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/tooltip/detached-triggers-simple/tailwind/index.vue

<<< ../demos/tooltip/icons-tw.ts

:::

</DemoSource>

### Multiple triggers

One tooltip can have more than one trigger. Give the same `handle` to more than one detached trigger, or put more than one `<Tooltip.Trigger>` in one `<Tooltip.Root>`.

<<< ./tooltip/MultipleTriggers.vue

<<< ./tooltip/MultipleDetachedTriggers.vue

The tooltip can show a different content for each trigger. Give a `payload` to each `<Tooltip.Trigger>`. The default slot of `<Tooltip.Root>` gets the `payload` of the active trigger.

The type argument of `createHandle()` gives the payload its type:

<<< ./tooltip/DetachedTriggersPayload.vue{4,8,12,16,21}

### Controlled mode with multiple triggers

To control the open state, use `v-model:open` on `<Tooltip.Root>`, or the `open` prop with the `openChange` event. With more than one trigger, control the active trigger with the `triggerId` prop of `<Tooltip.Root>` and the `id` prop of each `<Tooltip.Trigger>`.

The root has no event for a change of the trigger. The `openChange` event gives a second argument, `eventDetails`. Its `trigger` is the trigger element that started the change.

<DemoFrame>
  <DemoTooltipDetachedTriggersControlled />
  <template #tailwind>
    <DemoTooltipDetachedTriggersControlledTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/tooltip/detached-triggers-controlled/css-modules/index.vue

<<< ../demos/tooltip/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/tooltip/detached-triggers-controlled/tailwind/index.vue

<<< ../demos/tooltip/icons-tw.ts

:::

</DemoSource>

### Animating the Tooltip

A tooltip can animate its position, its size and its content when it moves from one trigger to another.

#### Position and size

To animate the position, add CSS transitions for `left`, `right`, `top` and `bottom` to the Positioner part. To animate the size, add transitions for `width` and `height` to the Popup part.

#### Content

A tooltip can animate its content when each trigger has a different content.

Put the content in `<Tooltip.Viewport>`. Its `div` has the `data-activation-direction` attribute, which gives the position of the new trigger relative to the old trigger. The value has at most two tokens, one for each axis: `left` or `right`, and `up` or `down`, for example `right down`. Match one token with the `~=` attribute selector, such as `[data-activation-direction~='right']`.

In `<Tooltip.Viewport>`, a `div` holds each content. Use their attributes to style the animations:

- `data-current`: the content that shows when no transition runs, or the new content in a transition.
- `data-previous`: the old content in a transition.

Use `Tooltip.Viewport` only when one popup has more than one trigger, the content changes with the trigger, and the change is animated. With a viewport, set `width: var(--positioner-width)` and `height: var(--positioner-height)` on the Positioner. Its box then keeps the measured size during the transition. Without these styles, the size of the content can change the size of the popup in each frame, or move the popup to another side.

<DemoFrame>
  <DemoTooltipDetachedTriggersFull />
  <template #tailwind>
    <DemoTooltipDetachedTriggersFullTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/tooltip/detached-triggers-full/css-modules/index.vue

<<< ../demos/tooltip/detached-triggers-full/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/tooltip/detached-triggers-full/tailwind/index.vue

<<< ../demos/tooltip/icons-tw.ts

:::

</DemoSource>

## Portal target

Set `to` on `Tooltip.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />

## createHandle

Creates a handle that connects a `<Tooltip.Root>` with detached `<Tooltip.Trigger>` parts. The type argument of the function is the type of the payload.

<ApiReference name="Tooltip.createHandle" :heading-level="3" />

### Handle

`Tooltip.createHandle()` returns a `Tooltip.Handle`. Give it to the `handle` prop of the root and of each trigger outside the root.

<ApiReference name="Tooltip.Handle" :heading-level="4" />

While a root is mounted, `open()` throws when the handle has no trigger with that `id`.
