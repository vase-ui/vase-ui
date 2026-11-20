---
order: 1
description: An unstyled Vue preview card component for a link that shows a preview of its destination without interrupting keyboard or screen reader navigation.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoPreviewCardDetachedTriggersControlled from '../demos/preview-card/detached-triggers-controlled/css-modules/index.vue';
import DemoPreviewCardDetachedTriggersControlledTailwind from '../demos/preview-card/detached-triggers-controlled/tailwind/index.vue';
import DemoPreviewCardDetachedTriggersFull from '../demos/preview-card/detached-triggers-full/css-modules/index.vue';
import DemoPreviewCardDetachedTriggersFullTailwind from '../demos/preview-card/detached-triggers-full/tailwind/index.vue';
import DemoPreviewCardDetachedTriggersSimple from '../demos/preview-card/detached-triggers-simple/css-modules/index.vue';
import DemoPreviewCardDetachedTriggersSimpleTailwind from '../demos/preview-card/detached-triggers-simple/tailwind/index.vue';
import DemoPreviewCardHero from '../demos/preview-card/hero/css-modules/index.vue';
import DemoPreviewCardHeroTailwind from '../demos/preview-card/hero/tailwind/index.vue';
</script>

# Preview Card

A link that shows a preview of its destination without interrupting keyboard or screen reader navigation.

<DemoFrame>
  <DemoPreviewCardHero />
  <template #tailwind>
    <DemoPreviewCardHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/preview-card/hero/css-modules/index.vue

<<< ../demos/preview-card/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/preview-card/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Keep the context of screen reader users**: A screen reader that reads each preview makes the user go through its content before the rest of the page. Keep the link as the only accessible interface, and put all the previewed information at its destination.
- **Keep the content of the popup supplementary**: Do not put unique or essential information in the popup unless the linked page also has it. For the reason above, the content of a preview card is not touch, keyboard or screen reader navigable. It is a visual [progressive enhancement](https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement) for sighted mouse and keyboard users only.

## Anatomy

Import the component and assemble its parts:

<<< ./preview-card/Anatomy.vue

`PreviewCard.Trigger` renders an `<a>` element. A click on it goes to its `href`, and the part adds no ARIA attribute, no `role` and no `tabindex`.

## Keyboard and touch

The card opens when a mouse rests on the link, and when the keyboard moves the focus to the link. A touch opens nothing. Tab does not go into the card, and the card moves no focus when it opens or closes. A press in the card moves the focus to the card, so the card stays open.

When the link wraps over more lines, the card opens at the line under the pointer.

## Animation

The popup and the backdrop are in the DOM only while the card is open. Put each of them in a `<Transition appear>`, and animate them with the classes of `<Transition>`. The portal renders its content at the open, so `<Transition>` needs `appear` to run the enter of the first open.

With `keepMounted` on `PreviewCard.Portal`, the closed popup and backdrop stay in the DOM with `hidden` and `inert`. Vue then runs no transition, so animate them with CSS on `[hidden]`.

To keep the popup in the DOM until an animation of JavaScript ends, use the JavaScript hooks of `<Transition>`. With `:css="false"`, Vue removes the element when the `leave` hook calls `done`. Use `@after-enter` and `@after-leave` for code that runs after an animation.

## Styling

Select the states of the parts with these selectors:

| Selector                      | On                       | State                                                                                                                                                    |
| ----------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[data-popup-open]`           | trigger                  | The card is open for this link.                                                                                                                          |
| `[data-side]`, `[data-align]` | positioner, popup, arrow | The side of the anchor and the alignment of the popup: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`, and `start`, `center` or `end`. |
| `[data-anchor-hidden]`        | positioner               | The anchor is out of view.                                                                                                                               |
| `[data-uncentered]`           | arrow                    | The arrow cannot point at the center of the anchor.                                                                                                      |
| `[data-instant]`              | popup, viewport          | An animation should not run: `focus` (the focus opened the card) or `dismiss` (Escape).                                                                  |
| `[data-activation-direction]` | viewport                 | The side of the new link from the old one, such as `right down`.                                                                                         |
| `[hidden]`                    | popup, backdrop          | The card is closed, with `keepMounted`.                                                                                                                  |

These CSS variables give the sizes and the place:

| Variable                                    | On         | Value                                                                      |
| ------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| `--anchor-width`, `--anchor-height`         | positioner | The size of the anchor.                                                    |
| `--available-width`, `--available-height`   | positioner | The room from the anchor to the edge of the collision boundary.            |
| `--transform-origin`                        | positioner | The point that the popup grows from: its arrow, or its edge at the anchor. |
| `--positioner-width`, `--positioner-height` | positioner | The size of the popup, with a `PreviewCard.Viewport`.                      |
| `--popup-width`, `--popup-height`           | popup      | The old size, then the new size, while the card moves to another link.     |

## Router links

To use a link of Vue Router, render `RouterLink` with `custom`, and give its `href` and `navigate` to `PreviewCard.Trigger`:

