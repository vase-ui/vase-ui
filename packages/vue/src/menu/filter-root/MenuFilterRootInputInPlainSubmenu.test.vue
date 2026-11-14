<script setup lang="ts">
import MenuFilterProvider from '../filter-provider/MenuFilterProvider.vue';
import MenuInput from '../input/MenuInput.vue';
import MenuRoot from '../root/MenuRoot.vue';
import MenuSubmenuRoot from '../submenu-root/MenuSubmenuRoot.vue';
</script>

<template>
  <MenuFilterProvider>
    <MenuRoot>
      <MenuSubmenuRoot>
        <MenuInput />
      </MenuSubmenuRoot>
    </MenuRoot>
  </MenuFilterProvider>
</template>
