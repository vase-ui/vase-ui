<script setup lang="ts">
import FocusManagerPart from '../../../../test/fixtures/FocusManagerPart.vue';
import { usePortalFocus } from './usePortalFocus';
import PopupPortal from './PopupPortal.vue';
</script>

<template>
  <div data-testid="host">
    <button data-testid="trigger" type="button">trigger</button>
    <PopupPortal :guards="usePortalFocus" data-testid="portal">
      <FocusManagerPart>
        <div data-testid="content">content</div>
      </FocusManagerPart>
    </PopupPortal>
    <button data-testid="after" type="button">after</button>
  </div>
</template>
