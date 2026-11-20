<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Menu } from '@vase-ui/vue/menu';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { Tooltip } from '@vase-ui/vue/tooltip';

defineProps<{ fieldsetRoot?: boolean }>();
</script>

<template>
  <component :is="fieldsetRoot ? Fieldset.Root : 'fieldset'" disabled>
    <Drawer.Root>
      <Drawer.Trigger v-slot="{ state }">{{ state.disabled }}</Drawer.Trigger>
    </Drawer.Root>
    <Menu.Root>
      <Menu.Trigger v-slot="{ state }">{{ state.disabled }}</Menu.Trigger>
    </Menu.Root>
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
