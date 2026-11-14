<script setup lang="ts">
import { computed } from 'vue';
import { markChildrenMounted } from '../../internals/useRenderElement';
import FocusGuard from '../../utils/popups/focus/FocusGuard.vue';
import {
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { createElementSetter } from '../utils/createElementSetter';

defineSlots<{
  default(): unknown;
}>();

const {
  floatingRootStore,
  positionerElement,
  viewportElement,
  viewportTargetElement,
  beforeInsideRef,
  afterInsideRef,
  beforeOutsideRef,
  afterOutsideRef,
} = useNavigationMenuRootContext();

markChildrenMounted();

const hasGuards = computed(() => floatingRootStore.value !== undefined);

const setBeforeInsideGuard = createElementSetter(beforeInsideRef);
const setAfterInsideGuard = createElementSetter(afterInsideRef);
const setViewportTarget = createElementSetter(viewportTargetElement);

function handleBeforeInsideFocusin(event: FocusEvent) {
  const referenceElement = positionerElement.value || viewportElement.value;

  if (referenceElement && isOutsideEvent(event, referenceElement)) {
    getNextTabbable(referenceElement)?.focus();
  } else {
    beforeOutsideRef.value?.focus();
  }
}

function handleAfterInsideFocusin(event: FocusEvent) {
  const referenceElement = positionerElement.value || viewportElement.value;

  if (referenceElement && isOutsideEvent(event, referenceElement)) {
    getPreviousTabbable(referenceElement)?.focus();
  } else {
    afterOutsideRef.value?.focus();
  }
}
</script>

<template>
  <FocusGuard v-if="hasGuards" :ref="setBeforeInsideGuard" @focusin="handleBeforeInsideFocusin" />
  <div :ref="setViewportTarget"><slot /></div>
  <FocusGuard v-if="hasGuards" :ref="setAfterInsideGuard" @focusin="handleAfterInsideFocusin" />
</template>
