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
- **Describe a control only with content that stays**: The popup is not in the DOM while the tooltip is closed. To describe the trigger with the tooltip, set `keepMounted` on `Tooltip.Portal`, give the `Tooltip.Popup` `role="tooltip"` and an `id`, and give the `Tooltip.Trigger` `aria-describedby` with that `id`.

## Anatomy

Import the component and assemble its parts:

<<< ./tooltip/Anatomy.vue

## Animation

The popup is in the DOM only while the tooltip is open. Put it in a `<Transition appear>`, and animate it with the classes of `<Transition>`. The portal renders its content at the open, so `<Transition>` needs `appear` to run the enter of the first open.

The popup has `data-instant` when an animation should not run. Give `[data-instant]` the style `transition: none` or `animation: none`. The tooltips of one `Tooltip.Provider` are one group, and the tooltips with no provider are another group. One tooltip of a group is open at a time. A tooltip that opens while another tooltip of its group was open has `delay`, and so has the tooltip that it closes.

With `keepMounted` on `Tooltip.Portal`, the closed popup stays in the DOM with `hidden` and `inert`. Vue then runs no transition, so animate the popup with CSS on `[hidden]`.

To keep the popup in the DOM until an animation of JavaScript ends, use the JavaScript hooks of `<Transition>`. With `:css="false"`, Vue removes the element when the `leave` hook calls `done`. Use `@after-enter` and `@after-leave` for code that runs after an animation.

## Opening and closing

A mouse that rests on the trigger opens the tooltip after `delay`, 600 ms by default. The focus of a key opens it at once, and a press does not. The tooltip closes when the pointer leaves the trigger and the popup, when the focus leaves the trigger, at Escape, and at a press outside. A press on the trigger closes the tooltip, unless the trigger has `closeOnClick` set to `false`. A touch opens no tooltip.

A trigger in another trigger opens only its own tooltip.

### Disabled controls

The tooltip of a disabled control opens at a hover, so it can say why the control is disabled. A `<button disabled>` and a button in a disabled fieldset get the events of a hover.

The `disabled` prop of `Tooltip.Trigger` stops the tooltip of that trigger, and the `disabled` prop of `Tooltip.Root` stops each trigger of the tooltip. The element of the trigger stays in use.

### With other parts

To give a tooltip to the trigger of another part, such as `Popover.Trigger`, `Menu.Trigger` or `Toolbar.Button`, render that part in the `element` slot of `Tooltip.Trigger`. Bind the `props` and the `elementRef` of the slot to it. The part then keeps its own role, type and `disabled` state.

## Styling

Select the states of the parts with these selectors:

| Selector                      | On                       | State                                                                                                                                                 |
| ----------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[data-popup-open]`           | trigger                  | The tooltip is open for this trigger.                                                                                                                 |
| `[data-trigger-disabled]`     | trigger                  | The tooltip does not open from this trigger.                                                                                                          |
| `[data-side]`, `[data-align]` | positioner, popup, arrow | The side of the anchor and the alignment of the popup.                                                                                                |
| `[data-anchor-hidden]`        | positioner               | The anchor is out of view.                                                                                                                            |
| `[data-uncentered]`           | arrow                    | The arrow cannot point at the center of the anchor.                                                                                                   |
| `[data-instant]`              | popup, arrow, viewport   | An animation should not run: `delay` (another tooltip of the group was open), `focus` (the focus opened it), `dismiss` (Escape or a press closed it). |
| `[data-activation-direction]` | viewport                 | The side of the new trigger from the old one, such as `right down`.                                                                                   |
| `[hidden]`                    | popup                    | The tooltip is closed, with `keepMounted`.                                                                                                            |

The positioner has the variables `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height`, `--transform-origin`, `--positioner-width` and `--positioner-height`. The popup has `--popup-width` and `--popup-height` while it moves to another trigger. See [Popover](/components/popover#styling).

## Server render

`Tooltip.Portal` renders its content after its mount, as the Vue guide for a server render says for a teleport. The server HTML thus has the triggers only. A trigger has `data-popup-open` there when the open root names it. With `disabled` on `Tooltip.Portal`, the content renders in place, also on the server.

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

The methods of the handle, `open()` and `close()`, need a mounted `<Tooltip.Root>` with the same handle. The handle ignores a call while no root uses it: before a root mounts, and after it unmounts. Each root that mounts starts with a new state. It does not replay an earlier call, and it does not keep the open state of an earlier root.

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

To control the open state, use `v-model:open` on `<Tooltip.Root>`, or the `open` prop with the `openChange` event. With more than one trigger, control the active trigger with `v-model:trigger-id` on `<Tooltip.Root>` and the `id` prop of each `<Tooltip.Trigger>`.

The `openChange` event gives a second argument, `details`. Its `trigger` is the trigger element that started the change.

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

Put the content in `<Tooltip.Viewport>`. Its default slot gets the `triggerId` of the active trigger. Put the content in a `<Transition>`, with `triggerId` as the `key` of the element of the content. At a move, the old content leaves while the new content enters, with the classes of `<Transition>`.

The viewport has the `data-activation-direction` attribute, which gives the position of the new trigger relative to the old trigger. The value has at most two tokens, one for each axis: `left` or `right`, and `up` or `down`, for example `right down`. Match one token with the `~=` attribute selector, such as `[data-activation-direction~='right']`.

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

Set `to` on `Tooltip.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. `Tooltip.Portal` renders no element of its own. See [Portal target](/components/popover#portal-target).

## API reference

<ApiReference />

## createHandle

Creates a handle that connects a `<Tooltip.Root>` with detached `<Tooltip.Trigger>` parts. The type argument of the function is the type of the payload.

<ApiReference name="Tooltip.createHandle" :heading-level="3" />

### Handle

`Tooltip.createHandle()` returns a `Tooltip.Handle`. Give it to the `handle` prop of the root and of each trigger outside the root.

<ApiReference name="Tooltip.Handle" :heading-level="4" />

While a root is mounted, `open()` throws when the handle has no trigger with that `id`.
