---
order: 1
description: An unstyled Vue dialog component that opens on top of the entire page.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoDialogDetachedTriggersControlled from '../demos/dialog/detached-triggers-controlled/css-modules/index.vue';
import DemoDialogDetachedTriggersControlledTailwind from '../demos/dialog/detached-triggers-controlled/tailwind/index.vue';
import DemoDialogDetachedTriggersSimple from '../demos/dialog/detached-triggers-simple/css-modules/index.vue';
import DemoDialogDetachedTriggersSimpleTailwind from '../demos/dialog/detached-triggers-simple/tailwind/index.vue';
import DemoDialogFocusManagement from '../demos/dialog/focus-management/css-modules/index.vue';
import DemoDialogFocusManagementTailwind from '../demos/dialog/focus-management/tailwind/index.vue';
import DemoDialogHero from '../demos/dialog/hero/css-modules/index.vue';
import DemoDialogHeroTailwind from '../demos/dialog/hero/tailwind/index.vue';
import DemoDialogInsideScroll from '../demos/dialog/inside-scroll/css-modules/index.vue';
import DemoDialogInsideScrollTailwind from '../demos/dialog/inside-scroll/tailwind/index.vue';
import DemoDialogNested from '../demos/dialog/nested/css-modules/index.vue';
import DemoDialogNestedTailwind from '../demos/dialog/nested/tailwind/index.vue';
import DemoDialogOpenFromMenu from '../demos/dialog/open-from-menu/css-modules/index.vue';
import DemoDialogOpenFromMenuTailwind from '../demos/dialog/open-from-menu/tailwind/index.vue';
import DemoDialogOutsideScroll from '../demos/dialog/outside-scroll/css-modules/index.vue';
import DemoDialogOutsideScrollTailwind from '../demos/dialog/outside-scroll/tailwind/index.vue';
import DemoDialogUncontained from '../demos/dialog/uncontained/css-modules/index.vue';
import DemoDialogUncontainedTailwind from '../demos/dialog/uncontained/tailwind/index.vue';
</script>

# Dialog

A popup that opens on top of the entire page.

<DemoFrame>
  <DemoDialogHero />
  <template #tailwind>
    <DemoDialogHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/dialog/hero/css-modules/index.vue

<<< ../demos/dialog/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/dialog/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Dialog does not support gestures**: Use [Drawer](/components/drawer) for gestures or snap points. A panel that slides in from the edge of the screen and needs no gestures is a Dialog with a position.

## Anatomy

Import the component and assemble its parts:

<<< ./dialog/Anatomy.vue

