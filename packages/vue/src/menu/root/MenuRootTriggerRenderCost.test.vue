<script setup lang="ts">
import type { HTMLProps } from '../../internals/types';
import MenuItem from '../item/MenuItem.vue';
import MenuPopup from '../popup/MenuPopup.vue';
import MenuPortal from '../portal/MenuPortal.vue';
import MenuPositioner from '../positioner/MenuPositioner.vue';
import MenuTrigger from '../trigger/MenuTrigger.vue';
import MenuRoot from './MenuRoot.vue';

defineProps<{ triggerRender: () => void }>();

// The slot of the trigger runs in each render of the trigger.
function count(spy: () => void, props: HTMLProps) {
  spy();
  return props;
}
</script>

<template>
  <MenuRoot>
    <MenuTrigger>
      <template #render="{ props }">
        <button type="button" v-bind="count(triggerRender, props)">Toggle</button>
      </template>
    </MenuTrigger>
    <MenuPortal>
      <MenuPositioner>
        <MenuPopup>
          <MenuItem v-for="index in 10" :key="index">Item {{ index - 1 }}</MenuItem>
        </MenuPopup>
      </MenuPositioner>
    </MenuPortal>
  </MenuRoot>
</template>
