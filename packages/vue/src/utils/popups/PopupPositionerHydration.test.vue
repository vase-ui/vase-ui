<script setup lang="ts">
import PopupPositionerPart from '../../../test/fixtures/PopupPositionerPart.vue';
import PopupRootPart from '../../../test/fixtures/PopupRootPart.vue';
import PopupTriggerPart from '../../../test/fixtures/PopupTriggerPart.vue';

withDefaults(defineProps<{ open?: boolean; keepMounted?: boolean }>(), {
  open: true,
  keepMounted: false,
});
</script>

<template>
  <PopupRootPart :open="open">
    <PopupTriggerPart style="position: fixed; left: 200px; top: 100px; width: 40px; height: 20px">
      trigger
    </PopupTriggerPart>
    <PopupPositionerPart
      v-if="open || keepMounted"
      :keep-mounted="keepMounted"
      position-method="fixed"
      data-testid="popup"
      style="width: 100px; height: 50px"
    >
      popup
    </PopupPositionerPart>
  </PopupRootPart>
</template>
