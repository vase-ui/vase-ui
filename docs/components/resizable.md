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

A panel needs an `id` only when a layout names it. A panel with no `id` gets a generated one. A handle resizes the panels beside it.

## Sizes and units

A size is a number, or a string of a number with a unit. A number, a string with no unit, such as `'30'`, and a string with `%`, such as `'30%'`, are percent of the panel space. The panel space is the room that the panels share: the room of the root, less the handles, the elements that are not panels, and the padding and the border of each panel.

A length is `px`, `em`, `rem`, `vh` or `vw`. `em` is the font size of the panel, and `rem` is the font size of the root element of the document. `vh` is 1% of `innerHeight`, which differs from the CSS `vh` on a phone while its toolbar shows. A size in another form throws an error that starts with `Vase UI:`. A layout is the exception, because an app can read it from a cookie or a storage. The root ignores an entry of a layout in another form, and the panel of the entry takes its `defaultSize`, or an equal share of the space that is left. A development build shows a warning.

<<< ./resizable/Sizes.vue

`defaultSize`, `minSize`, `maxSize`, `collapsedSize`, `collapseThreshold`, `snapPoints`, `snapTolerance` and the sizes of the layout take each of these forms. The `step`, `largeStep` and `dragStep` of the root take them too. There, `em` is the font size of the root. The panels with no `defaultSize` share the space that is left in equal parts.

## Collapsible panels

A panel with `collapsible` collapses to its `collapsedSize`, which is 0 by default. A drag collapses the panel when it goes below `minSize` by more than `collapseThreshold`. A drag expands a collapsed panel when it goes above `collapsedSize` by more than `collapseThreshold`. The default threshold is half of the distance between `collapsedSize` and `minSize`. The panel needs a `minSize` that is greater than its `collapsedSize`.

Enter on a handle collapses its primary panel when that panel is collapsible, or gives it back its size. `collapse()` and `expand()` do the same from a script. A `defaultSize` equal to the `collapsedSize` shows the panel collapsed at the start, with no event.

The size of a panel is its `flex-grow`, so a CSS transition of `flex-grow` animates a collapse. The root has `data-dragging` during a drag. Turn the transition off then, or each move of the pointer animates.

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

Three collapsible panels in a vertical root make an accordion. Each header button reads its panel with `Resizable.useParentPanel()`.

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

A drag, a key, a method and the layout of the app give a fixed panel new pixels. `details.snapshot` of `layoutCommitted` has the size of each fixed panel in whole pixels, such as `'240px'`. Give the snapshot to `layout` or to `defaultLayout`, and each fixed panel gets its pixels again.

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

For a snap rule of your own, call `details.cancel()` in `layoutChange` and write the layout that you want to `layout`.

## Disabled panels

A move of a handle goes through a panel with `disabled` to the next panel, and leaves its size as it is. The methods of the panel and the `layout` of the root still change its size.

`disabled` on a handle stops that handle. `disabled` on the root stops each handle and each edge of the root. A disabled handle has `aria-disabled="true"` and no tab stop.

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

A root can be in a panel of another root. Each root keeps its own layout. Where a handle of one root meets a handle or an edge of the other root, a press at the crossing drags both. Each handle at the crossing has `data-crossing` while the pointer is there.

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

## Edges with no handle

With `dragEdges`, an enabled root adds hit areas between panels where there is no handle and at least one enabled panel lies on each side. If a control separates the panels by more than the hit area size, each panel edge gets its own hit area. Drag either edge to resize the panels. The middle of the control stays clickable. `dragEdges` is off by default.

An edge works with a pointer only. It has no key, no focus, no ARIA role and no double click. Give a boundary a `Resizable.Handle` where you can. A handle can have a size of 0, because its hit area takes the press.

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

