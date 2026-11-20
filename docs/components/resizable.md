---
order: 1
description: An unstyled Vue resizable component that shows panels that a person resizes with a pointer or the keyboard.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoResizableAccordion from '../demos/resizable/accordion/css-modules/index.vue';
import DemoResizableAccordionTailwind from '../demos/resizable/accordion/tailwind/index.vue';
import DemoResizableCollapsible from '../demos/resizable/collapsible/css-modules/index.vue';
import DemoResizableCollapsibleTailwind from '../demos/resizable/collapsible/tailwind/index.vue';
import DemoResizableConditional from '../demos/resizable/conditional/css-modules/index.vue';
import DemoResizableConditionalTailwind from '../demos/resizable/conditional/tailwind/index.vue';
import DemoResizableEdges from '../demos/resizable/edges/css-modules/index.vue';
import DemoResizableEdgesTailwind from '../demos/resizable/edges/tailwind/index.vue';
import DemoResizableFixed from '../demos/resizable/fixed/css-modules/index.vue';
import DemoResizableFixedTailwind from '../demos/resizable/fixed/tailwind/index.vue';
import DemoResizableHero from '../demos/resizable/hero/css-modules/index.vue';
import DemoResizableHeroTailwind from '../demos/resizable/hero/tailwind/index.vue';
import DemoResizableNested from '../demos/resizable/nested/css-modules/index.vue';
import DemoResizableNestedTailwind from '../demos/resizable/nested/tailwind/index.vue';
import DemoResizableOnRelease from '../demos/resizable/on-release/css-modules/index.vue';
import DemoResizableOnReleaseTailwind from '../demos/resizable/on-release/tailwind/index.vue';
import DemoResizableStorage from '../demos/resizable/storage/css-modules/index.vue';
import DemoResizableStorageTailwind from '../demos/resizable/storage/tailwind/index.vue';
import DemoResizableVertical from '../demos/resizable/vertical/css-modules/index.vue';
import DemoResizableVerticalTailwind from '../demos/resizable/vertical/tailwind/index.vue';
</script>

# Resizable

Panels that a person resizes with a pointer or the keyboard on the handles between them.

<DemoFrame>
  <DemoResizableHero />
  <template #tailwind>
    <DemoResizableHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/resizable/hero/css-modules/index.vue

