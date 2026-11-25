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

A part that shows and hides, such as a popup, a backdrop or a panel, keeps its element in the DOM until its leave ends. Put the part in a Vue [`<Transition>`](https://vuejs.org/guide/built-ins/transition.html). Vue adds the classes of the `<Transition>` when the element enters and leaves.

## CSS transitions

Give the hidden style to the `enter-from` and `leave-to` classes, and the transition to the element.

Use a transition where you can. A transition that stops midway goes back from where it is, with no jump. For example, the user can close a popup before it is fully open.

::: code-group

```vue [Popup.vue]
<template>
  <Popover.Portal>
    <Popover.Positioner>
      <Transition name="popup">
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

Without `keepMounted`, a `Portal` part renders its content only while the popup is open or leaves. Put the `<Transition>` in the portal, around the part. A `<Transition>` around a `Portal` part animates nothing, because the portal has no root element.

The popup and the backdrop of Dialog, Alert Dialog, Popover, Menu, Context Menu, Menubar, Tooltip, Preview Card, Combobox, Autocomplete, Navigation Menu, Date Picker, Date Range Picker and Time Picker show their element one update after they mount. So their `<Transition>` runs the enter with no `appear`. Do not give it `appear`: in a virtual DOM app, Vue then calls the JavaScript hooks of the enter twice. In a `disabled` portal, a popup that is open at the first render shows at once, as in the server HTML, with no enter. The popup of Drawer mounts at each open, so give its `<Transition>` `appear`.

When one of these popups opens again during its leave, it is the same element. Vue calls `leave-cancelled`, and a transition goes back from where it is. The backdrop does the same. Do not read the layout of the element, such as `offsetWidth`, in `leave-cancelled` or `before-enter`. During these hooks, the element has `display: none`, and a read of the layout ends its transition. The enter then starts from the `enter-from` class.

While an element leaves, the element that takes its place can already be in the DOM. To remove the element that leaves from the flow, give the `leave-active` class `position: absolute`.

When a panel opens again during its leave, the new panel enters after the leave ends.

Do not put a `<Transition>` around a part that renders the `element` slot. The root of the part is then the fragment of the slot, and Vue warns that it cannot animate it. Give the part `keepMounted`, and animate your element from its `state`, as in [Animate a popup that stays in the DOM](#animate-a-popup-that-stays-in-the-dom).

## CSS animations

Give the animations to the `enter-active` and `leave-active` classes. Give the enter and the leave each their own keyframes.

```css
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
}

@keyframes scaleOut {
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

.popup-enter-active {
  animation: scaleIn 250ms ease-out;
}

.popup-leave-active {
  animation: scaleOut 250ms ease-in;
}
```

An animation cannot go back from where it is. When a popup opens again during its leave, the leave animation stops, and the enter animation starts from its first keyframe. With one keyframes name and `reverse`, the browser keeps the animation at its time and turns its direction, so the popup jumps to another point.

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

A JavaScript animation library, such as [Motion for Vue](https://motion.dev/docs/vue) (the package `motion-v`), runs in the JavaScript hooks of the `<Transition>`. With `:css="false"`, the leave ends when the `leave` hook calls `done`. Use `@after-enter` and `@after-leave` for code that runs after an animation.

### Animate a popup that leaves the DOM

Without `keepMounted`, the popup of [Popover](/components/popover) is in the DOM only while the popover is open or leaves.

1. Give the popup its closed style in the style sheet.
2. Put `Popover.Popup` in a `<Transition>` with `:css="false"`.
3. In the `enter` hook, animate to the open style with `animate` of `motion-v`. In the `leave` hook, animate to the closed style. Each animation starts from the current style, so an open during the leave goes back from where it is.
4. Call `done` when the animation ends. The popup then leaves the DOM.

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

The popup of [Select](/components/select) mounts at the first focus of the trigger, the first open or the first autofill. Then it stays in the DOM, and it shows and hides its own element. Put a `<Transition>` around `Select.Popup`, with no `appear`. The hooks of the `<Transition>` then run at each open and each close. As for Popover, give the popup its closed style in the style sheet, and animate from the current style.

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