An element in the root that is not a panel or a handle, such as a toolbar, keeps its CSS size. The panel space does not hold it. A handle before the first panel or after the last panel moves nothing. It has no tab stop and no value, and its hit area does not take a press. It has `data-at-min` and `data-at-max`, or `data-disabled` when it is disabled, so a style sheet can show that it cannot move.

## Panels that mount later

A panel that mounts with no entry in the layout gets its `defaultSize`, or an equal share, and the other panels make room for it. The root then emits `layoutChange` with the reason `'none'`. A panel that unmounts keeps its entry in the layout, so it gets its size back when it mounts again. A keyed list that moves its panels keeps the size of each panel.

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

`v-model:layout` makes the layout controlled. Start with an empty layout, `ref({})`, and each panel takes its `defaultSize`, or an equal share. After the first change, the ref holds percent. Write `{}` to give each panel its `defaultSize`, or an equal share, again. `null` has the same effect as `{}`, and the layout stays controlled.

<<< ./resizable/ControlledLayout.vue

`layout` is the layout that the app asks for. The panels show it as far as their constraints allow, and each fixed panel keeps its pixels until the next change of the layout.

For equal sizes, give no size. For a preferred size, give a `defaultSize` and a `minSize`.

## Events

| Event             | Part  | When                                                                               |
| ----------------- | ----- | ---------------------------------------------------------------------------------- |
| `layoutChange`    | Root  | At each change of the layout. Call `details.cancel()` to keep the layout as it is. |
| `update:layout`   | Root  | After each change that no listener canceled. `v-model:layout` uses it.             |
| `layoutCommitted` | Root  | At the end of a change: the release of a drag, a key, a double click or a method.  |
| `draggingChange`  | Root  | When a drag starts and when it ends.                                               |
| `resize`          | Panel | When the size of the panel changes in percent or in pixels, after the DOM update.  |
| `collapsedChange` | Panel | When the panel collapses or expands, after the DOM update.                         |

A size change of the root emits no layout event. It changes the pixels of the panels, so each panel emits `resize`.

`details.reason` tells what made the change. `layoutCommitted` has each reason but `'none'`.

| Reason                | Change                             |
| --------------------- | ---------------------------------- |
| `'drag'`              | A drag of a handle or of an edge   |
| `'keyboard'`          | A key on a handle                  |
| `'reset'`             | A double click on a handle         |
| `'imperative-action'` | A method of a panel or of the root |
| `'none'`              | A panel that mounts with no entry  |

To tell a change of the user from a change of the app, read `details.reason`. `details.event` is the native event, or `new Event('vase-ui')` when there is none. `details` of `layoutCommitted` also has `snapshot`, the layout with the size of each fixed panel in pixels.

## Actions and composables

A template ref of the root gives `getLayout()`, `setLayout(layout)` and `reset()`. A template ref of a panel gives `collapse()`, `expand()`, `resize(size)`, `isCollapsed()` and `getSize()`. Each part also exposes its `element`.

`Resizable.useParentPanel()` gives the id, the state and the methods of the nearest panel above the caller. `Resizable.useParentRoot()` gives the orientation and the methods of the nearest root. Each gives `null` outside such a part.

<<< ./resizable/Actions.vue

<<< ./resizable/ResetLayoutButton.vue

A double click on a handle gives its primary panel the size of the first layout. For another action, call `event.preventVaseUIHandler()` in a `dblclick` listener of the handle, as the sample does to make the navigation fill the root.

## Save the layout

`Resizable.useLayoutStorage()` keeps the layout in a storage, so that the user gets it again at the next visit. Give `layout` to `v-model:layout` and `save` to `@layout-committed`. A commit comes one time for each change of the user, so the save needs no debounce.

| Option            | Default        | Description                                                          |
| ----------------- | -------------- | -------------------------------------------------------------------- |
| `key`             |                | The key of the item. A new key reads the item of that key.           |
| `storage`         | `localStorage` | A storage with `getItem` and `setItem`, such as `sessionStorage`.    |
| `userChangesOnly` | `false`        | Whether `save` ignores a change of a method (`'imperative-action'`). |

