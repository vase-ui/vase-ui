---
order: 1
description: An unstyled Vue preview card component for a link that shows a preview of its destination without interrupting keyboard or screen reader navigation.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoPreviewCardDetachedTriggersControlled from '../demos/preview-card/detached-triggers-controlled/css-modules/index.vue';
import DemoPreviewCardDetachedTriggersFull from '../demos/preview-card/detached-triggers-full/css-modules/index.vue';
import DemoPreviewCardDetachedTriggersSimple from '../demos/preview-card/detached-triggers-simple/css-modules/index.vue';
import DemoPreviewCardHero from '../demos/preview-card/hero/css-modules/index.vue';
</script>

# Preview Card

A link that shows a preview of its destination without interrupting keyboard or screen reader navigation.

<DemoFrame>
  <DemoPreviewCardHero />
</DemoFrame>

::: code-group

<<< ../demos/preview-card/hero/css-modules/index.vue

<<< ../demos/preview-card/index.module.css

:::

## Usage guidelines

- **Keep the context of screen reader users**: A screen reader that reads each preview makes the user go through its content before the rest of the page. Keep the link as the only accessible interface, and put all the previewed information at its destination.
- **Keep the content of the popup supplementary**: Do not put unique or essential information in the popup unless the linked page also has it. For the reason above, the content of a preview card is not touch, keyboard or screen reader navigable. It is a visual [progressive enhancement](https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement) for sighted mouse and keyboard users only.

## Anatomy

Import the component and assemble its parts:

<<< ./preview-card/Anatomy.vue

`PreviewCard.Trigger` renders an `<a>` element. A click on it goes to its `href`, and the part adds no ARIA attribute, no `role` and no `tabindex`. A touch pointer does not open the card.

## Examples

### Detached triggers

A trigger can be inside or outside `PreviewCard.Root`. For a simple interaction, put `PreviewCard.Trigger` inside `PreviewCard.Root`, as the example at the top of this page does.

When the content of the preview card cannot be next to its trigger, use a detached trigger. Put `PreviewCard.Trigger` outside `PreviewCard.Root`, and connect the two with a handle from `PreviewCard.createHandle()`.

The methods of the handle, such as `open()` and `close()`, act only while a `PreviewCard.Root` with the same handle is mounted. The handle ignores a call before a root mounts or after it unmounts, and a development build shows a warning for that call. Each root that mounts starts from a new state. It does not run an ignored call, and it does not keep the open state of an earlier root.

<<< ./preview-card/DetachedTriggers.vue{4,8,10}

<DemoFrame>
  <DemoPreviewCardDetachedTriggersSimple />
</DemoFrame>

::: code-group

<<< ../demos/preview-card/detached-triggers-simple/css-modules/index.vue

<<< ../demos/preview-card/index.module.css

:::

### Multiple triggers

More than one trigger can open the same preview card. Give the same `handle` to more than one detached trigger, or put more than one `PreviewCard.Trigger` in one `PreviewCard.Root`.

<<< ./preview-card/MultipleTriggers.vue{7-8}

<<< ./preview-card/MultipleDetachedTriggers.vue{8-9}

The preview card can show different content for each trigger. Give a `payload` to each `PreviewCard.Trigger`. The default slot of `PreviewCard.Root` gets the `payload` of the active trigger.

The type argument of `createHandle()` gives the type of the payload:

<<< ./preview-card/DetachedTriggersPayload.vue{4,8,11,16,20}

### Controlled mode with multiple triggers

To control the open state, give `open` to `PreviewCard.Root` and listen to its `openChange` event, or use `v-model:open`. With more than one trigger, also control the active trigger with the `triggerId` prop of the root and the `id` of each `PreviewCard.Trigger`.

The root has no event for a change of the trigger id. The `openChange` event gives `eventDetails` as its second argument. Its `trigger` is the element of the trigger that started the change.

<DemoFrame>
  <DemoPreviewCardDetachedTriggersControlled />
</DemoFrame>

::: code-group

<<< ../demos/preview-card/detached-triggers-controlled/css-modules/index.vue

<<< ../demos/preview-card/index.module.css

:::

### Animating the Preview Card

A preview card can animate when it moves from one trigger to another. Its position, its size and its content can animate.

#### Position and size

To animate the position, give a CSS transition to `left`, `right`, `top` and `bottom` of `PreviewCard.Positioner`. To animate the size, give a transition to `width` and `height` of `PreviewCard.Popup`.

#### Content

The content can also animate when the triggers show different content in the same preview card.

Put the content in `PreviewCard.Viewport`. The viewport renders a `<div>` with the attribute `data-activation-direction`. Its value gives the place of the new trigger relative to the old trigger. It has up to two tokens, one for each axis: `left` or `right`, and `up` or `down`, such as `right down`. Match one token with the `~=` selector: `[data-activation-direction~='right']`.

The viewport puts the content in `<div>` elements with these attributes:

- `data-current`: the content that shows, or the new content during a transition.
- `data-previous`: the old content during a transition.

Use these attributes to style the enter and exit animations.

The viewport is optional. Use it only when more than one trigger opens one popup, the content changes with the trigger, and the change animates. With a viewport, set `width: var(--positioner-width)` and `height: var(--positioner-height)` on `PreviewCard.Positioner`. The positioner then keeps the measured size during the transition. Without these declarations, a change of the size of the content can make the popup flicker or move to another side.

<DemoFrame>
  <DemoPreviewCardDetachedTriggersFull />
</DemoFrame>

::: code-group

<<< ../demos/preview-card/detached-triggers-full/css-modules/index.vue

<<< ../demos/preview-card/detached-triggers-full/css-modules/index.module.css

:::

## API reference

<ApiReference />

## createHandle

Creates a handle that connects a `PreviewCard.Root` with detached `PreviewCard.Trigger` parts. The type argument of the function is the type of the payload.

<ApiReference name="PreviewCard.createHandle" />

### Handle

`PreviewCard.Handle` is the class of the handle.

<ApiReference name="PreviewCard.Handle" />

While a root is mounted, `open()` throws when the handle has no trigger with that `id`.
