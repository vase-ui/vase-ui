---
order: 1
description: An unstyled Vue alert dialog component that needs a response from the user before they continue.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoAlertDialogDetachedTriggersControlled from '../demos/alert-dialog/detached-triggers-controlled/css-modules/index.vue';
import DemoAlertDialogDetachedTriggersSimple from '../demos/alert-dialog/detached-triggers-simple/css-modules/index.vue';
import DemoAlertDialogHero from '../demos/alert-dialog/hero/css-modules/index.vue';
</script>

# Alert Dialog

A dialog that needs a response from the user before they continue.

<DemoFrame>
  <DemoAlertDialogHero />
</DemoFrame>

::: code-group

<<< ../demos/alert-dialog/hero/css-modules/index.vue

<<< ../demos/alert-dialog/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./alert-dialog/Anatomy.vue

The popup has the role `alertdialog`. An alert dialog is always modal, and a press outside the popup does not close it. The Escape key and `AlertDialog.Close` close it. `AlertDialog.Root` has no `modal` prop and no `disablePointerDismissal` prop.

## Examples

### Detached triggers

A trigger can be inside or outside `AlertDialog.Root`. For a simple interaction, put `AlertDialog.Trigger` inside `AlertDialog.Root`, as the example at the top of this page does.

When the content of the alert dialog cannot be next to its trigger, use a detached trigger. Put `AlertDialog.Trigger` outside `AlertDialog.Root`, and connect the two with a handle from `AlertDialog.createHandle()`.

The methods of the handle, such as `open()` and `openWithPayload()`, act only while an `AlertDialog.Root` with the same handle is mounted. The handle ignores a call before a root mounts or after it unmounts, and a development build shows a warning for that call. Each root that mounts starts from a new state. It does not run an ignored call, and it does not keep the open state of an earlier root.

<<< ./alert-dialog/DetachedTriggers.vue{4,8,10}

<DemoFrame>
  <DemoAlertDialogDetachedTriggersSimple />
</DemoFrame>

::: code-group

<<< ../demos/alert-dialog/detached-triggers-simple/css-modules/index.vue

<<< ../demos/alert-dialog/_index.module.css

:::

### Multiple triggers

More than one trigger can open the same alert dialog. Give the same `handle` to more than one detached trigger, or put more than one `AlertDialog.Trigger` in one `AlertDialog.Root`.

<<< ./alert-dialog/MultipleTriggers.vue{7-8}

<<< ./alert-dialog/MultipleDetachedTriggers.vue{8-9}

The alert dialog can show different content for each trigger. Give a `payload` to each `AlertDialog.Trigger`. The default slot of `AlertDialog.Root` gets the `payload` of the trigger that opened the alert dialog.

The type argument of `createHandle()` gives the type of the payload:

<<< ./alert-dialog/DetachedTriggersPayload.vue{4,8,11,16,20-21}

### Controlled mode with multiple triggers

To control the open state, give `open` to `AlertDialog.Root` and listen to its `openChange` event, or use `v-model:open`. With more than one trigger, also control the active trigger with the `triggerId` prop of the root and the `id` of each `AlertDialog.Trigger`.

The root has no event for a change of the trigger id. The `openChange` event gives `eventDetails` as its second argument. Its `trigger` is the element of the trigger that started the change.

<DemoFrame>
  <DemoAlertDialogDetachedTriggersControlled />
</DemoFrame>

::: code-group

<<< ../demos/alert-dialog/detached-triggers-controlled/css-modules/index.vue

<<< ../demos/alert-dialog/_index.module.css

:::

## API reference

<ApiReference />

## createHandle

Creates a handle that connects an `AlertDialog.Root` with detached `AlertDialog.Trigger` parts. The type argument of the function is the type of the payload.

<ApiReference name="AlertDialog.createHandle" />

### Handle

`AlertDialog.Handle` is the class of the handle. The types of `AlertDialog.Root` and `AlertDialog.Trigger` accept only a handle of this class, and not a handle from `Dialog.createHandle()`.

<ApiReference name="AlertDialog.Handle" />

When no trigger has the `id` that `open()` gets, it opens the alert dialog with no trigger, and a development build shows a warning. A `computed` that reads `isOpen` follows the open state.