The composable ignores an item that is not a layout, and a storage that throws, such as the `localStorage` of a browser that blocks the data of the site. It writes the `snapshot` of each commit, so each fixed panel keeps its pixels.

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

The composable reads the storage after the mount, because a server has no storage. The server HTML thus has the default layout, and the panels move to the stored layout at the mount. For an exact server HTML, keep the layout in a cookie and give it to `defaultLayout`, as this Nuxt component does. The component does not check the cookie, because the root ignores an entry that is not a size:

<<< ../../fixtures/nuxt/app/components/ResizableCookieLayout.vue

## Resize at the release

With `resizeMode="on-release"`, a drag leaves the layout as it is, and the release changes it one time. During the drag, each handle and edge that the drag moves has the CSS variable `--resizable-handle-preview-offset`: the distance to the place that the release gives it. Use it to show a line at that place.

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

The server HTML has the layout of each mix of sizes in percent. A server cannot measure the page, so a panel whose first size is a length renders `flex: 0 1 <length>` until the first measurement, which comes after the mount. The other panels share the rest. With a length panel, give the other panels no default size, or give each of them but one a length. The rectangles of the server HTML are then the rectangles after the mount.

These can move at the mount:

- A panel below an async `setup` or in a lazy component. Its root renders the server HTML without it.
- A length constraint, such as `minSize="12rem"`, that the first layout breaks. A length constraint applies from the first measurement.
- The stored layout of `Resizable.useLayoutStorage()`.
- The hit area, when the main pointer is coarse. The server HTML has the `fine` size.
- The value attributes of each handle of a root with a length panel. A handle gets its value at the first measurement.
- The `aria-valuetext` of `getAriaValueText` when it uses `pixelSize` or the locale. `pixelSize` is `undefined` and the locale is `en-US` until the mount.
- The state of a handle that is not disabled, before the first panel or after the last panel. The server HTML gives it a tab stop, a hit area that takes a press and no end attribute. After the mount, it has no tab stop, its hit area does not take a press, and it has `data-at-min` and `data-at-max`.

## Keyboard

| Key                    | Action                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Arrow keys             | Move the handle on the axis of the root by `step`, in the direction of the key on the screen. |
| Shift and an arrow key | Move the handle by `largeStep`.                                                               |
| Page Up and Page Down  | Grow and shrink the primary panel by `largeStep`.                                             |
| Home and End           | Give the primary panel its least and its greatest size.                                       |
| Enter                  | Collapse a collapsible primary panel, or give it back its size.                               |
| F6 and Shift+F6        | Move the focus to the first control of the next or the previous panel.                        |

The primary panel of a handle is the panel before it, or the panel after it with `primaryPanel="next"`.

F6 passes over a panel with a size of 0 and a panel with no control. A root in a panel of another root gives the key to that root after its last panel, or before its first panel with Shift+F6, so F6 goes on through the outer panels. A root that is not in a panel of another root goes on from its other end. A disabled root keeps F6, because F6 changes no size. To stop F6, call `event.preventVaseUIHandler()` in a `keydown` listener of the root:

<<< ./resizable/StopF6.vue

The key still goes on to a root around it, and then to the browser. To stop the key for each root and for the browser, call `event.preventDefault()`.

## Accessibility

Each handle is a focusable `separator`. Give each handle a name that says which panel it resizes, such as `aria-label="Resize the navigation"`. Its value is the size of its primary panel in percent, and `aria-controls` names that panel.

With no value text, a screen reader reads the number of `aria-valuenow`. To give it words, such as the size in pixels, use `getAriaValueText`. It gets the size as text in the locale of the browser, such as `'30%'`, the size as a number, and `{ collapsed, pixelSize }`. `ariaValuetext` gives one fixed text. A handle has `aria-valuetext` only while it has `aria-valuenow`.

