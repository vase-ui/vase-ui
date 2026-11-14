<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import FocusGuard from '../../utils/popups/focus/FocusGuard.vue';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { createElementSetter } from '../utils/createElementSetter';
import { useNavigationMenuViewportGuards } from './useNavigationMenuViewportGuards';

defineSlots<{
  default(): unknown;
}>();

const { viewportTargetElement } = useNavigationMenuRootContext();

markChildrenMounted();

// In a positioner, the viewport element holds the content itself, and its guards are siblings of
// the element.
const inPositioner = useNavigationMenuPositionerContext(true) !== undefined;

const {
  hasGuards,
  setBeforeInsideGuard,
  setAfterInsideGuard,
  handleBeforeInsideFocusin,
  handleAfterInsideFocusin,
} = useNavigationMenuViewportGuards();

const setViewportTarget = createElementSetter(viewportTargetElement);
</script>

<template>
  <slot v-if="inPositioner" />
  <template v-else>
    <FocusGuard v-if="hasGuards" :ref="setBeforeInsideGuard" @focusin="handleBeforeInsideFocusin" />
    <div :ref="setViewportTarget"><slot /></div>
    <FocusGuard v-if="hasGuards" :ref="setAfterInsideGuard" @focusin="handleAfterInsideFocusin" />
  </template>
</template>
