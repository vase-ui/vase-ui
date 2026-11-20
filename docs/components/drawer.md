---
order: 1
description: An unstyled Vue drawer component with swipe-to-dismiss gestures.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
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

## Examples

### State

By default, Drawer is an uncontrolled component that keeps its own state.

<<< ./drawer/UncontrolledDrawer.vue

To read or control the open state, bind it with `v-model:open`.

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

Use the `[data-nested-drawer-open]` selector and the `--nested-drawers` CSS variable to style a drawer while a nested drawer is open. A drawer is nested when its `Drawer.Root` is in another `Drawer.Root`.

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

Use `snapPoints` to snap a bottom sheet to preset heights. A number from 0 to 1 is a fraction of the viewport height, and a number greater than 1 is a number of pixels. A string can have the unit `px` or `rem`, such as `'148px'` or `'30rem'`. Bind the active snap point with `v-model:snap-point`.

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

By default, a fast swipe can skip snap points. Set `snapToSequentialPoints` to stop this. The distance of the drag then sets the snap point, and a drag can still go past more than one point.

### Virtual keyboard aware

Put a bottom sheet with form controls in `Drawer.VirtualKeyboardProvider`. When a software keyboard opens, the provider scrolls the body of the drawer to keep the focused field visible.

- **Keep the frame of the popup stable**: put the header and the footer outside a plain scrollable body.
- **Lift an input that is fixed in the footer**: reserve a footer slot below the scroll area, and offset it by `var(--drawer-keyboard-inset, 0px)`. When the input in the footer has the focus, the demo gives the footer `position: fixed` and adds the inset to its bottom padding. The `transform` of the popup makes the popup the container of the fixed footer.
- **Always include the `0px` fallback**: the provider sets `--drawer-keyboard-inset` only while the keyboard covers the layout viewport. A plain `var(--drawer-keyboard-inset)` is thus not valid at other times.
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

Put the backdrop and the popup each in a `<Transition appear>`, and use its classes to animate the open, the close, the swipe and the stack. A swipe that closes the drawer leaves the popup at the place of the drag, and the leave starts from there.

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

Use `--drawer-swipe-progress` to fade the backdrop during a swipe, and `--drawer-swipe-strength` to scale the duration of the leave by the speed of the swipe.

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

## API reference

<ApiReference />

### createHandle

Makes a handle that connects a `Drawer.Root` to `Drawer.Trigger` parts outside it.

<ApiReference name="Drawer.createHandle" :heading-level="4" />

### Handle

The class of the handle, which opens and closes the drawer from code.

<ApiReference name="Drawer.Handle" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
