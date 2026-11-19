---
order: 1
description: An unstyled Vue dialog component that opens on top of the entire page.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

## Examples

### State

By default, Dialog is an uncontrolled component that keeps its own state.

<<< ./dialog/Uncontrolled.vue

To control the open state, bind it with `v-model:open`. You can then open the dialog from another place in your app. In this example, the dialog closes when the form data is submitted:

<<< ./dialog/Controlled.vue{7,10-13,17}

To do something when the dialog opens or closes, listen to the `openChange` event of `Dialog.Root`. The event gives the new open state and `eventDetails`, which holds the reason of the change. The root emits `openChange` before `update:open`, and a listener can call `eventDetails.cancel()` to stop the change.

<<< ./dialog/OpenChange.vue{9-16,20}

### Nested dialogs

You can put a dialog inside another dialog.

To style the parent dialog while a nested dialog is open, use the `[data-nested-dialog-open]` selector and the `var(--nested-dialogs)` CSS variable. A nested dialog does not render its backdrop unless the backdrop has `forceRender`, so the parent dialog stays clear behind the dialog on top of it.

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

The `initialFocus` and `finalFocus` props of `Dialog.Popup` set the element that gets the focus when the dialog opens and when it closes. Each prop takes an element, a component or a template ref of one.

Set a prop to `false` to keep the focus where it is. Or give a function that gets the interaction type and returns the element to focus.

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

To make the dialog scrollable, use `Dialog.Viewport` as an outer container of `Dialog.Popup` that scrolls. The popup can then extend past the bottom edge of the screen.

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

To keep the popup fully on the screen, make a container inside the popup scrollable. `Dialog.Viewport` then sets the position of `Dialog.Popup`.

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

To show an element "outside" the colored area of the popup, keep it inside `Dialog.Popup`, and give the popup styles to a child element. The element then stays in the tab order, and screen readers announce it correctly.

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

### Portal targets

Set `to` to a CSS selector, an element or a shadow root. Omit it to use the nearest portal element or the document body. Set `:to="null"` to wait for a target. Vue resolves a selector after the client mount.

```vue-html
<Dialog.Portal to="#overlays">
  <Dialog.Popup>Account settings</Dialog.Popup>
</Dialog.Portal>
```

Replace the former `container` prop with `to`. Pass the element directly. Vue templates unwrap refs.

### Render in place

Set `disabled` on `Dialog.Portal` to render the portal element and its parts at the place of the component. The server HTML then includes an open popup, and the portal ignores `to`. The name follows [Vue's `Teleport` prop](https://vuejs.org/guide/built-ins/teleport.html#disabling-teleport).

This panel stays beside a list on wide screens and becomes a modal sheet on narrow screens. It keeps one dialog tree and changes `modal` after hydration:

<<< ./dialog/InPlace.vue

Give a modal popup a `position` so that it appears above the backdrops. Hide `Dialog.Backdrop` with CSS while the dialog is not modal. A modal dialog includes its internal backdrop in the server HTML; use `:modal="false"` for a page that must work before hydration.

A nested popup keeps its portal inside the dialog's portal element, so an ancestor with `overflow: hidden` can clip it. A change of `disabled` mounts the parts again and discards DOM state, such as the text of an uncontrolled input.

The popup gets `aria-labelledby` and `aria-describedby` after hydration. For a name in the server HTML, give `Dialog.Title` an `id`. Pass that id to the popup as `aria-labelledby`. Do the same with `Dialog.Description` and `aria-describedby`. When `modal` becomes `true` with focus outside the popup, the dialog does not move focus into it.

### Detached triggers

A trigger can be inside or outside `Dialog.Root`. For a simple interaction, put `Dialog.Trigger` inside `Dialog.Root`, as the example at the top of this page does.

When the content of the dialog cannot be next to its trigger, use a detached trigger. Put `Dialog.Trigger` outside `Dialog.Root`, and connect the two with a handle from `Dialog.createHandle()`.

The methods of the handle, such as `open()` and `openWithPayload()`, act only while a `Dialog.Root` with the same handle is mounted. The handle ignores a call before a root mounts or after it unmounts, and a development build shows a warning for that call. Each root that mounts starts from a new state. It does not run an ignored call, and it does not keep the open state of an earlier root.

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

To control the open state, give `open` to `Dialog.Root` and listen to its `openChange` event, or use `v-model:open`. With more than one trigger, also control the active trigger with the `triggerId` prop of the root and the `id` of each `Dialog.Trigger`.

The root has no event for a change of the trigger id. The `openChange` event gives `eventDetails` as its second argument. Its `trigger` is the element of the trigger that started the change.

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

To open a dialog from a menu, control the open state of the dialog with `v-model:open`. Set it to `true` in a `click` listener on the menu item. See [Menu](/components/menu) for the parts of the menu.

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

## API reference

<ApiReference />

## createHandle

Creates a handle that connects a `Dialog.Root` with detached `Dialog.Trigger` parts. The type argument of the function is the type of the payload.

<ApiReference name="Dialog.createHandle" :heading-level="3" />

### Handle

`Dialog.Handle` is the class of the handle.

<ApiReference name="Dialog.Handle" :heading-level="4" />

When no trigger has the `id` that `open()` gets, it opens the dialog with no trigger, and a development build shows a warning. A `computed` that reads `isOpen` follows the open state.
