---
order: 2
description: A guide to animating Vase UI components.
---

<script setup lang="ts">
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import ManualUnmount from '../examples/animation/demos/manual-unmount/index.vue';
import MotionKeepMounted from '../examples/animation/demos/motion-keep-mounted/index.vue';
import MotionPopup from '../examples/animation/demos/motion-popup/index.vue';
import MotionSelect from '../demos/handbook-animation/animated-select-motion/css-modules/index.vue';
</script>

# Animation

A guide to animating Vase UI components.

You can animate a component with CSS transitions, CSS animations or a JavaScript animation library. Each component has data attributes for its states. Some attributes exist only for animation.

## CSS transitions

Use these attributes to make a transition when a component becomes visible or hidden:

- `[data-starting-style]` is the style that the transition starts from.
- `[data-ending-style]` is the style that the transition ends at.

Use a transition where you can. A transition can be canceled midway with no jump. For example, the user can close a popup before it is fully open. The popup then moves to its closed state from where it is.

::: code-group

```css{10-14} [tooltip.css]
.Popup {
  box-sizing: border-box;
  padding: 1rem 1.5rem;
  background-color: canvas;
  transform-origin: var(--transform-origin);
  transition:
    transform 150ms,
    opacity 150ms;

  &[data-starting-style],
  &[data-ending-style] {
    opacity: 0;
    transform: scale(0.9);
  }
}
```

:::

## CSS animations

Use these attributes to make a CSS animation when a component becomes visible or hidden:

- `[data-open]` is on the component while it is open.
- `[data-closed]` is on the component while it is closed.

::: code-group

```css [tooltip.css]
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

@keyframes scaleOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

.Popup[data-open] {
  animation: scaleIn 250ms ease-out;
}

.Popup[data-closed] {
  animation: scaleOut 250ms ease-in;
}
```

:::

## JavaScript animations

A JavaScript animation library, such as [Motion for Vue](https://motion.dev/docs/vue) (the package `motion-v`), needs the popup in the DOM while its exit animation plays. Vase UI must also know when that animation ends.

When a popup closes, `open` becomes `false` at once. The popup stays in the DOM until its exit animation ends. Vase UI finds the animations on the element of the popup. It always finds CSS transitions and CSS animations. It also finds a `motion-v` animation that includes `opacity`.

When the animation ends, Vase UI removes the popup from the DOM, or hides it if the portal has `keepMounted`. The root emits `openChangeComplete` with `false`.

Vase UI ends the exit when the animation that it finds ends. If it finds none, it ends the exit in the next frame. To end the exit yourself, see [Manual unmounting](#manual-unmounting). The first two examples below animate `opacity`, so Vase UI ends the exit on its own.

### Animate a popup with motion-v

The examples use [Dialog](/components/dialog) and [Select](/components/select).

1. Give `motion.div` to the `#render` slot of `Dialog.Popup`. Bind the `props` of the slot on it, cast to `MotionProps`. The cast is for the type of `style`, which differs between Vue and `motion-v`.
2. Set `initial` to the closed style.
3. Compute `animate` from `state.open`.

<DemoFrame>
  <MotionPopup />
</DemoFrame>

::: code-group

<<< ../examples/animation/demos/motion-popup/index.vue{12,14,16-17}

:::

Vase UI keeps the popup in the DOM while the exit animation plays. The popup needs no `<AnimatePresence>`, no `keepMounted` and no controlled `open`.

Do not put a part in `<AnimatePresence>`: a portal part renders a `<Teleport>`, which `<AnimatePresence>` cannot animate.

You can also give `motion.div` to the `as` prop. The `as` prop gets no `state`, so `animate` reads a controlled `open`.

<<< ../examples/animation/MotionAsProp.vue{10,14-16}

### Animate a popup that stays in the DOM

A popup stays in the DOM while it is closed when its portal has `keepMounted`. The same code animates it. Vase UI hides the closed popup.

<DemoFrame>
  <MotionKeepMounted />
</DemoFrame>

::: code-group

<<< ../examples/animation/demos/motion-keep-mounted/index.vue{10,12,14,16-17}

:::

### Animate a Select popup

`Select.Portal` has no `keepMounted` prop. The popup stays in the DOM after its first open, and it is hidden while the select is closed. The same code animates it.

<DemoFrame>
  <MotionSelect />
</DemoFrame>

::: code-group

<<< ../demos/handbook-animation/animated-select-motion/css-modules/index.vue{46,48-50}

<<< ../demos/handbook-animation/animated-select-motion/css-modules/index.module.css

:::

### Manual unmounting

Use this when Vase UI cannot find the exit animation. Use it also when something other than an animation must end the exit. `motion-v` runs some values in JavaScript, such as `height`. Vase UI cannot find such an animation, so it removes the popup in the next frame, before the exit shows.

1. Call `details.preventUnmountOnClose()` in the `openChange` listener when the popup closes.
2. When the exit ends, call `unmount()` on the root. Get the root with a template ref.

The root then emits `openChangeComplete` with `false`. `keepMounted` still decides if the popup leaves the DOM.

<DemoFrame>
  <ManualUnmount />
</DemoFrame>

::: code-group

<<< ../examples/animation/demos/manual-unmount/index.vue{12,18,24,32-34}

:::

To wait for something before the popup closes, control `open` and keep it `true` while you wait. After the wait, call `details.preventUnmountOnClose()`. Then set `open` to `false`. When the exit ends, call `unmount()`.

The request lasts until the popup opens again or unmounts, also when more close requests come during the wait. A request to open the popup clears it, so call `details.preventUnmountOnClose()` after the wait, not before. A close that you cancel with `details.cancel()` before the `await` makes no request.

<<< ../examples/animation/ManualUnmountAfterAwait.vue#listener{6-8 ts}

[Navigation Menu](/components/navigation-menu#closing-animations) takes `details.preventUnmountOnClose()` in its `valueChange` listener.
