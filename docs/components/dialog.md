---
order: 1
description: An unstyled Vue dialog component that opens on top of the entire page.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoDialogDetachedTriggersControlled from '../demos/dialog/detached-triggers-controlled/css-modules/index.vue';
import DemoDialogDetachedTriggersSimple from '../demos/dialog/detached-triggers-simple/css-modules/index.vue';
import DemoDialogFocusManagement from '../demos/dialog/focus-management/css-modules/index.vue';
import DemoDialogHero from '../demos/dialog/hero/css-modules/index.vue';
import DemoDialogInsideScroll from '../demos/dialog/inside-scroll/css-modules/index.vue';
import DemoDialogNested from '../demos/dialog/nested/css-modules/index.vue';
import DemoDialogOutsideScroll from '../demos/dialog/outside-scroll/css-modules/index.vue';
import DemoDialogUncontained from '../demos/dialog/uncontained/css-modules/index.vue';
</script>

# Dialog

A popup that opens on top of the entire page.

<DemoFrame>
  <DemoDialogHero />
</DemoFrame>

::: code-group

<<< ../demos/dialog/hero/css-modules/index.vue

<<< ../demos/dialog/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Dialog does not support gestures**: Use Drawer for gestures or snap points. A panel that slides in from the edge of the screen and needs no gestures is a Dialog with a position.

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

To style the parent dialog while a nested dialog is open, use the `[data-nested-dialog-open]` selector and the `var(--nested-dialogs)` CSS variable. A nested dialog does not render its backdrop, so the parent dialog stays clear behind the dialog on top of it.

<DemoFrame>
  <DemoDialogNested />
</DemoFrame>

::: code-group

<<< ../demos/dialog/nested/css-modules/index.vue

<<< ../demos/dialog/nested/css-modules/index.module.css

:::

### Custom focus management

The `initialFocus` and `finalFocus` props of `Dialog.Popup` set the element that gets the focus when the dialog opens and when it closes. Each prop takes an element, a component or a template ref of one.

Set a prop to `false` to keep the focus where it is. Or give a function that gets the interaction type and returns the element to focus.

<DemoFrame>
  <DemoDialogFocusManagement />
</DemoFrame>

::: code-group

<<< ../demos/dialog/focus-management/css-modules/index.vue

<<< ../demos/dialog/focus-management/css-modules/index.module.css

:::

### Outside scroll dialog

To make the dialog scrollable, use `Dialog.Viewport` as an outer container of `Dialog.Popup` that scrolls. The popup can then extend past the bottom edge of the screen.

<DemoFrame>
  <DemoDialogOutsideScroll />
</DemoFrame>

::: code-group

<<< ../demos/dialog/outside-scroll/css-modules/index.vue

<<< ../demos/dialog/outside-scroll/css-modules/index.module.css

:::

### Inside scroll dialog

To keep the popup fully on the screen, make a container inside the popup scrollable. `Dialog.Viewport` then sets the position of `Dialog.Popup`.

<DemoFrame>
  <DemoDialogInsideScroll />
</DemoFrame>

::: code-group

<<< ../demos/dialog/inside-scroll/css-modules/index.vue

<<< ../demos/dialog/inside-scroll/css-modules/index.module.css

:::

### Placing elements outside the popup

To show an element "outside" the colored area of the popup, keep it inside `Dialog.Popup`, and give the popup styles to a child element. The element then stays in the tab order, and screen readers announce it correctly.

`Dialog.Popup` has `pointer-events: none`. The inner content (the colored popup and the close button) has `pointer-events: auto`, so a click on the backdrop still closes the dialog.

<DemoFrame>
  <DemoDialogUncontained />
</DemoFrame>

::: code-group

<<< ../demos/dialog/uncontained/css-modules/index.vue

<<< ../demos/dialog/uncontained/css-modules/index.module.css

:::

### Detached triggers

A trigger can be inside or outside `Dialog.Root`. For a simple interaction, put `Dialog.Trigger` inside `Dialog.Root`, as the example at the top of this page does.

When the content of the dialog cannot be next to its trigger, use a detached trigger. Put `Dialog.Trigger` outside `Dialog.Root`, and connect the two with a handle from `Dialog.createHandle()`.

The methods of the handle, such as `open()` and `openWithPayload()`, act only while a `Dialog.Root` with the same handle is mounted. The handle ignores a call before a root mounts or after it unmounts, and a development build shows a warning for that call. Each root that mounts starts from a new state. It does not run an ignored call, and it does not keep the open state of an earlier root.

<<< ./dialog/DetachedTriggers.vue{4,8,10}

<DemoFrame>
  <DemoDialogDetachedTriggersSimple />
</DemoFrame>

::: code-group

<<< ../demos/dialog/detached-triggers-simple/css-modules/index.vue

<<< ../demos/dialog/_index.module.css

:::

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
</DemoFrame>

::: code-group

<<< ../demos/dialog/detached-triggers-controlled/css-modules/index.vue

<<< ../demos/dialog/_index.module.css

:::

## API reference

<ApiReference />

## createHandle

Creates a handle that connects a `Dialog.Root` with detached `Dialog.Trigger` parts. The type argument of the function is the type of the payload.

<ApiReference name="Dialog.createHandle" />

### Handle

`Dialog.Handle` is the class of the handle.

- `open(triggerId)` opens the dialog for the `Dialog.Trigger` that has that `id` and the same handle. Give `null` to open the dialog with no trigger. When the handle has no trigger with that `id`, the dialog opens with no trigger, and a development build shows a warning.
- `openWithPayload(payload)` opens the dialog with that payload and with no trigger. The default slot of `Dialog.Root` gets the payload.
- `close()` closes the dialog.
- `isOpen` is `true` while the dialog is open, and `false` while no root is mounted. A `computed` that reads it follows the open state.

Call `open()`, `openWithPayload()` and `close()` only in an event handler or an effect, and not in a render.
