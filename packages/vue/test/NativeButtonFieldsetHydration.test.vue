<script setup lang="ts">
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Menu } from '@vase-ui/vue/menu';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { Popover } from '@vase-ui/vue/popover';
import { Toggle } from '@vase-ui/vue/toggle';
import { Tooltip } from '@vase-ui/vue/tooltip';

defineProps<{ fieldsetRoot?: boolean }>();
</script>

<template>
  <component :is="fieldsetRoot ? Fieldset.Root : 'fieldset'" disabled>
    <Toggle v-slot="{ state }">{{ state.disabled }}</Toggle>
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
    <Popover.Root>
      <Popover.Trigger v-slot="{ state }">{{ state.disabled }}</Popover.Trigger>
    </Popover.Root>
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="one">
          <NavigationMenu.Trigger v-slot="{ state }">{{ state.disabled }}</NavigationMenu.Trigger>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
    <Tooltip.Root>
      <Tooltip.Trigger v-slot="{ state }">{{ state.disabled }}</Tooltip.Trigger>
    </Tooltip.Root>
  </component>
</template>
