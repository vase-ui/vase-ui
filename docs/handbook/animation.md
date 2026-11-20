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

A guide to animating Vase UI components.

You can animate a component with CSS transitions, CSS animations or a JavaScript animation library. A part that shows and hides, such as a popup, a backdrop or a panel, renders its element only while it is shown. Put it in a Vue [`<Transition>`](https://vuejs.org/guide/built-ins/transition.html), and animate it with the classes and the hooks of `<Transition>`. The page of each component says where to put the `<Transition>`.

## CSS transitions

Give the hidden style to the `enter-from` and the `leave-to` classes of the `<Transition>`, and the transition to the element.

Use a transition where you can. A transition can be canceled midway with no jump. For example, the user can close a popup before it is fully open. The popup then moves to its closed state from where it is.

::: code-group

```vue [Popup.vue]
<template>
  <Transition name="popup" appear>
    <Popover.Popup class="Popup">…</Popover.Popup>
  </Transition>
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

## CSS animations

Give the animations to the `enter-active` and the `leave-active` classes of the `<Transition>`.

::: code-group

```css [popup.css]
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

:::

## JavaScript animations

A JavaScript animation library, such as [Motion for Vue](https://motion.dev/docs/vue) (the package `motion-v`), runs in the JavaScript hooks of the `<Transition>`. With `:css="false"`, Vue keeps the element in the DOM until the `leave` hook calls `done`.

### Animate a popup with motion-v

The examples of this section and the next section use [Popover](/components/popover). Its popup is in the DOM only while the popover is open.

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

To use `<AnimatePresence>` in the place of `<Transition>`, see [AnimatePresence](#animatepresence).

A popup of another family can take `motion.div` in the `as` prop. The template then cannot read the `state` of the popup, so `animate` reads a controlled `open`.

<<< ../examples/animation/MotionAsProp.vue{10,15-17}

### Animate a popup that stays in the DOM

A popup stays in the DOM while it is closed when its portal has `keepMounted`. Vue runs no transition for it. Give `motion.div` to the `element` slot of `Popover.Popup`, and compute `animate` from `state.open`. `initial` is `false`, because the popup mounts closed. The closed popup has `hidden` and `inert`. A rule of the style sheet keeps it shown while its exit plays.

<DemoFrame>
  <MotionKeepMounted />
</DemoFrame>

::: code-group

<<< ../demos/handbook-animation/animated-popover-motion-keep-mounted-true/css-modules/index.vue{13-19}

<<< ../demos/handbook-animation/animated-popover-motion-keep-mounted-true/css-modules/index.module.css

:::

### Animate a Select popup

The popup of [Select](/components/select) stays in the DOM from the first focus of the trigger, the first open or the first fill of the browser, and it hides while the select is closed. Put a `<Transition>` around `Select.Popup`, with no `v-show` and no `appear`: the part shows and hides its own element, so the `<Transition>` runs the enter and the leave of each open and close. For a JavaScript animation, give the `<Transition>` `:css="false"`, and call `done` in its `@enter` and `@leave` hooks when the animation ends. The popup shows until `@leave` calls `done`.

<DemoFrame>
  <MotionSelect />
</DemoFrame>

::: code-group

<<< ../demos/handbook-animation/animated-select-motion/css-modules/index.vue{29-35,53}

<<< ../demos/handbook-animation/animated-select-motion/css-modules/index.module.css

:::

### Manual unmounting

A popup in a `<Transition>` with `:css="false"` stays in the DOM until its `leave` hook calls `done`, as [Animate a popup with motion-v](#animate-a-popup-with-motion-v) shows. To end the exit yourself, such as after a `height` that `motion-v` runs in JavaScript, call `done` when the exit ends.

To wait for something before the popup closes, control `open` and keep it `true` while you wait. Then set it to `false`.

### AnimatePresence

`<AnimatePresence>` of `motion-v` renders a Vue `<Transition>`, so the rules of this page apply to it. A portal part renders a `<Teleport>` and no element of its own, so a `<Transition>` around a portal part animates nothing. Put the `<Transition>` in the portal, around the popup part.