Give the `z-index` of the dialog to `Dialog.Viewport`, or to `Dialog.Popup` when the dialog has no viewport: see [Portals](/quick-start#portals).

## Examples

### State

By default, Dialog is an uncontrolled component that keeps its own state.

<<< ./dialog/Uncontrolled.vue

To read or control the open state, bind it with `v-model:open`. You can then open the dialog from another place in your app. This dialog closes when the user submits its form:

<<< ./dialog/Controlled.vue{7,10-13,17}

To run code when the dialog opens or closes, listen to the `openChange` event of `Dialog.Root`:

<<< ./dialog/OpenChange.vue{9-16,20}

### Nested dialogs

You can put a dialog in another dialog.

To style the parent dialog while a nested dialog is open, use the `[data-nested-dialog-open]` selector and the `--nested-dialogs` CSS variable. A nested dialog renders no backdrop unless its backdrop has `forceRender`, so the parent dialog stays clear behind the dialog on top of it.

<DemoFrame>
  <DemoDialogNested />
  <template #tailwind>
    <DemoDialogNestedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/dialog/nested/css-modules/index.vue

<<< ../demos/dialog/nested/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/dialog/nested/tailwind/index.vue

:::

</DemoSource>

### Custom focus management

The `initialFocus` and `finalFocus` props of `Dialog.Popup` set the element that gets the focus when the dialog opens and when it closes.

Set a prop to `false` to move no focus. Or give a function that gets the type of the interaction and returns the element to focus. A modal dialog makes the rest of the page inert, so an element outside the popup cannot keep or get the focus at the open. The function of `finalFocus` runs after the update of the close, so it finds an element that the update renders.

<DemoFrame>
  <DemoDialogFocusManagement />
  <template #tailwind>
    <DemoDialogFocusManagementTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/dialog/focus-management/css-modules/index.vue

<<< ../demos/dialog/focus-management/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/dialog/focus-management/tailwind/index.vue

:::

</DemoSource>

### Outside scroll dialog

To make the dialog scroll, use `Dialog.Viewport` as an outer container of `Dialog.Popup` that scrolls. The popup can then go past the bottom edge of the screen.

<DemoFrame>
  <DemoDialogOutsideScroll />
  <template #tailwind>
    <DemoDialogOutsideScrollTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/dialog/outside-scroll/css-modules/index.vue

<<< ../demos/dialog/outside-scroll/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/dialog/outside-scroll/tailwind/index.vue

:::

</DemoSource>

### Inside scroll dialog

To keep the popup fully on the screen, make a container in the popup scroll. `Dialog.Viewport` then sets the position of `Dialog.Popup`.

<DemoFrame>
  <DemoDialogInsideScroll />
  <template #tailwind>
    <DemoDialogInsideScrollTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/dialog/inside-scroll/css-modules/index.vue

<<< ../demos/dialog/inside-scroll/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/dialog/inside-scroll/tailwind/index.vue

:::

</DemoSource>

### Placing elements outside the popup

To show an element "outside" the colored area of the popup, keep it in `Dialog.Popup`, and give the popup styles to a child element. The element then stays in the tab order, and screen readers announce it correctly.

`Dialog.Popup` has `pointer-events: none`. The inner content (the colored popup and the close button) has `pointer-events: auto`, so a click on the backdrop still closes the dialog.

<DemoFrame>
  <DemoDialogUncontained />
  <template #tailwind>
    <DemoDialogUncontainedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/dialog/uncontained/css-modules/index.vue

<<< ../demos/dialog/uncontained/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/dialog/uncontained/tailwind/index.vue

:::

</DemoSource>

### Detached triggers

A trigger can be inside or outside `Dialog.Root`. For a simple interaction, put `Dialog.Trigger` inside `Dialog.Root`, as the example at the top of this page does.

When the content of the dialog cannot be next to its trigger, use a detached trigger. Put `Dialog.Trigger` outside `Dialog.Root`, and connect the two with a handle from `Dialog.createHandle()`.

The methods of the handle, such as `open()` and `openWithPayload()`, act only while a `Dialog.Root` with the same handle is mounted. The handle ignores a call before a root mounts or after it unmounts. When two mounted roots have the same handle, the handle acts on the root that took it last. Each root that mounts starts from a new state. It does not run an ignored call, and it does not keep the open state of an earlier root.

<<< ./dialog/DetachedTriggers.vue{4,8,10}

<DemoFrame>
  <DemoDialogDetachedTriggersSimple />
  <template #tailwind>
    <DemoDialogDetachedTriggersSimpleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/dialog/detached-triggers-simple/css-modules/index.vue

<<< ../demos/dialog/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/dialog/detached-triggers-simple/tailwind/index.vue

:::

</DemoSource>

### Multiple triggers

More than one trigger can open the same dialog. Give the same `handle` to more than one detached trigger, or put more than one `Dialog.Trigger` in one `Dialog.Root`.

<<< ./dialog/MultipleTriggers.vue{7-8}

<<< ./dialog/MultipleDetachedTriggers.vue{8-9}

The dialog can show different content for each trigger. Give a `payload` to each `Dialog.Trigger`. The default slot of `Dialog.Root` gets the `payload` of the active trigger.

The type argument of `createHandle()` gives the type of the payload:

<<< ./dialog/DetachedTriggersPayload.vue{4,8-9,12,16-17}

### Controlled mode with multiple triggers

To control the open state, bind it with `v-model:open` on `Dialog.Root`. With more than one trigger, also bind the active trigger with `v-model:trigger-id`, and give an `id` to each `Dialog.Trigger`.

The `openChange` event gives `eventDetails` as its second argument. Its `trigger` is the element of the trigger that started the change.

<DemoFrame>
  <DemoDialogDetachedTriggersControlled />
  <template #tailwind>
    <DemoDialogDetachedTriggersControlledTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/dialog/detached-triggers-controlled/css-modules/index.vue

<<< ../demos/dialog/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/dialog/detached-triggers-controlled/tailwind/index.vue

:::

</DemoSource>

### Open from a menu

To open a dialog from a menu, bind the open state of the dialog with `v-model:open`. Set it to `true` in a `click` listener on the menu item. See [Menu](/components/menu) for the parts of the menu.

<DemoFrame>
  <DemoDialogOpenFromMenu />
  <template #tailwind>
    <DemoDialogOpenFromMenuTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/dialog/open-from-menu/css-modules/index.vue

<<< ../demos/dialog/open-from-menu/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/dialog/open-from-menu/tailwind/index.vue

:::

</DemoSource>

### Render on the server

Set `disabled` on `Dialog.Portal` to render the parts in place. The server HTML then has the open popup.

This panel stays beside a list on wide screens and becomes a modal sheet on narrow screens. It keeps one dialog tree and changes `modal` after the hydration:

<<< ./dialog/InPlace.vue

Give a modal popup a `position`, so that it is above the fixed element of the dialog. Hide `Dialog.Backdrop` with CSS while the dialog is not modal. The server HTML has no fixed element, and the modal state starts at the mount.

The popup gets `aria-labelledby` and `aria-describedby` after the hydration. For a name in the server HTML, give `Dialog.Title` an `id`, and give the same id to the popup as `aria-labelledby`. Do the same with `Dialog.Description` and `aria-describedby`.

## API reference

<ApiReference />

### createHandle

Makes a handle that connects a `Dialog.Root` to `Dialog.Trigger` parts outside it.

<ApiReference name="Dialog.createHandle" :heading-level="4" />

### Handle

The class of the handle, which opens and closes the dialog from code.

<ApiReference name="Dialog.Handle" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
