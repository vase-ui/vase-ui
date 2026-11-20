---
order: 1
description: An unstyled Vue tooltip component that shows a hint for sighted users when the mouse rests on an element or the element gets the focus.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
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

A popup that shows a hint for sighted users when the mouse rests on an element or the element gets the focus.

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

- **Use a tooltip only as a visual label**: A tooltip is a supplementary visual label for sighted users with a mouse or a keyboard. Touch users and screen reader users do not get it.
- **Give the trigger an accessible name**: A tooltip does not label its trigger. Give the trigger an `aria-label` that matches the text of the tooltip, so that screen reader users get the same information.
- **Keep the popup in the DOM to describe the trigger**: The closed popup is not in the DOM. To describe the trigger with the tooltip, set `keepMounted` on `Tooltip.Portal`. Then give `Tooltip.Popup` `role="tooltip"` and an `id`, and give `Tooltip.Trigger` `aria-describedby` with that `id`.

## Anatomy

Import the component and assemble its parts:

<<< ./tooltip/Anatomy.vue

## Alternatives to tooltips

A tooltip gives clarity that is not necessary in a dense interface. A user who never sees a tooltip must not miss important information.

A tooltip does not work well with touch input. A touch screen has no pointer that hovers, so a touch user cannot find a tooltip before a tap on its trigger. iOS has no standard tooltip gesture for touch. Android can show a tooltip on a long press, but on the web a long press usually opens the context menu of the browser. For this reason, a touch opens no tooltip.

### Infotips

A popup that opens when the mouse rests on an info icon is a popover, not a tooltip. Use [Popover](/components/popover) with `openOnHover` on its trigger, so that touch users and screen reader users can get the content.

Look at the purpose of the trigger. If the trigger only opens the popup, use a popover. If the trigger has a different purpose, use a tooltip.

### Description text

A tooltip is for sighted users. It does not give important information to touch users or to assistive technology. If the user must have the description to understand the element, show it as text on the page. If the space is small, use [Popover](/components/popover).

An icon trigger with no text label must show its purpose with its icon, because a mobile screen can hide the text label. A tooltip can give extra clarity to sighted users with a mouse or a keyboard when the description is not important.

### Contextual feedback messages

To show a feedback message next to an element, use an [anchored toast](/components/toast#anchored-toasts). A screen reader then announces the message, and the message can hold complex content.

## Examples

### Detached triggers

A trigger can be inside or outside `Tooltip.Root`. For a simple tooltip, put `Tooltip.Trigger` inside `Tooltip.Root`, as the demo at the top of this page does.

When the content of the tooltip cannot be next to its trigger, use a detached trigger. Put `Tooltip.Trigger` outside `Tooltip.Root`, and connect the two with a handle from `Tooltip.createHandle()`.

The methods `open()` and `close()` of the handle need a mounted `Tooltip.Root` with the same handle. The handle ignores a call while no root uses it: before a root mounts, and after it unmounts. Each root starts with a new state at its mount. It does not replay an earlier call, and it does not keep the open state of an earlier root.

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

One tooltip can have more than one trigger. Give the same `handle` to more than one detached trigger, or put more than one `Tooltip.Trigger` in one `Tooltip.Root`.

<<< ./tooltip/MultipleTriggers.vue

<<< ./tooltip/MultipleDetachedTriggers.vue

The tooltip can show a different content for each trigger. Give a `payload` to each `Tooltip.Trigger`. The default slot of `Tooltip.Root` gets the `payload` of the active trigger. The type argument of `createHandle()` gives the payload its type:

<<< ./tooltip/DetachedTriggersPayload.vue{4,8,12,16,21}

### Controlled mode with multiple triggers

To control the open state, use `v-model:open` on `Tooltip.Root`, or the `open` prop and the `openChange` event. With more than one trigger, control the active trigger with `v-model:trigger-id` on `Tooltip.Root` and the `id` prop of each `Tooltip.Trigger`.

The second argument of `openChange` has `trigger`, the element of the trigger that started the change.

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

To animate the position, give `Tooltip.Positioner` a CSS transition of `left`, `right`, `top` and `bottom`. To animate the size, give `Tooltip.Popup` a transition of `width` and `height`.

#### Content

To animate the content, put it in `Tooltip.Viewport`. The default slot of the viewport gets `triggerId`, the `id` of the active trigger. Put the content in a `<Transition>`, with `triggerId` as its `key`. At a move, the old content leaves while the new content enters. Select the old content with the leave classes, and the viewport while it has old content with `:has(> .x-leave-active)`.

The `data-activation-direction` attribute of the viewport gives the place of the new trigger from the old trigger. Its value has one or two tokens, one for each axis: `left` or `right`, and `up` or `down`, such as `right down`. Match one token with the `~=` selector, such as `[data-activation-direction~='right']`.

Use a viewport only when one popup has more than one trigger, and an animation changes the content. With a viewport, give `Tooltip.Positioner` the styles `width: var(--positioner-width)` and `height: var(--positioner-height)`. The positioner then keeps the measured size during the transition. Without these styles, the size of the content can change the size of the popup in each frame, or move the popup to another side.

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

## API reference

<ApiReference />

### createHandle

Makes a `Tooltip.Handle` with the type argument as the type of its payload.

<ApiReference name="Tooltip.createHandle" :heading-level="4" />

### Handle

A handle opens and closes the tooltip from code, and connects the triggers outside the root to it.

<ApiReference name="Tooltip.Handle" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
