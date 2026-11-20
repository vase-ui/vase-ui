---
order: 1
description: An unstyled Vue drawer component with swipe-to-dismiss gestures.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoDrawerHero from '../demos/drawer/hero/css-modules/index.vue';
import DemoDrawerHeroTailwind from '../demos/drawer/hero/tailwind/index.vue';
import DemoDrawerIndentProvider from '../demos/drawer/indent-provider/css-modules/index.vue';
import DemoDrawerIndentProviderTailwind from '../demos/drawer/indent-provider/tailwind/index.vue';
import DemoDrawerNested from '../demos/drawer/nested/css-modules/index.vue';
import DemoDrawerNestedTailwind from '../demos/drawer/nested/tailwind/index.vue';
import DemoDrawerNonModal from '../demos/drawer/non-modal/css-modules/index.vue';
import DemoDrawerNonModalTailwind from '../demos/drawer/non-modal/tailwind/index.vue';
import DemoDrawerPosition from '../demos/drawer/position/css-modules/index.vue';
import DemoDrawerPositionTailwind from '../demos/drawer/position/tailwind/index.vue';
import DemoDrawerSnapPoints from '../demos/drawer/snap-points/css-modules/index.vue';
import DemoDrawerSnapPointsTailwind from '../demos/drawer/snap-points/tailwind/index.vue';
import DemoDrawerSwipeArea from '../demos/drawer/swipe-area/css-modules/index.vue';
import DemoDrawerSwipeAreaTailwind from '../demos/drawer/swipe-area/tailwind/index.vue';
import DemoDrawerVirtualKeyboardAware from '../demos/drawer/virtual-keyboard-aware/css-modules/index.vue';
import DemoDrawerVirtualKeyboardAwareTailwind from '../demos/drawer/virtual-keyboard-aware/tailwind/index.vue';
</script>

# Drawer

A panel that slides in from the edge of the screen.

<DemoFrame>
  <DemoDrawerHero />
  <template #tailwind>
    <DemoDrawerHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/drawer/hero/css-modules/index.vue

<<< ../demos/drawer/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/drawer/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Drawer extends [Dialog](/components/dialog)**: It adds swipe gestures, snap points and indent effects. If you do not need these, use Dialog. A panel that slides in from the edge of the screen and needs no swipe gestures is a positioned Dialog.

## Anatomy

Import the component and assemble its parts:

<<< ./drawer/Anatomy.vue

A swipe dismisses the drawer. Set `swipeDirection` to control which direction dismisses it. `Drawer.Content` lets a mouse pointer select its text, and that selection starts no swipe.

Add `data-vase-ui-swipe-ignore` to a descendant to stop the swipe dismissal on it for all input types. If the element handles touch drags on one axis only, such as a carousel, set the value to `x` or `y`. A touch drag on the other axis then still swipes the drawer.

Use `Drawer.VirtualKeyboardProvider` when a bottom sheet holds form fields and you want Vase UI to move the focus and scroll the content for a software keyboard. A drawer without this provider does not change.

## Styling

Select the states of the parts with these selectors:

| Selector                       | On                          | State                                                                             |
| ------------------------------ | --------------------------- | --------------------------------------------------------------------------------- |
| `[aria-expanded="true"]`       | trigger                     | The drawer is open for this trigger.                                              |
| `:disabled`                    | trigger, close              | The button is disabled. A part that is not a button has `[aria-disabled="true"]`. |
| `[hidden]`                     | popup, backdrop, viewport   | The drawer is closed, with `keepMounted`.                                         |
| `[data-nested]`                | viewport                    | A dialog root or a drawer root is above the root of this drawer.                  |
| `[data-swipe-direction]`       | popup, swipe area           | The direction of the swipe that closes the drawer, or that opens it on the area.  |
| `[data-swiping]`               | popup, backdrop, swipe area | A swipe moves the popup.                                                          |
| `[data-swipe-dismiss]`         | popup, backdrop             | The part leaves after a swipe.                                                    |
| `[data-expanded]`              | popup                       | The drawer is at the snap point `1`.                                              |
| `[data-nested-drawer-open]`    | popup                       | A drawer in this drawer is open.                                                  |
| `[data-nested-drawer-swiping]` | popup                       | A swipe moves a drawer in this drawer.                                            |
| `[data-open]`                  | swipe area                  | The drawer is open. Use `:not([data-open])` for a closed drawer.                  |
| `[data-disabled]`              | swipe area                  | The swipe area opens nothing.                                                     |
| `[data-active]`                | indent, indent background   | A drawer of the provider is open.                                                 |

