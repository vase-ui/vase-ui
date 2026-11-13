<script setup lang="ts">
import { shallowRef } from 'vue';
import PositionerPart from '../../test/fixtures/PositionerPart.vue';

withDefaults(defineProps<{ mounted?: boolean; keepMounted?: boolean }>(), {
  mounted: true,
  keepMounted: false,
});

const trigger = shallowRef<HTMLElement | null>(null);
</script>

<template>
  <button
    ref="trigger"
    type="button"
    style="position: fixed; left: 200px; top: 100px; width: 40px; height: 20px"
  >
    anchor
  </button>
  <PositionerPart
    v-if="mounted || keepMounted"
    :trigger="trigger"
    :mounted="mounted"
    :keep-mounted="keepMounted"
    position-method="fixed"
    data-testid="popup"
    style="width: 100px; height: 50px"
  >
    popup
  </PositionerPart>
</template>
