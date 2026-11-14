<script setup lang="ts">
import type { HTMLProps } from '../../internals/types';
import MenuFilterProvider from '../filter-provider/MenuFilterProvider.vue';
import MenuInput from '../input/MenuInput.vue';
import MenuItem from '../item/MenuItem.vue';
import MenuList from '../list/MenuList.vue';
import MenuPopup from '../popup/MenuPopup.vue';
import MenuPortal from '../portal/MenuPortal.vue';
import MenuPositioner from '../positioner/MenuPositioner.vue';
import MenuRoot from '../root/MenuRoot.vue';

defineProps<{ firstRender: () => void; secondRender: () => void }>();

// The slot of an item runs in each render of the item.
function count(spy: () => void, props: HTMLProps) {
  spy();
  return props;
}
</script>

<template>
  <MenuFilterProvider>
    <MenuRoot open>
      <MenuPortal>
        <MenuPositioner>
          <MenuPopup>
            <MenuInput aria-label="Filter actions" />
            <MenuList>
              <MenuItem>
                <template #render="{ props }">
                  <div v-bind="count(firstRender, props)">Rename</div>
                </template>
              </MenuItem>
              <MenuItem>
                <template #render="{ props }">
                  <div v-bind="count(secondRender, props)">Delete</div>
                </template>
              </MenuItem>
            </MenuList>
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </MenuRoot>
  </MenuFilterProvider>
</template>