`Drawer.Viewport` stays in the DOM while its popup leaves. To select its leave, use `:has(> .sheet-leave-active)`, with the leave class of the `<Transition>` around the popup.

The popup sets `--drawer-swipe-movement-x`, `--drawer-swipe-movement-y`, `--drawer-snap-point-offset`, `--drawer-swipe-strength` and `--nested-drawers`. While a drawer in it is open, it also sets `--drawer-height`, `--drawer-frontmost-height` and the `--drawer-swipe-progress` of that drawer. The backdrop and `Drawer.Indent` set `--drawer-swipe-progress`, and `--drawer-height` while a swipe has a progress. `--drawer-swipe-strength` is `1`, except in the leave after a swipe.

## Touch

A touch drag on the popup goes to the swipe or to the browser. The drawer decides at the first move that is 6 px from the start:

- A move that is more across the axis of the drawer than along it stays with the browser.
- In a scroller on the axis of the drawer, the swipe takes the drag only when the scroller is at its edge and the finger moves toward the closed place. Else the scroller scrolls.
- Else the swipe takes the drag.

A touch starts a swipe also on a button, a field or `Drawer.Content`. A touch starts no swipe on a range input, or while the popup has a text selection. A touch that starts outside the popup moves the popup from the point where the finger comes into it.

A mouse or a pen starts a swipe only in the popup. It starts none on a control, in `Drawer.Content`, or in a scroller on the axis of the drawer.

## Back gesture

On Android, in a browser with `CloseWatcher`, the back gesture closes the top open drawer with the reason `'close-watcher'`. A listener that cancels the change keeps the drawer open, unless the browser does not let a page cancel the gesture.

## Server render

`Drawer.Portal` renders its content after its mount, as `Dialog.Portal` does. The server HTML thus has the triggers and the swipe area only. The popup of an open root comes one update after the mount. With `disabled` on `Drawer.Portal`, the content renders in place, also on the server. `Drawer.Provider` is not active in the server HTML. It becomes active after the mount of an open root.

## Examples

### State

By default, Drawer is an uncontrolled component that manages its own state.

<<< ./drawer/UncontrolledDrawer.vue

To control the open state, give `open` to `Drawer.Root` and listen to its `openChange` event, or use `v-model:open`. The root emits `openChange` with the new state and `eventDetails`, and then `update:open`. To stop the change, call `eventDetails.cancel()` before the `openChange` listener returns.

<<< ./drawer/ControlledDrawer.vue{5,9}

### Position

Your styles position the drawer. `swipeDirection` is `"down"` by default, for a bottom sheet. Use `"up"`, `"left"` or `"right"` for the other positions.

<<< ./drawer/SwipeDirection.vue{6}

<DemoFrame>
  <DemoDrawerPosition />
  <template #tailwind>
    <DemoDrawerPositionTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/drawer/position/css-modules/index.vue

<<< ../demos/drawer/position/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/drawer/position/tailwind/index.vue

:::

</DemoSource>

### Nested drawers

Use the `[data-nested-drawer-open]` selector and the `--nested-drawers` CSS variable to style a drawer while a nested drawer is open.

These values follow the component tree: a `Drawer.Root` in a `Drawer.Root` is a nested drawer. A drawer that a handle opens from another tree is no nested drawer. The `nestedDialogOpen` state of the viewport follows the stack: a dialog or a drawer is open above this drawer.

This demo stacks nested drawers with a constant peek. The frontmost drawer stays at the bottom, and the drawers behind it become smaller and move up. The demo also uses the `--drawer-height` and `--drawer-frontmost-height` CSS variables for drawers of different heights.

<DemoFrame>
  <DemoDrawerNested />
  <template #tailwind>
    <DemoDrawerNestedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/drawer/nested/css-modules/index.vue

<<< ../demos/drawer/nested/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/drawer/nested/tailwind/index.vue

:::

</DemoSource>

### Snap points

Use `snapPoints` to snap a bottom sheet to preset heights. A number from 0 to 1 is a fraction of the viewport height, and a number greater than 1 is a number of pixels. A string can have the unit `px` or `rem`, such as `'148px'` or `'30rem'`.

