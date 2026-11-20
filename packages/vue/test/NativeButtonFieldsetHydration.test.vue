<script setup lang="ts">
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Menu } from '@vase-ui/vue/menu';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';

defineProps<{ fieldsetRoot?: boolean }>();
</script>

<template>
  <component :is="fieldsetRoot ? Fieldset.Root : 'fieldset'" disabled>
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
  </component>
</template>
