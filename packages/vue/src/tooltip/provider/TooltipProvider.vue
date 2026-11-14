<script lang="ts">
export interface TooltipProviderState {}

export interface TooltipProviderProps {
  /**
   * How long to wait before opening the tooltip on hover. Specified in milliseconds.
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing a tooltip. Specified in milliseconds.
   */
  closeDelay?: number | undefined;
  /**
   * Another tooltip will open instantly if the previous tooltip
   * is closed within this timeout. Specified in milliseconds.
   * @default 400
   */
  timeout?: number | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { provideFloatingDelayGroup } from '../../utils/popups/delay-group/FloatingDelayGroup';
import { TooltipProviderContext } from './TooltipProviderContext';

const props = withDefaults(defineProps<TooltipProviderProps>(), {
  delay: undefined,
  closeDelay: undefined,
  timeout: 400,
});

defineSlots<{ default?: () => unknown }>();

provide(
  TooltipProviderContext,
  computed(() => props.delay),
);
provideFloatingDelayGroup({
  delay: () => ({ open: props.delay, close: props.closeDelay }),
  timeoutMs: () => props.timeout,
});
</script>

<template>
  <slot />
</template>
