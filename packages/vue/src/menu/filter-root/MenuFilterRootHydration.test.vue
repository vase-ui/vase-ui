<script setup lang="ts">
import MenuEmpty from '../empty/MenuEmpty.vue';
import MenuFilterProvider from '../filter-provider/MenuFilterProvider.vue';
import MenuInput from '../input/MenuInput.vue';
import MenuList from '../list/MenuList.vue';
import MenuPopup from '../popup/MenuPopup.vue';
import MenuPortal from '../portal/MenuPortal.vue';
import MenuPositioner from '../positioner/MenuPositioner.vue';
import MenuRoot from '../root/MenuRoot.vue';
</script>

<template>
  <MenuFilterProvider>
    <MenuRoot open>
      <MenuPortal>
        <MenuPositioner>
          <MenuPopup>
            <MenuInput aria-label="Filter actions" />
            <MenuEmpty data-testid="empty">No actions found</MenuEmpty>
            <MenuList />
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </MenuRoot>
  </MenuFilterProvider>
</template>
