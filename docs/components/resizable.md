---
order: 1
description: An unstyled Vue component for panels that a person resizes with a pointer or the keyboard.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

Panels that a person resizes with a handle, a pointer or the keyboard.

Base UI has no resizable panels. This one follows the [Window Splitter pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) of the WAI-ARIA Authoring Practices Guide.

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

## Anatomy

Import the component and assemble its parts:

<<< ./resizable/Anatomy.vue

Each panel and each handle must be a flex item of the root element. A wrapper element between them needs `display: contents`. The root gives its element `display: flex` and the direction of its `orientation`.

A panel needs an `id` only when a layout names it. A panel with no `id` gets a generated one. A handle resizes the panels beside it. Each part renders one `<div>`, or the tag or component of its `as` prop. The `element` slot renders an element of your own, and wins over `as`. A template ref on a part has `element`.

## Sizes and units

A size is a number, or a string of a number with a unit. A number, a string with no unit, such as `'30'`, and a string with `%`, such as `'30%'`, are percent of the panel space. The panel space is the room that the panels share: the room of the root, less the handles, the elements that are not panels, and the padding and the border of each panel.

A length is `px`, `em`, `rem`, `vh` or `vw`. `em` is the font size of the panel, and `rem` is the font size of the root element of the document. `vh` is 1% of `innerHeight`, which differs from the CSS `vh` on a phone while its toolbar shows.

A size in another form has no effect, and a development build shows a warning. A size prop then has its default, and the panel of an entry of the layout takes its `defaultSize`, or an equal share of the space that is left. An app can read a layout from a cookie or a storage, so the entries of a saved layout need no check.

<<< ./resizable/Sizes.vue

`defaultSize`, `minSize`, `maxSize`, `collapsedSize`, `collapseThreshold`, `snapPoints`, `snapTolerance` and the sizes of the layout take each of these forms. The `step`, `largeStep` and `dragStep` of the root take them too. There, `em` is the font size of the root. The panels with no `defaultSize` share the space that is left in equal parts.

## Collapsible panels

A panel with `collapsible` collapses to its `collapsedSize`, which is 0 by default. A drag collapses the panel when it goes below `minSize` by more than `collapseThreshold`. A drag expands a collapsed panel when it goes above `collapsedSize` by more than `collapseThreshold`. The default threshold is half of the distance between `collapsedSize` and `minSize`. The panel needs a `minSize` that is greater than its `collapsedSize`.

Enter on a handle collapses its primary panel when that panel is collapsible, or gives it its size again. `collapse()` and `expand()` of a template ref do the same from a script. The `state` of the default slot of the panel has `collapsed`. A `defaultSize` equal to the `collapsedSize` shows the panel collapsed at the start, with no event.

The size of a panel is its `flex-grow`, so a CSS transition of `flex-grow` animates a collapse. The panels get their sizes at the mount. Add the class of the transition in the second animation frame after the mount, so that it does not animate them. The root has `data-dragging` during a drag. Turn the transition off then, or each move of the pointer animates.

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

Three collapsible panels in a vertical root make an accordion. Each header button gets the state of its panel and asks the template ref of the panel to collapse or expand.

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

To hide a pane and keep it mounted, give it `collapsible` and a `collapsedSize` of 0, and call `collapse()`. Its content keeps its state.

## Fixed panels

A panel with `rootResizeBehavior="fixed"` keeps its pixels when the root changes size. The other panels share the rest in the ratio that they have. When the other panels cannot take a change of the root, the fixed panels give way in the order of `rootResizePriority`: the greater number first.

A drag, a key, a method and the layout of the app give a fixed panel new pixels. The layout of each event gives a fixed panel in pixels, with three decimals at the most, such as `'240px'`. Give that layout back to `v-model` or to `defaultLayout`, and each fixed panel gets its pixels again at each size of the root. The panels with a number share the rest in the ratio of their numbers.

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

## Snap points and the drag step

`snapPoints` gives a panel the sizes that a drag snaps to. A drag that comes within `snapTolerance` of a snap point gives the panel that size. The default tolerance is `'10px'`. `dragStep` on the root moves a dragged handle to the nearest multiple of its size. A key and a method do not snap, and they do not use `dragStep`.

For a snap rule of your own, call `details.cancel()` in `layoutChange` and write the layout that you want to `v-model`.

## Disabled panels

A move of a handle goes through a panel with `disabled` to the next panel, and leaves its size as it is. The methods of the panel and the layout of the root still change its size.

