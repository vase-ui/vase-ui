<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import { useTimeClockRootContext } from '../root/TimeClockRootContext';
import type { TimeClockFaceNumber } from '../utils/clockViews';
import { useTimeClockFaceContext } from './TimeClockFaceContext';

defineSlots<{
  default?(): unknown;
  number?(props: { number: TimeClockFaceNumber; index: number }): unknown;
}>();

const { numbers } = useTimeClockRootContext();
const { inputProps, setInputElement } = useTimeClockFaceContext();

markChildrenMounted();
</script>

<template>
  <slot />
  <template v-if="$slots.number">
    <template v-for="(number, index) in numbers" :key="number.value">
      <slot name="number" :number="number" :index="index" />
    </template>
  </template>
  <input v-bind="inputProps()" :ref="setInputElement" />
</template>
