<script setup lang="ts">
import InternalBackdrop from '../../src/utils/popups/InternalBackdrop.vue';
import { useAnchoredPopupScrollLock } from '../../src/utils/popups/useAnchoredPopupScrollLock';

const props = defineProps<{
  enabled: boolean;
  touchOpen?: boolean | undefined;
  positionerElement?: HTMLElement | null | undefined;
  referenceElement?: Element | null | undefined;
}>();

useAnchoredPopupScrollLock(
  () => props.enabled,
  () => props.touchOpen ?? false,
  () => props.positionerElement ?? null,
  () => props.referenceElement ?? null,
);
</script>

<template>
  <div><InternalBackdrop /></div>
</template>
