<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';
</script>

<template>
  <Combobox.Root default-open>
    <Combobox.Trigger data-testid="trigger" />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-testid="popup">
          <Combobox.Input />
          <Combobox.List />
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