Bind the active snap point with `v-model:snap-point`. The root emits `snapPointChange` with the new snap point and `eventDetails`, and then `update:snapPoint`.

<<< ./drawer/SnapPoints.vue{5-6,10}

Apply the snap point offset in your styles for a vertical drawer:

```css
.DrawerPopup {
  transform: translateY(calc(var(--drawer-snap-point-offset) + var(--drawer-swipe-movement-y)));
}
```

<DemoFrame>
  <DemoDrawerSnapPoints />
  <template #tailwind>
    <DemoDrawerSnapPointsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/drawer/snap-points/css-modules/index.vue

<<< ../demos/drawer/snap-points/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/drawer/snap-points/tailwind/index.vue

:::

</DemoSource>

By default, a fast swipe can skip snap points. Set the `snapToSequentialPoints` prop to stop this. The distance of the drag then decides the snap point, and a drag can still pass more than one point.

### Virtual keyboard aware

Put a bottom sheet with form controls in `Drawer.VirtualKeyboardProvider`. When a software keyboard opens, the provider scrolls the body of the drawer to keep the focused field visible.

- **Keep the frame of the popup stable**: put the header and the footer outside a plain scrollable body.
- **Lift an input that is fixed in the footer**: reserve a footer slot below the scroll area, and offset it by `var(--drawer-keyboard-inset, 0px)`. When the input in the footer has the focus, the demo gives the footer `position: fixed` and adds the inset to its bottom padding. The `transform` of the popup makes the popup the container of the fixed footer.
- **Always include the `0px` fallback**: the provider sets `--drawer-keyboard-inset` only while the keyboard is aligned. A plain `var(--drawer-keyboard-inset)` is thus not valid before the first alignment and after the cleanup.
- **Bind no `padding-bottom` on the scroll body**: the provider gives the scroll body room below its content with `padding-bottom`. Vue writes a bound `padding-bottom` again at each render, and that removes the room.

<<< ./drawer/VirtualKeyboard.vue{8,18}

<DemoFrame>
  <DemoDrawerVirtualKeyboardAware />
  <template #tailwind>
    <DemoDrawerVirtualKeyboardAwareTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/drawer/virtual-keyboard-aware/css-modules/index.vue

<<< ../demos/drawer/virtual-keyboard-aware/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/drawer/virtual-keyboard-aware/tailwind/index.vue

:::

</DemoSource>

### Indent effect

To make the background smaller when a drawer opens, put your app in `Drawer.Provider`, and put `Drawer.IndentBackground` and `Drawer.Indent` at the top of your tree. Each `Drawer.Root` in the provider tells the provider when it opens and closes. While a drawer is open, the indent parts have the attribute `data-active`.

<DemoFrame>
  <DemoDrawerIndentProvider />
  <template #tailwind>
    <DemoDrawerIndentProviderTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/drawer/indent-provider/css-modules/index.vue

<<< ../demos/drawer/indent-provider/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/drawer/indent-provider/tailwind/index.vue

:::

</DemoSource>

### Non-modal

Set `:modal="false"` to keep the focus free, and set `disablePointerDismissal` to keep the drawer open at a press outside it.

<DemoFrame>
  <DemoDrawerNonModal />
  <template #tailwind>
    <DemoDrawerNonModalTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/drawer/non-modal/css-modules/index.vue

<<< ../demos/drawer/non-modal/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/drawer/non-modal/tailwind/index.vue

:::

</DemoSource>

### Swipe to open

Put `Drawer.SwipeArea` along the edge of the viewport. A swipe from that edge then opens the drawer.

<DemoFrame>
  <DemoDrawerSwipeArea />
  <template #tailwind>
    <DemoDrawerSwipeAreaTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/drawer/swipe-area/css-modules/index.vue

<<< ../demos/drawer/swipe-area/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/drawer/swipe-area/tailwind/index.vue

:::

</DemoSource>

### Detached triggers

A trigger can be inside or outside `Drawer.Root`. For a simple interaction, put `Drawer.Trigger` inside `Drawer.Root`.

When the content of the drawer cannot be next to its trigger, use a detached trigger. Put `Drawer.Trigger` outside `Drawer.Root`, and connect the two with a handle from `Drawer.createHandle()`.

