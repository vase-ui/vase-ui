---
order: 2
description: A guide to animating Vase UI components.
---

<script setup lang="ts">
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import MotionKeepMounted from '../demos/handbook-animation/animated-popover-motion-keep-mounted-true/css-modules/index.vue';
import MotionPopup from '../demos/handbook-animation/animated-popover-motion-keep-mounted-false/css-modules/index.vue';
import MotionSelect from '../demos/handbook-animation/animated-select-motion/css-modules/index.vue';
</script>

# Animation

Animate a component with CSS transitions, CSS animations or a JavaScript animation library.

A part that shows and hides, such as a popup, a backdrop or a panel, renders its element only while it is shown. Put the part in a Vue [`<Transition>`](https://vuejs.org/guide/built-ins/transition.html). Vue adds the classes of the `<Transition>` when the element enters and leaves, and it keeps the element in the DOM until its leave ends.

## CSS transitions

Give the hidden style to the `enter-from` and `leave-to` classes, and the transition to the element.

Use a transition where you can. A transition that stops midway goes back from where it is, with no jump. For example, the user can close a popup before it is fully open.

::: code-group

```vue [Popup.vue]
<template>
  <Popover.Portal>
    <Popover.Positioner>
      <Transition name="popup" appear>
        <Popover.Popup class="Popup">…</Popover.Popup>
      </Transition>
    </Popover.Positioner>
  </Popover.Portal>
</template>
```

```css [popup.css]
.Popup {
  transform-origin: var(--transform-origin);
  transition:
    transform 150ms,
    opacity 150ms;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
```

:::

Without `keepMounted`, a `Portal` part renders its content only while the popup is open or leaves. The `<Transition>` in it thus mounts at each open, so give it `appear` to run the enter. Put the `<Transition>` in the portal, around the part. A `<Transition>` around a `Portal` part animates nothing, because the portal renders no element.

While an element leaves, the element that takes its place can already be in the DOM. To remove the element that leaves from the flow, give the `leave-active` class `position: absolute`.

When a panel opens again during its leave, the new panel enters after the leave ends.

Do not put a `<Transition>` around a part that renders the `element` slot. The root of the part is then the fragment of the slot, and Vue warns that it cannot animate it. Give the part `keepMounted`, and animate your element from its `state`, as in [Animate a popup that stays in the DOM](#animate-a-popup-that-stays-in-the-dom).

## CSS animations

Give the animations to the `enter-active` and `leave-active` classes.

```css
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.popup-enter-active {
  animation: scaleIn 250ms ease-out;
}

.popup-leave-active {
  animation: scaleIn 250ms ease-in reverse;
}
```

## Content that stays in the DOM

With `keepMounted`, a closed popup or panel stays in the DOM with the `hidden` and `inert` attributes. Vue runs no `<Transition>` for it. Animate it with CSS on `[hidden]`. Give `[hidden]` a `display` value, so that the browser does not hide the element at once, and give it the closed style.

```css
.Popup {
  transition: opacity 150ms;
}

.Popup[hidden] {
  display: block;
  opacity: 0;
}
```

With `inert`, the user cannot reach the closed element with the pointer or the focus.

## JavaScript animations

A JavaScript animation library, such as [Motion for Vue](https://motion.dev/docs/vue) (the package `motion-v`), runs in the JavaScript hooks of the `<Transition>`. With `:css="false"`, Vue removes the element when the `leave` hook calls `done`. Use `@after-enter` and `@after-leave` for code that runs after an animation.

### Animate a popup that leaves the DOM

The popup of [Popover](/components/popover) is in the DOM only while the popover is open.

1. Put `Popover.Popup` in a `<Transition>` with `:css="false"` and `appear`.
2. Run the enter animation in the `enter` hook, and the exit animation in the `leave` hook, with `animate` of `motion-v`.
3. Call `done` when the animation ends. Vue then removes the popup.

<DemoFrame>
  <MotionPopup />
</DemoFrame>

::: code-group

<<< ../demos/handbook-animation/animated-popover-motion-keep-mounted-false/css-modules/index.vue{6-12,20-22}

<<< ../demos/handbook-animation/animated-popover-motion-keep-mounted-false/css-modules/index.module.css

:::

`<AnimatePresence>` of `motion-v` renders a Vue `<Transition>` or `<TransitionGroup>`, so it takes the same place: in the portal, around the popup.

### Animate a popup that stays in the DOM

With `keepMounted` on `Popover.Portal`, the popup stays in the DOM. Render `motion.div` in the `element` slot of `Popover.Popup`, and compute `animate` from `state.open`. Give `initial` the value `false`, because the popup mounts closed. A rule of the style sheet keeps the closed popup visible while its exit runs.

<DemoFrame>
  <MotionKeepMounted />
</DemoFrame>

::: code-group

<<< ../demos/handbook-animation/animated-popover-motion-keep-mounted-true/css-modules/index.vue{13-19}

<<< ../demos/handbook-animation/animated-popover-motion-keep-mounted-true/css-modules/index.module.css

:::

### Animate a Select popup

The popup of [Select](/components/select) mounts at the first focus of the trigger, the first open or the first autofill. Then it stays in the DOM, and it shows and hides its own element. Put a `<Transition>` around `Select.Popup`, with no `appear`. The hooks of the `<Transition>` then run at each open and each close.

<DemoFrame>
  <MotionSelect />
</DemoFrame>

::: code-group

<<< ../demos/handbook-animation/animated-select-motion/css-modules/index.vue{29-35,53}

<<< ../demos/handbook-animation/animated-select-motion/css-modules/index.module.css

:::

### End the exit yourself

With `:css="false"`, the element stays in the DOM until you call `done` of the `leave` hook. Call it when your animation ends.

To wait for something before the popup starts to close, call `cancel()` in your `openChange` listener at the close. When the wait ends, set the value of `v-model:open` to `false`.

## Differences from Base UI

| Base UI                                                           | Vase UI                                                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `data-starting-style`                                             | The `enter-from` class of `<Transition>`.                                                                              |
| `data-ending-style`                                               | The `leave-to` class of `<Transition>`.                                                                                |
| `transitionStatus` in the state                                   | The classes and the JavaScript hooks of `<Transition>`.                                                                |
| The part keeps a closing popup mounted until its animations end   | `<Transition>` keeps the element in the DOM until its transition or animation ends.                                    |
| `onOpenChangeComplete`                                            | `@after-enter` and `@after-leave` of `<Transition>`.                                                                   |
| `actionsRef.unmount()` and `eventDetails.preventUnmountOnClose()` | `done` of the `leave` hook, with `:css="false"`.                                                                       |
| `[data-open]` and `[data-closed]` for a CSS animation             | The `enter-active` and `leave-active` classes of `<Transition>`. With `keepMounted`, `[hidden]` on the closed element. |
