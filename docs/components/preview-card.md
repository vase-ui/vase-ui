---
order: 1
description: An unstyled Vue preview card component that shows a preview of the destination of a link and does not stop keyboard or screen reader navigation.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
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

A link that shows a preview of its destination and does not stop keyboard or screen reader navigation.

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
- **Keep the content of the popup supplementary**: Do not put unique or essential information in the popup, unless the linked page also has it. Touch, keyboard and screen reader users cannot move into the content of a preview card. It is a visual [progressive enhancement](https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement) for sighted users with a mouse or a keyboard.

## Anatomy

Import the component and assemble its parts:

<<< ./preview-card/Anatomy.vue

Give the `z-index` of the popup to `PreviewCard.Positioner`: see [Portals](/quick-start#portals).

## Examples

### Detached triggers

A trigger can be inside or outside `PreviewCard.Root`. For a simple preview card, put `PreviewCard.Trigger` inside `PreviewCard.Root`, as the demo at the top of this page does.

When the content of the preview card cannot be next to its trigger, use a detached trigger. Put `PreviewCard.Trigger` outside `PreviewCard.Root`, and connect the two with a handle from `PreviewCard.createHandle()`.

The methods `open()` and `close()` of the handle need a mounted `PreviewCard.Root` with the same handle. The handle ignores a call while no root uses it: before a root mounts, and after it unmounts. Each root starts with a new state at its mount. It does not replay an earlier call, and it does not keep the open state of an earlier root.

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

One preview card can have more than one trigger. Give the same `handle` to more than one detached trigger, or put more than one `PreviewCard.Trigger` in one `PreviewCard.Root`.

<<< ./preview-card/MultipleTriggers.vue{7-8}

<<< ./preview-card/MultipleDetachedTriggers.vue{8-9}

The preview card can show different content for each trigger. Give a `payload` to each `PreviewCard.Trigger`. The default slot of `PreviewCard.Root` gets the `payload` of the active trigger. The type argument of `createHandle()` gives the payload its type:

<<< ./preview-card/DetachedTriggersPayload.vue{4,8,11,15,19}

### Controlled mode with multiple triggers

To control the open state, use `v-model:open` on `PreviewCard.Root`, or the `open` prop and the `openChange` event. With more than one trigger, control the active trigger with `v-model:trigger-id` on `PreviewCard.Root` and the `id` prop of each `PreviewCard.Trigger`.

The second argument of `openChange` has `trigger`, the element of the trigger that started the change.

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

A preview card can animate its position, its size and its content when it moves from one trigger to another.

#### Position and size

To animate the position, give `PreviewCard.Positioner` a CSS transition of `left`, `right`, `top` and `bottom`. To animate the size, give `PreviewCard.Popup` a transition of `width` and `height`.

#### Content

To animate the content, put it in `PreviewCard.Viewport`. The default slot of the viewport gets `triggerId`, the `id` of the active trigger. Put the content in a `<Transition>`, with `triggerId` as its `key`. At a move, the old content leaves while the new content enters. Select the old content with the leave classes, and the viewport while it has old content with `:has(> .x-leave-active)`.

The `data-activation-direction` attribute of the viewport gives the place of the new trigger from the old trigger. Its value has one or two tokens, one for each axis: `left` or `right`, and `up` or `down`, such as `right down`. Match one token with the `~=` selector, such as `[data-activation-direction~='right']`.

Use a viewport only when one popup has more than one trigger, and the content changes with an animation at a move to another trigger. With a viewport, give `PreviewCard.Positioner` the styles `width: var(--positioner-width)` and `height: var(--positioner-height)`. The positioner then keeps the measured size during the transition. Without these styles, the size of the content can change the size of the popup in each frame, or move the popup to another side.

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

## API reference

<ApiReference />

### createHandle

Makes a `PreviewCard.Handle` with the type argument as the type of its payload.

<ApiReference name="PreviewCard.createHandle" :heading-level="4" />

### Handle

A handle opens and closes the preview card from code, and connects the triggers outside the root to it.

<ApiReference name="PreviewCard.Handle" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