The methods of the handle, such as `open()` and `openWithPayload()`, act only while a `Drawer.Root` with the same handle is mounted. The handle ignores a call before a root mounts or after it unmounts. Each root that mounts starts from a new state. It does not run an ignored call, and it does not keep the open state of an earlier root.

<<< ./drawer/DetachedTriggers.vue{4,8,10}

The drawer can show different content for each trigger. Give a `payload` to each `Drawer.Trigger`. The default slot of `Drawer.Root` gets the `payload` of the active trigger.

<<< ./drawer/DetachedTriggersPayload.vue{4,8-9,11-12,17}

### Stacking and animations

The backdrop and the popup are in the DOM only while the drawer is open. Put each of them in a `<Transition appear>`, and animate the open and the close with the classes of `<Transition>`. A swipe that closes the drawer leaves the popup at the place of the drag, and the leave goes on from there.

The `--nested-drawers` CSS variable gives the depth in the stack. The frontmost drawer has the index `0`.

```css
.DrawerPopup {
  --stack-step: 0.05;
  --stack-scale: calc(1 - (var(--nested-drawers) * var(--stack-step)));
  transform: translateY(var(--drawer-swipe-movement-y)) scale(var(--stack-scale));
}
```

When the drawers of a stack have different heights, use the `--drawer-height` and `--drawer-frontmost-height` variables to align the drawers behind the frontmost one with it.

```css
.DrawerPopup {
  --bleed: 3rem;
  --stack-height: max(
    0px,
    calc(var(--drawer-frontmost-height, var(--drawer-height)) - var(--bleed))
  );
  height: var(--drawer-height, auto);
}

.DrawerPopup[data-nested-drawer-open] {
  height: calc(var(--stack-height) + var(--bleed));
  overflow: hidden;
}
```

The attribute `data-nested-drawer-open` marks the drawers behind the frontmost drawer. Use it with `data-nested-drawer-swiping` to dim or hide the content of a parent drawer, and to show it again during a swipe of the nested drawer.

```css
.DrawerContent {
  transition: opacity 300ms;
}

.DrawerPopup[data-nested-drawer-open] .DrawerContent {
  opacity: 0;
}

.DrawerPopup[data-nested-drawer-open][data-nested-drawer-swiping] .DrawerContent {
  opacity: 1;
}
```

Use the `--drawer-swipe-movement-x`, `--drawer-swipe-movement-y` and `--drawer-snap-point-offset` CSS variables for smooth drag and snap offsets:

```css
.DrawerPopup[data-swipe-direction='right'] {
  transform: translateX(var(--drawer-swipe-movement-x));
}

.DrawerPopup[data-swipe-direction='down'] {
  transform: translateY(calc(var(--drawer-snap-point-offset) + var(--drawer-swipe-movement-y)));
}
```

Use the `data-swipe-direction` attribute with the leave class of `<Transition name="sheet">` to animate the dismissal in its direction. After a swipe, the popup and the backdrop also have `data-swipe-dismiss` in their leave.

```css
.sheet-leave-to[data-swipe-direction='right'] {
  transform: translateX(100%);
}

.sheet-leave-to[data-swipe-direction='down'] {
  transform: translateY(100%);
}
```

Use `--drawer-swipe-progress` to fade the backdrop during a swipe, and `--drawer-swipe-strength` to scale the duration of the release transition by the speed of the swipe.

```css
.DrawerBackdrop {
  --backdrop-opacity: 0.2;
  opacity: calc(var(--backdrop-opacity) * (1 - var(--drawer-swipe-progress)));
}

.sheet-leave-active,
.fade-leave-active {
  transition-duration: calc(var(--drawer-swipe-strength) * 400ms);
}

.DrawerPopup[data-swiping],
.DrawerBackdrop[data-swiping] {
  transition-duration: 0ms;
}
```

## Portal target

Set `to` on `Drawer.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />

## createHandle

Creates a handle that connects a `Drawer.Root` with detached `Drawer.Trigger` parts. The type argument of the function is the type of the payload.

<ApiReference name="Drawer.createHandle" :heading-level="3" />

### Handle

`Drawer.Handle` is the class of the handle.

<ApiReference name="Drawer.Handle" :heading-level="4" />

`open(null)`, and an `id` that no trigger has, open the drawer with no trigger. A `computed` that reads `isOpen` follows the open state.
