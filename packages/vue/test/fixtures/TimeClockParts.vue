<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { TimeClock } from '../../src/time-clock';
import type { TimeClockFaceNumber } from '../../src/time-clock';

defineProps({
  clock: Object as PropType<Record<string, unknown>>,
  face: Object as PropType<Record<string, unknown>>,
  /** `showFace: false` removes the face, so a test can remove it during a press. */
  scene: Object as PropType<{ showFace?: boolean }>,
});
const root = useTemplateRef('root');
const facePart = useTemplateRef('facePart');
defineExpose({ root, face: facePart });

// The numbers sit on two rings, as a style sheet of a developer places them.
function place(number: TimeClockFaceNumber, view: string) {
  const angle = (number.value % (view === 'hour' ? 12 : 60)) * (view === 'hour' ? 30 : 6);
  const radius = number.inner ? 0.6 * 45 : 45;
  const radians = (angle * Math.PI) / 180;
  return {
    position: 'absolute',
    left: `${50 + Math.sin(radians) * radius}%`,
    top: `${50 - Math.cos(radians) * radius}%`,
    transform: 'translate(-50%, -50%)',
  } as const;
}
</script>

<template>
  <TimeClock.Root ref="root" v-bind="clock" v-slot="{ state }">
    <TimeClock.ViewTrigger view="hour" data-testid="hour-trigger" />
    <TimeClock.ViewTrigger view="minute" data-testid="minute-trigger" />
    <TimeClock.DayPeriod value="am" data-testid="am" />
    <TimeClock.DayPeriod value="pm" data-testid="pm" />
    <TimeClock.Face
      v-if="scene?.showFace !== false"
      ref="facePart"
      v-bind="face"
      data-testid="face"
      style="position: relative; width: 200px; height: 200px"
    >
      <TimeClock.Hand data-testid="hand" />
      <template #number="{ number }">
        <TimeClock.Number :number="number" :style="place(number, state.view)" />
      </template>
    </TimeClock.Face>
  </TimeClock.Root>
</template>