```vue-html
<RouterLink v-slot="{ href, navigate }" to="/typography" custom>
  <PreviewCard.Trigger :href="href" @click="navigate">typography</PreviewCard.Trigger>
</RouterLink>
```

## Examples

### Detached triggers

A trigger can be inside or outside `PreviewCard.Root`. For a simple interaction, put `PreviewCard.Trigger` inside `PreviewCard.Root`, as the example at the top of this page does.

When the content of the preview card cannot be next to its trigger, use a detached trigger. Put `PreviewCard.Trigger` outside `PreviewCard.Root`, and connect the two with a handle from `PreviewCard.createHandle()`.

The methods of the handle, such as `open()` and `close()`, act only while a `PreviewCard.Root` with the same handle is mounted. The handle ignores a call before a root mounts or after it unmounts. Each root that mounts starts from a new state. It does not run an ignored call, and it does not keep the open state of an earlier root.

<<< ./preview-card/DetachedTriggers.vue{4,8,10}

<DemoFrame>
  <DemoPreviewCardDetachedTriggersSimple />
  <template #tailwind>
    <DemoPreviewCardDetachedTriggersSimpleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/preview-card/detached-triggers-simple/css-modules/index.vue

<<< ../demos/preview-card/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/preview-card/detached-triggers-simple/tailwind/index.vue

:::

</DemoSource>

### Multiple triggers

More than one trigger can open the same preview card. Give the same `handle` to more than one detached trigger, or put more than one `PreviewCard.Trigger` in one `PreviewCard.Root`.

<<< ./preview-card/MultipleTriggers.vue{7-8}

<<< ./preview-card/MultipleDetachedTriggers.vue{8-9}

The preview card can show different content for each trigger. Give a `payload` to each `PreviewCard.Trigger`. The default slot of `PreviewCard.Root` gets the `payload` of the active trigger.

The type argument of `createHandle()` gives the type of the payload:

<<< ./preview-card/DetachedTriggersPayload.vue{4,8,11,16,20}

### Controlled mode with multiple triggers

To control the open state, use `v-model:open` on `PreviewCard.Root`, or the `open` prop with the `openChange` event. With more than one trigger, control the active trigger with `v-model:trigger-id` on `PreviewCard.Root` and the `id` prop of each `PreviewCard.Trigger`.

The `openChange` event gives `eventDetails` as its second argument. Its `trigger` is the element of the trigger that started the change.

<DemoFrame>
  <DemoPreviewCardDetachedTriggersControlled />
  <template #tailwind>
    <DemoPreviewCardDetachedTriggersControlledTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/preview-card/detached-triggers-controlled/css-modules/index.vue

<<< ../demos/preview-card/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/preview-card/detached-triggers-controlled/tailwind/index.vue

:::

</DemoSource>

### Animating the Preview Card

A preview card can animate when it moves from one trigger to another. Its position, its size and its content can animate.

#### Position and size

To animate the position, give a CSS transition to `left`, `right`, `top` and `bottom` of `PreviewCard.Positioner`. To animate the size, give a transition to `width` and `height` of `PreviewCard.Popup`.

#### Content

The content can also animate when the triggers show different content in the same preview card.

Put the content in `PreviewCard.Viewport`. The viewport renders a `<div>` with the attribute `data-activation-direction`. Its value gives the place of the new trigger relative to the old trigger. It has up to two tokens, one for each axis: `left` or `right`, and `up` or `down`, such as `right down`. Match one token with the `~=` selector: `[data-activation-direction~='right']`.

The default slot of `PreviewCard.Viewport` gets `triggerId`, the `id` of the active trigger. Put the content in a `<Transition>`, and give it the `triggerId` as its `key`. At a move, Vue keeps the old content for its leave while the new content enters. Select the old content with the leave classes, and the viewport while it has old content with `:has(> .x-leave-active)`.

The viewport is optional. Use it only when more than one trigger opens one popup, the content changes with the trigger, and the change animates. With a viewport, set `width: var(--positioner-width)` and `height: var(--positioner-height)` on `PreviewCard.Positioner`. The positioner then keeps the measured size during the transition. Without these declarations, a change of the size of the content can make the popup flicker or move to another side.

<DemoFrame>
  <DemoPreviewCardDetachedTriggersFull />
  <template #tailwind>
    <DemoPreviewCardDetachedTriggersFullTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/preview-card/detached-triggers-full/css-modules/index.vue

<<< ../demos/preview-card/detached-triggers-full/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/preview-card/detached-triggers-full/tailwind/index.vue

:::

</DemoSource>

## Portal target

Set `to` on `PreviewCard.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal target](/components/popover#portal-target).

## API reference

<ApiReference />

## createHandle

Creates a handle that connects a `PreviewCard.Root` with detached `PreviewCard.Trigger` parts. The type argument of the function is the type of the payload.

<ApiReference name="PreviewCard.createHandle" :heading-level="3" />

### Handle

`PreviewCard.Handle` is the class of the handle.

<ApiReference name="PreviewCard.Handle" :heading-level="4" />

While a root is mounted, `open()` throws when the handle has no trigger with that `id`.
