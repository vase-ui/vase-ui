<script setup lang="ts">
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Menu } from '@vase-ui/vue/menu';
import { Tooltip } from '@vase-ui/vue/tooltip';

defineProps<{ fieldsetRoot?: boolean }>();
</script>

<template>
  <component :is="fieldsetRoot ? Fieldset.Root : 'fieldset'" disabled>
    <Dialog.Root>
      <Dialog.Trigger v-slot="{ state }">{{ state.disabled }}</Dialog.Trigger>
    </Dialog.Root>
    <AlertDialog.Root>
      <AlertDialog.Trigger v-slot="{ state }">{{ state.disabled }}</AlertDialog.Trigger>
    </AlertDialog.Root>
    <Drawer.Root>
      <Drawer.Trigger v-slot="{ state }">{{ state.disabled }}</Drawer.Trigger>
    </Drawer.Root>
    <Menu.Root>
      <Menu.Trigger v-slot="{ state }">{{ state.disabled }}</Menu.Trigger>
    </Menu.Root>
    <Tooltip.Root>
      <Tooltip.Trigger v-slot="{ state }">{{ state.disabled }}</Tooltip.Trigger>
    </Tooltip.Root>
  </component>
</template>
