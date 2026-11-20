---
order: 1
description: An unstyled Vue alert dialog component that needs a response from the user before they continue.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoAlertDialogDetachedTriggersControlled from '../demos/alert-dialog/detached-triggers-controlled/css-modules/index.vue';
import DemoAlertDialogDetachedTriggersControlledTailwind from '../demos/alert-dialog/detached-triggers-controlled/tailwind/index.vue';
import DemoAlertDialogDetachedTriggersSimple from '../demos/alert-dialog/detached-triggers-simple/css-modules/index.vue';
import DemoAlertDialogDetachedTriggersSimpleTailwind from '../demos/alert-dialog/detached-triggers-simple/tailwind/index.vue';
import DemoAlertDialogHero from '../demos/alert-dialog/hero/css-modules/index.vue';
import DemoAlertDialogHeroTailwind from '../demos/alert-dialog/hero/tailwind/index.vue';
import DemoAlertDialogOpenFromMenu from '../demos/alert-dialog/open-from-menu/css-modules/index.vue';
import DemoAlertDialogOpenFromMenuTailwind from '../demos/alert-dialog/open-from-menu/tailwind/index.vue';
</script>

# Alert Dialog

A dialog that needs a response from the user before they continue.

<DemoFrame>
  <DemoAlertDialogHero />
  <template #tailwind>
    <DemoAlertDialogHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/alert-dialog/hero/css-modules/index.vue

<<< ../demos/alert-dialog/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/alert-dialog/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./alert-dialog/Anatomy.vue

## Examples

### Detached triggers

A trigger can be inside or outside `AlertDialog.Root`. For a simple interaction, put `AlertDialog.Trigger` inside `AlertDialog.Root`, as the example at the top of this page does.

When the content of the alert dialog cannot be next to its trigger, use a detached trigger. Put `AlertDialog.Trigger` outside `AlertDialog.Root`, and connect the two with a handle from `AlertDialog.createHandle()`.

The methods of the handle, such as `open()` and `openWithPayload()`, act only while an `AlertDialog.Root` with the same handle is mounted. The handle ignores a call before a root mounts or after it unmounts. When two mounted roots have the same handle, the handle acts on the root that took it last. Each root that mounts starts from a new state. It does not run an ignored call, and it does not keep the open state of an earlier root.

<<< ./alert-dialog/DetachedTriggers.vue{4,8,10}

<DemoFrame>
  <DemoAlertDialogDetachedTriggersSimple />
  <template #tailwind>
    <DemoAlertDialogDetachedTriggersSimpleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/alert-dialog/detached-triggers-simple/css-modules/index.vue

<<< ../demos/alert-dialog/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/alert-dialog/detached-triggers-simple/tailwind/index.vue

:::

</DemoSource>

### Multiple triggers

More than one trigger can open the same alert dialog. Give the same `handle` to more than one detached trigger, or put more than one `AlertDialog.Trigger` in one `AlertDialog.Root`.

<<< ./alert-dialog/MultipleTriggers.vue{7-8}

<<< ./alert-dialog/MultipleDetachedTriggers.vue{8-9}

The alert dialog can show different content for each trigger. Give a `payload` to each `AlertDialog.Trigger`. The default slot of `AlertDialog.Root` gets the `payload` of the active trigger.

The type argument of `createHandle()` gives the type of the payload:

<<< ./alert-dialog/DetachedTriggersPayload.vue{4,8,11,16,20-21}

### Controlled mode with multiple triggers

To control the open state, bind it with `v-model:open` on `AlertDialog.Root`. With more than one trigger, also bind the active trigger with `v-model:trigger-id`, and give an `id` to each `AlertDialog.Trigger`.

The `openChange` event gives `eventDetails` as its second argument. Its `trigger` is the element of the trigger that started the change.

<DemoFrame>
  <DemoAlertDialogDetachedTriggersControlled />
  <template #tailwind>
    <DemoAlertDialogDetachedTriggersControlledTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/alert-dialog/detached-triggers-controlled/css-modules/index.vue

<<< ../demos/alert-dialog/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/alert-dialog/detached-triggers-controlled/tailwind/index.vue

:::

</DemoSource>

### Open from a menu

To open an alert dialog from a menu, bind the open state of the alert dialog with `v-model:open`. Set it to `true` in a `click` listener on the menu item. See [Menu](/components/menu) for the parts of the menu.

<DemoFrame>
  <DemoAlertDialogOpenFromMenu />
  <template #tailwind>
    <DemoAlertDialogOpenFromMenuTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/alert-dialog/open-from-menu/css-modules/index.vue

<<< ../demos/alert-dialog/open-from-menu/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/alert-dialog/open-from-menu/tailwind/index.vue

:::

</DemoSource>

## API reference

<ApiReference />

### createHandle

Makes a handle that connects an `AlertDialog.Root` to `AlertDialog.Trigger` parts outside it.

<ApiReference name="AlertDialog.createHandle" :heading-level="4" />

### Handle

The class of the handle, which opens and closes the alert dialog from code.

<ApiReference name="AlertDialog.Handle" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