The hit area of a handle takes presses beyond the handle. `hitAreaSize` is its least size on the axis of the move, by default `{ fine: 10, coarse: 24 }` pixels. The root uses `coarse` while the main pointer of the device is coarse, such as a finger. [WCAG 2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum) asks for a target of at least 24 by 24 CSS pixels. Give `hitAreaSize` a number to use one size for each pointer. A dialog or another element over a handle takes the press, as for each other control.

An edge has no key. Keep a handle at each boundary that a keyboard user must resize.

## Styling

The parts write no style sheet and no cursor, so a page with a Content Security Policy needs no nonce for them. Give each part a class, and style its states with its data attributes:

- The root has `data-orientation`, `data-disabled` and `data-dragging`.
- A panel has `data-orientation`, `data-collapsed` and `data-disabled`, and the variable `--resizable-panel-size`.
- A handle has `data-orientation`, `data-disabled`, `data-dragging`, `data-crossing`, `data-at-min` and `data-at-max`, and the variable `--resizable-handle-preview-offset`.

`data-at-min` means that the handle cannot move to the left, or up in a vertical root. `data-at-max` means that it cannot move to the right, or down. The sides are sides of the screen, also in a right-to-left root. A cursor of `e-resize` for `data-at-min` and `w-resize` for `data-at-max` thus shows the one way that the handle can move. A handle with both attributes cannot move, and the demos give it the cursor `default` except at a crossing, where a press moves the other handle.

The handle has `position: relative`, because it is the containing block of its hit area. Do not give it `position: static`: the hit area then has another place. A root with `dragEdges` has `position: relative` too, and its edge nodes are `[data-vase-ui-resizable-edge]` elements in it. An edge node has `data-orientation`, `data-dragging`, `data-crossing`, `data-at-min` and `data-at-max`. Use `:hover` and `:focus-visible` on a handle for the states of the pointer and the keyboard. To show a grip, put it in the default slot of the handle.

## RTL

The root reads the direction from [`DirectionProvider`](/utils/direction-provider). Also set `dir="rtl"` on an element around the root, so that the row of panels starts on the right. ArrowLeft then moves the handle to the left on the screen, as in a left-to-right root.

## API reference

<ApiReference />

### Resizable.useParentPanel

Gives the id, the state and the methods of the nearest panel above the caller, or `null` outside a panel. Call it in `setup`.

<ApiReference name="Resizable.useParentPanel" :heading-level="4" />

### Resizable.useParentRoot

Gives the orientation and the methods of the nearest root above the caller, or `null` outside a root. Call it in `setup`.

<ApiReference name="Resizable.useParentRoot" :heading-level="4" />

### Resizable.useLayoutStorage

Keeps the layout of a root in a storage. Call it in `setup`. See [Save the layout](#save-the-layout).

<ApiReference name="Resizable.useLayoutStorage" :heading-level="4" />

## Additional types

### Resizable.Root.ResizeMode

<ApiReference name="Resizable.Root.ResizeMode" />

### Resizable.Root.ChangeEventReason

<ApiReference name="Resizable.Root.ChangeEventReason" />

### Resizable.Root.CommitEventReason

<ApiReference name="Resizable.Root.CommitEventReason" />

### Resizable.Root.Actions

<ApiReference name="Resizable.Root.Actions" />

### Resizable.Panel.Size

<ApiReference name="Resizable.Panel.Size" />

### Resizable.Panel.Actions

<ApiReference name="Resizable.Panel.Actions" />

### ResizableParentPanel

<ApiReference name="ResizableParentPanel" />

### ResizableParentRoot

<ApiReference name="ResizableParentRoot" />

### ResizableLayoutStorageOptions

<ApiReference name="ResizableLayoutStorageOptions" />

### ResizableLayoutStorageReturnValue

<ApiReference name="ResizableLayoutStorageReturnValue" />