<<< ../demos/resizable/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/resizable/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Keep the parts flex items of the root.** Each panel and each handle must be a flex item of the root element. A wrapper element between them needs `display: contents`.
- **Name each handle.** Give each handle a name that says which panel it resizes, such as `aria-label="Resize the navigation"`.
- **Give the value words.** The value of a handle is the size of its primary panel in percent, and a screen reader reads it as a number. To give it words, bind `aria-valuetext` to a text from `sizes` of the default slot of the root. [Control the layout](#control-the-layout) shows how.
- **Give a coarse pointer a larger target.** The pointer target of a handle is at least 10 px on the axis of the move. [WCAG 2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum) asks for a target of at least 24 by 24 CSS pixels. Set `--resizable-handle-hit-area-size` to `24px` in `@media (pointer: coarse)`, as each demo does.

## Anatomy

Import the component and assemble its parts:

<<< ./resizable/Anatomy.vue

## Examples

### Sizes and units

A size is a number, or a string of a number with a unit. A number, a string with no unit, such as `'30'`, and a string with `%`, such as `'30%'`, are percent of the panel space. The panel space is the room of the root, less the handles, the elements that are not panels, and the padding and the border of each panel.

A length is `px`, `em`, `rem`, `vh` or `vw`. `em` is the font size of the panel, and `rem` is the font size of the root element of the document. `vh` is 1% of `innerHeight`, which differs from the CSS `vh` on a phone while its toolbar shows.

<<< ./resizable/Sizes.vue

Each size prop of a panel, each entry of the layout, and `step`, `largeStep` and `dragStep` of the root take these forms. In the props of the root, `em` is the font size of the root. For equal sizes, give no size. For a preferred size, give a `defaultSize` and a `minSize`.

A size in another form has no effect, and a development build shows a warning. A size prop then has its default. The panel of such an entry of the layout takes its `defaultSize`, or an equal share of the space that is left. A layout that the app reads from a cookie or a storage thus needs no check.

### Control the layout

`v-model` makes the layout controlled. Start with an empty layout, `ref({})`, and each panel takes its `defaultSize`, or an equal share. Write `{}` to give each panel its first size again.

<<< ./resizable/ControlledLayout.vue

The layout is the layout that the app asks for. The panels show it as far as their constraints allow. A new object with the same entries changes nothing, so each fixed panel keeps its pixels until the next change of the layout.

`sizes` of the default slot of the root has the size of each mounted panel in percent. The sample makes the `aria-valuetext` of the handle from it. To read the size of a panel in pixels, observe its `element` with a `ResizeObserver`.

### Collapse a panel

A panel with `collapsible` collapses to its `collapsedSize`, which is 0 by default. A drag collapses the panel when it goes below `minSize` by more than `collapseThreshold`. A drag expands a collapsed panel when it goes above `collapsedSize` by more than `collapseThreshold`. Enter on a handle collapses or expands its primary panel at once, as `collapse()` and `expand()` of a template ref do.

The size of a panel is its `flex-grow`, so a CSS transition of `flex-grow` animates a collapse. The panels get their sizes at the mount. Add the class of the transition in the second animation frame after the mount, so that it does not animate them. The root has `data-dragging` during a drag. Remove the transition then, or each move of the pointer animates.

<DemoFrame>
  <DemoResizableCollapsible />
  <template #tailwind>
    <DemoResizableCollapsibleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/resizable/collapsible/css-modules/index.vue

<<< ../demos/resizable/collapsible/css-modules/index.module.css

<<< ../demos/resizable/collapsible/css-modules/CollapseButton.vue

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/resizable/collapsible/tailwind/index.vue

<<< ../demos/resizable/collapsible/tailwind/CollapseButton.vue

:::

</DemoSource>

To hide a panel and keep it mounted, give it `collapsible` and a `collapsedSize` of 0, and call `collapse()`. Its content keeps its state.

### Accordion

Three collapsible panels in a vertical root make an accordion. Each header button gets the state of its panel, and calls `collapse()` or `expand()` of the template ref of the panel.

<DemoFrame>
  <DemoResizableAccordion />
  <template #tailwind>
    <DemoResizableAccordionTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/resizable/accordion/css-modules/index.vue

<<< ../demos/resizable/accordion/css-modules/index.module.css

<<< ../demos/resizable/accordion/css-modules/AccordionHeader.vue

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/resizable/accordion/tailwind/index.vue

<<< ../demos/resizable/accordion/tailwind/AccordionHeader.vue

:::

</DemoSource>

### Fixed panels

A panel with `rootResizeBehavior="fixed"` keeps its pixels when the root changes size. The other panels share the rest in the ratio that they have. When the other panels cannot take a change of the root, the fixed panels change size in the order of `rootResizePriority`: the greater number first.

A drag, a key, a method and the layout of the app give a fixed panel new pixels. The layout of each event gives a fixed panel in pixels, with three decimals at the most, such as `'240px'`. Give that layout back to `v-model` or to `defaultLayout`, and each fixed panel gets its pixels again at each size of the root.

<DemoFrame>
  <DemoResizableFixed />
  <template #tailwind>
    <DemoResizableFixedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/resizable/fixed/css-modules/index.vue

<<< ../demos/resizable/fixed/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/resizable/fixed/tailwind/index.vue

:::

</DemoSource>

### Vertical

`orientation="vertical"` puts the panels in a column.

<DemoFrame>
  <DemoResizableVertical />
  <template #tailwind>
    <DemoResizableVerticalTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/resizable/vertical/css-modules/index.vue

<<< ../demos/resizable/vertical/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/resizable/vertical/tailwind/index.vue

:::

</DemoSource>

### Nested roots

A root can be in a panel of another root. Each root keeps its own layout. Where a handle of one root crosses a handle of the other root, a press drags both handles. A layer over the page, such as a dialog, covers the handles under it.

<DemoFrame>
  <DemoResizableNested />
  <template #tailwind>
    <DemoResizableNestedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/resizable/nested/css-modules/index.vue

<<< ../demos/resizable/nested/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/resizable/nested/tailwind/index.vue

:::

</DemoSource>

### A handle with no size

A handle can have no size, such as a handle at the border of two panels. Its pointer target takes a press within 5 px of its center. The handle also has the keys, the focus and the role of each other handle.

<DemoFrame>
  <DemoResizableEdges />
  <template #tailwind>
    <DemoResizableEdgesTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/resizable/edges/css-modules/index.vue

<<< ../demos/resizable/edges/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/resizable/edges/tailwind/index.vue

:::

</DemoSource>

### Panels that mount later

A panel that mounts with no entry in the layout gets its `defaultSize`, or an equal share, and the other panels make room for it. The root then emits `update:modelValue` alone, so `v-model` follows. A panel that unmounts keeps its entry in the layout, so it gets its size again when it mounts again. A keyed list that moves its panels keeps the size of each panel. A panel that `KeepAlive` holds gives its room to the other panels, and gets it again when it shows.

<DemoFrame>
  <DemoResizableConditional />
  <template #tailwind>
    <DemoResizableConditionalTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/resizable/conditional/css-modules/index.vue

<<< ../demos/resizable/conditional/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/resizable/conditional/tailwind/index.vue

:::

</DemoSource>

### Resize a panel from a script

A template ref of a panel gives `collapse()`, `expand()`, `resize(size)` and `isCollapsed()`. A method does not snap, and it does not collapse another panel. It works on a disabled panel and in a disabled root.

<<< ./resizable/Actions.vue

In an uncontrolled root, a second method starts from the layout of the first. In a controlled root, each method starts from the layout of the parent, and the panel shows the change only after the parent writes it. Call a second method after `await nextTick()`, and read `isCollapsed()` after it.

### Save the layout

Give `v-model` a ref that you keep in a storage, so that the user gets the layout again at the next visit. Read the storage after the mount, because a server has no storage. Put `try` and `catch` around the read, `JSON.parse` and the write: a browser that blocks the data of the site throws. Save at `layoutCommitted` to write one time for each change of the user.

<DemoFrame>
  <DemoResizableStorage />
  <template #tailwind>
    <DemoResizableStorageTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/resizable/storage/css-modules/index.vue

<<< ../demos/resizable/storage/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/resizable/storage/tailwind/index.vue

:::

</DemoSource>

The layout of each event has the pixels of each fixed panel, so each fixed panel keeps its pixels. The page reads the storage after the mount, so the server HTML has the first layout, and the panels move to the stored layout at the mount. For an exact server HTML, keep the layout in a cookie and give it to `v-model`, as this Nuxt component does. The `useCookie` ref of Nuxt is a ref that the server reads too:

<<< ../../fixtures/nuxt/app/components/ResizableCookieLayout.vue

### Resize at the release

With `resizeMode="on-release"`, a drag leaves the layout as it is, and the release changes it one time. During the drag, each handle that the drag moves has the CSS variable `--resizable-handle-preview-offset`: the distance to the place that the release gives it. Use it to show a line at that place.

<DemoFrame>
  <DemoResizableOnRelease />
  <template #tailwind>
    <DemoResizableOnReleaseTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/resizable/on-release/css-modules/index.vue

<<< ../demos/resizable/on-release/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/resizable/on-release/tailwind/index.vue

:::

</DemoSource>

### Stop F6

F6 moves the focus from panel to panel, also in a disabled root. To stop it, call `event.preventDefault()` in a `keydown` listener in a panel, or in a capture listener of the root:

<<< ./resizable/StopF6.vue

### Render on the server

The server HTML has the layout of all the parts: the size of each panel, and the value and the ends of each handle. A server cannot measure the page, so a panel whose first size is a length renders `flex: 0 1 <length>` until the first measurement, which comes after the mount. The other panels share the rest. Each handle of that root gets its value at the first measurement. The hydration moves no panel and shows no message.

These can move at the mount:

- A panel below an async `setup` or in a lazy component. The panels beside it render the server HTML without it.
- A length constraint, such as `min-size="12rem"`, that the first layout breaks. A length constraint applies from the first measurement.
- A layout that the page reads after the mount, such as a layout in a storage.
- A handle that is not disabled, before the first panel or after the last panel. The server HTML gives it a tab stop and a pointer target that takes a press. After the mount, it has neither.

A server reads only the `dir` attribute of `Resizable.Root`. In a right-to-left page, set `dir="rtl"` on `Resizable.Root`, so that the server HTML has the correct `data-at-min` and `data-at-max` of each handle.

## Keyboard

| Key                          | Action                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrow keys                   | Move the handle on the axis of the root by `step`, in the direction of the key on the screen.                                                                                                                                                           |
| Shift and an arrow key       | Move the handle by `largeStep`.                                                                                                                                                                                                                         |
| Page Up and Page Down        | Grow and shrink the primary panel by `largeStep`.                                                                                                                                                                                                       |
| Home and End                 | Give the primary panel its least and its greatest size.                                                                                                                                                                                                 |
| Enter                        | Collapse a collapsible primary panel, or give it its size again.                                                                                                                                                                                        |
| F6 and Shift+F6              | Move the focus to the first control of the next or the previous panel. A panel with a size of 0 or with no control gets no focus. At its end, a root in a panel of another root gives the key to that root. Another root starts again at its other end. |
| A key with Ctrl, Alt or Meta | Nothing. The browser gets the key.                                                                                                                                                                                                                      |

## API reference

<ApiReference />

### ResizableLayout

The size of each panel by panel `id`. An entry is a number in percent, or a string of a number with a unit, such as `'240px'`.

### ResizableRootResizeMode

When a drag changes the layout: at each move, or one time at the release.

<ApiReference name="ResizableRootResizeMode" />

### ResizableRootChangeEventReason

The action of the user that changes the layout: `'drag'` is a drag of a handle, `'keyboard'` a key on a handle, and `'reset'` a double click on a handle.

<ApiReference name="ResizableRootChangeEventReason" />

### ResizableRootChangeEventDetails

The details of `layoutChange`.

<ApiReference name="ResizableRootChangeEventDetails" />

### ResizableRootCommitEventDetails

The details of `layoutCommitted`.

<ApiReference name="ResizableRootCommitEventDetails" />

## Differences from Base UI

<BaseUiDifferences />
