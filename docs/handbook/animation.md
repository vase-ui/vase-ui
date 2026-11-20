---
order: 2
description: A guide to animating Vase UI components.
---

<script setup lang="ts">
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import ManualUnmount from '../examples/animation/demos/manual-unmount/index.vue';
import MotionKeepMounted from '../demos/handbook-animation/animated-popover-motion-keep-mounted-true/css-modules/index.vue';
import MotionPopup from '../demos/handbook-animation/animated-popover-motion-keep-mounted-false/css-modules/index.vue';
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

When a popup closes, `open` becomes `false` at once. The popup stays in the DOM until its exit animation ends. Vase UI finds the animations on the element of the popup. With no popup part, it finds them on the positioner, and with no positioner, on the backdrop. It always finds CSS transitions and CSS animations. It also finds a `motion-v` animation that includes `opacity`.

When the animation ends, Vase UI removes the popup from the DOM, or hides it if the portal has `keepMounted`. It also hides the popup of a [Select](#animate-a-select-popup), and in some cases the popup of a [Combobox or Autocomplete](#animate-a-combobox-or-autocomplete-popup). The root emits `openChangeComplete` with `false`.

Vase UI ends the exit when the animation that it finds ends. If it finds none, it ends the exit in the next frame. To end the exit yourself, see [Manual unmounting](#manual-unmounting). The example of a Select popup animates `opacity`, so Vase UI ends the exit on its own.

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

Do not use `<AnimatePresence>` and the `exit` prop for the close of a popup. For the reasons, see [AnimatePresence](#animatepresence).

A popup of another family can take `motion.div` in the `as` prop. The template then cannot read the `state` of the popup, so `animate` reads a controlled `open`.

<<< ../examples/animation/MotionAsProp.vue{10,14-16}

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

The popup of [Select](/components/select) is not in the DOM until the select is open, gets the focus, or reads a value from its hidden input. After that, the popup stays in the DOM, and it is hidden while the select is closed. `Select.Portal` has no `keepMounted` prop. The code of [Animate a popup with motion-v](#animate-a-popup-with-motion-v) animates the popup. The popup can enter the DOM open, so `initial` is the closed style.

<DemoFrame>
  <MotionSelect />
</DemoFrame>

::: code-group

<<< ../demos/handbook-animation/animated-select-motion/css-modules/index.vue{46,48-50}

<<< ../demos/handbook-animation/animated-select-motion/css-modules/index.module.css

:::

### Animate a Combobox or Autocomplete popup

The popup of [Combobox](/components/combobox) or [Autocomplete](/components/autocomplete) can stay in the DOM with no `keepMounted`. With no `items` prop on the root, the popup enters the DOM when the `Trigger` part gets the focus or a press. Without `multiple`, the popup of a Combobox also enters when the root reads a value from its hidden input. With the `items` prop, it then enters only if no item has that value or label. After that, the popup stays in the DOM, and it is hidden while it is closed. The code of [Animate a popup with motion-v](#animate-a-popup-with-motion-v) animates the popup. The popup can enter the DOM open, so `initial` is the closed style.

### Manual unmounting

Use this when Vase UI cannot find the exit animation. Use it also when something other than an animation must end the exit. `motion-v` runs some values in JavaScript, such as `height`. Vase UI cannot find such an animation, so it removes or hides the popup in the next frame, before the exit shows.

1. Call `details.preventUnmountOnClose()` in the `openChange` listener when the popup closes.
2. When the exit ends, call `unmount()` on the root. Get the root with a template ref.

The root then emits `openChangeComplete` with `false`. The popup then leaves the DOM or stays hidden, as it does when an animation ends.

<DemoFrame>
  <ManualUnmount />
</DemoFrame>

::: code-group

<<< ../examples/animation/demos/manual-unmount/index.vue{12,18,24,34}

:::

To wait for something before the popup closes, control `open` and keep it `true` while you wait. After the wait, call `details.preventUnmountOnClose()`. Then set `open` to `false`. When the exit ends, call `unmount()`.

The request lasts until the popup opens again or unmounts, also when more close requests come during the wait. A request to open the popup clears it, so call `details.preventUnmountOnClose()` after the wait, not before. A close that you cancel with `details.cancel()` before the `await` makes no request.

<<< ../examples/animation/ManualUnmountAfterAwait.vue#listener{6-8 ts}

### AnimatePresence

`<AnimatePresence>` renders a Vue `<Transition>` or `<TransitionGroup>`. Both keep the element of the portal part in the DOM during the exit, but the parts in that element unmount. Thus the `exit` prop does not fit the close of a popup:

- With `v-if="open"` on the portal part, the parts in the portal unmount when the popup closes. The root emits `openChangeComplete` with `false` when the animations of the popup element end. The popup keeps `data-open` during the exit. The page under a modal dialog takes no pointer input until the exit ends.
- With no `v-if`, the parts in the portal unmount after Vase UI ends the close, if Vase UI removes the popup. The `exit` animation starts only then. The root thus emits `openChangeComplete` with `false` before the exit plays.
- With no `v-if`, the parts stay mounted if Vase UI hides the popup at the end of the close. The `exit` animation does not play.

In the first two cases, a popup that opens again during the exit is a second popup in the page. The two popups have the same `id`.

A `<Transition>` or `<TransitionGroup>` can animate the element of a portal part only with Vue 3.5.41 or later. In Vue 3.6, it needs 3.6.0-rc.3 or later. With an earlier version, an `exit` animation does not play. A development build of Vue then writes this warning for each `<AnimatePresence>` around a portal part:

```txt
Component inside <Transition> renders non-element root node that cannot be animated.
```

With the `#render` slot on the portal part, a development build of Vue writes the warning in each version.

The examples on this page use no `<AnimatePresence>` and no `<Transition>`. They work with each Vue version that Vase UI supports.
