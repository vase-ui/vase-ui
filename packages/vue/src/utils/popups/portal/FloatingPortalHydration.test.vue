<script setup lang="ts">
import FocusManagerPart from '../../../../test/fixtures/FocusManagerPart.vue';
import FloatingPortal from './FloatingPortal.vue';
</script>

<template>
  <div data-testid="host">
    <button data-testid="trigger" type="button">trigger</button>
    <FloatingPortal data-testid="portal">
      <FocusManagerPart>
        <div data-testid="content">content</div>
      </FocusManagerPart>
    </FloatingPortal>
    <button data-testid="after" type="button">after</button>
  </div>
</template>