`disabled` on a handle stops that handle. `disabled` on the root stops each handle of the root. A disabled handle has `aria-disabled="true"` and no tab stop.

## Vertical

`orientation="vertical"` puts the panels in a column. The handles then have `aria-orientation="horizontal"`, and ArrowUp and ArrowDown move them.

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

## Nested groups

A root can be in a panel of another root. Each root keeps its own layout. Where the pointer target of a handle of one root meets the pointer target of a handle of the other root, a press drags both. Each handle at the crossing has `data-crossing` while the pointer is there. A layer over the page, such as a dialog, covers the handles under it.

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

## A handle with no size

A handle can have no size, such as a handle at the border of two panels. Its pointer target takes a press within 5 px of its center. The handle also has the keys, the focus and the role of each handle.

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

## Elements that are not panels

An element in the root that is not a panel or a handle, such as a toolbar, keeps its CSS size. The panel space does not hold it. A handle before the first panel or after the last panel moves nothing. It has no tab stop and no value, and its pointer target does not take a press. It has `data-at-min` and `data-at-max`, or `[aria-disabled="true"]` when it is disabled, so a style sheet can show that it cannot move.

## Panels that mount later

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

## Controlled layout

`v-model` makes the layout controlled. Start with an empty layout, `ref({})`, and each panel takes its `defaultSize`, or an equal share. Write `{}` to give each panel its first size again. `null` has the same effect as `{}`, and the layout stays controlled.

<<< ./resizable/ControlledLayout.vue

The layout is the layout that the app asks for. The panels show it as far as their constraints allow. A new object with the same entries changes nothing, so each fixed panel keeps its pixels until the next change of the layout.

The default slot of the root has `sizes`: the size of each mounted panel in percent, from the mount. Use it to show the sizes, or to make an `aria-valuetext`.

For equal sizes, give no size. For a preferred size, give a `defaultSize` and a `minSize`.

## Events

| Event               | Part  | When                                                                                |
| ------------------- | ----- | ----------------------------------------------------------------------------------- |
| `layoutChange`      | Root  | At each change of the user. Call `details.cancel()` to keep the layout as it is.    |
| `update:modelValue` | Root  | After each change that no listener cancelled, and after a change that no user made. |
| `layoutCommitted`   | Root  | At the end of a change of the user: the release of a drag, a key, a double click.   |
| `draggingChange`    | Root  | When a drag starts and when it ends.                                                |
| `collapsedChange`   | Panel | When the panel collapses or expands, after the DOM update.                          |

`details.reason` tells what the user did:

| Reason       | Change                     |
| ------------ | -------------------------- |
| `'drag'`     | A drag of a handle         |
| `'keyboard'` | A key on a handle          |
| `'reset'`    | A double click on a handle |

`details.event` is the native event. A method of a panel and a panel that mounts with no entry make a change that no user made: the root emits `update:modelValue` alone, as a native reset does. A size change of the root emits no layout event. To read the size of a panel in pixels, observe its `element` with a `ResizeObserver`.

## Methods of a panel

A template ref of a panel gives `collapse()`, `expand()`, `resize(size)` and `isCollapsed()`. A method does not snap, and it does not collapse another panel. It works on a disabled panel and in a disabled root.

<<< ./resizable/Actions.vue

In an uncontrolled root, a second method starts from the layout of the first. In a controlled root, each method starts from the layout of the parent, and the panel shows the change only after the parent writes it. Call a second method after `await nextTick()`, and read `isCollapsed()` after it.

A double click on a handle gives its primary panel the size of the first layout.

## Save the layout

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

## Resize at the release

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

A key, a double click and a method change the layout at once in both modes.

## Server render

The server HTML has the layout of all the parts: the size of each panel, and the value and the ends of each handle. A server cannot measure the page, so a panel whose first size is a length renders `flex: 0 1 <length>` until the first measurement, which comes after the mount. The other panels share the rest. Each handle of that root gets its value at the first measurement.

The first client render has what each part knows alone, so the server HTML and the first client render can differ in the style of a panel. A panel has `data-allow-mismatch="style"` until the root is mounted, so the hydration gives no message. The hydration moves no panel, and after the mount each attribute follows the client.

These can move at the mount:

- A panel below an async `setup` or in a lazy component. The panels beside it render the server HTML without it.
- A length constraint, such as `minSize="12rem"`, that the first layout breaks. A length constraint applies from the first measurement.
- A layout that the page reads after the mount, such as a layout in a storage.
- A handle that is not disabled, before the first panel or after the last panel. The server HTML gives it a tab stop and a pointer target that takes a press. After the mount, it has neither.

## Keyboard

| Key                    | Action                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Arrow keys             | Move the handle on the axis of the root by `step`, in the direction of the key on the screen. |
| Shift and an arrow key | Move the handle by `largeStep`.                                                               |
| Page Up and Page Down  | Grow and shrink the primary panel by `largeStep`.                                             |
| Home and End           | Give the primary panel its least and its greatest size.                                       |
| Enter                  | Collapse a collapsible primary panel, or give it its size again.                              |
| F6 and Shift+F6        | Move the focus to the first control of the next or the previous panel.                        |

The primary panel of a handle is the panel before it, or the panel after it with `primaryPanel="next"`. The handle prevents the default action of each key that it handles. A key with Ctrl, Alt or Meta stays a key of the browser.

F6 passes over a panel with a size of 0 and a panel with no control. A root in a panel of another root gives the key to that root after its last panel, or before its first panel with Shift+F6, so F6 goes on through the outer panels. A root that is not in a panel of another root goes on from its other end. A disabled root keeps F6, because F6 changes no size. To stop F6, call `event.preventDefault()` in a `keydown` listener in a panel, or in a capture listener of the root:

<<< ./resizable/StopF6.vue

## Accessibility

Each handle is a focusable `separator`. Give each handle a name that says which panel it resizes, such as `aria-label="Resize the navigation"`. Its value is the size of its primary panel in percent, and `aria-controls` names that panel.

With no value text, a screen reader reads the number of `aria-valuenow`. To give it words, bind `aria-valuetext` to a text that you make from `sizes` of the default slot of the root, in your own format. The handle has the attribute that you give.

The pointer target of a handle takes presses beyond the handle: at the least 10 px on the axis of the move. The CSS variable `--resizable-handle-hit-area-size` gives another least size. [WCAG 2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum) asks for a target of at least 24 by 24 CSS pixels, so set the variable to `24px` in `@media (pointer: coarse)`, as each demo does. A dialog or another element over a handle takes the press, as for each other control.

## Styling

The parts write no style sheet and no cursor, so a page with a Content Security Policy needs no nonce for them. Give each part a class, and style its states with its attributes:

- The root has `data-orientation`, `data-disabled` and `data-dragging`.
- A panel has `data-orientation`, `data-collapsed` and `data-disabled`, and the variable `--resizable-panel-size`.
- A handle has `[aria-orientation]`, `[aria-disabled="true"]`, `data-dragging`, `data-crossing`, `data-at-min` and `data-at-max`, and the variable `--resizable-handle-preview-offset`.

`data-at-min` means that the handle cannot move to the left, or up in a vertical root. `data-at-max` means that it cannot move to the right, or down. The sides are sides of the screen, also in a right-to-left root. A cursor of `e-resize` for `data-at-min` and `w-resize` for `data-at-max` thus shows the one way that the handle can move. A handle with both attributes cannot move, and the demos give it the cursor `default` except at a crossing, where a press moves the other handle.

The handle has `position: relative`, because it is the containing block of its pointer target, the last `<span>` in it. Do not give the handle `position: static`: the pointer target then has another place. Use `:hover` and `:focus-visible` on a handle for the states of the pointer and the keyboard. To show a grip, put it in the default slot of the handle. A press gives the handle the focus with no focus ring. A browser without the `focusVisible` option of `focus()` can show a ring for that focus.

## RTL

The root reads the direction of its own element. Set `dir="rtl"` on the root or on an element around it, so that the row of panels starts on the right. ArrowLeft then moves the handle to the left on the screen, as in a left-to-right root. A server reads only the `dir` attribute of `Resizable.Root`.

## API reference

<ApiReference />

## Additional types

### ResizableLayout

The size of each panel by panel `id`. An entry is a number in percent, or a string of a number with a unit, such as `'240px'`.

### ResizableRootResizeMode

<ApiReference name="ResizableRootResizeMode" />

### ResizableRootChangeEventReason

<ApiReference name="ResizableRootChangeEventReason" />

### ResizableRootChangeEventDetails

<ApiReference name="ResizableRootChangeEventDetails" />

### ResizableRootCommitEventDetails

<ApiReference name="ResizableRootCommitEventDetails" />
