<script lang="ts">
import { computed, watchPostEffect } from 'vue';
import type { Ref } from 'vue';
import { createFocusGuardElement } from '../../utils/popups/focus/createFocusGuardElement';
import {
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import { useElementSiblings } from '../../utils/popups/focus/useElementSiblings';
import { createElementSetter } from '../../utils/popups/createElementSetter';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { NavigationMenuRootContext } from '../root/NavigationMenuRootContext';

function insideGuardHandlers(context: NavigationMenuRootContext) {
  function moveFocus(event: FocusEvent, before: boolean) {
    const reference = context.positionerElement.value ?? context.viewportElement.value;
    if (reference && isOutsideEvent(event, reference)) {
      const next = before ? getNextTabbable(reference) : getPreviousTabbable(reference);
      next?.focus();
    } else {
      const outside = before ? context.beforeOutsideRef : context.afterOutsideRef;
      outside.value?.focus();
    }
  }
  return {
    before: (event: FocusEvent) => moveFocus(event, true),
    after: (event: FocusEvent) => moveFocus(event, false),
  };
}

export function useNavigationMenuViewportSiblingGuards(element: Readonly<Ref<HTMLElement | null>>) {
  const context = useNavigationMenuRootContext();
  const focus = insideGuardHandlers(context);
  const siblings = computed(() => {
    const doc = element.value?.ownerDocument;
    if (!doc) return null;
    const before = createFocusGuardElement(doc);
    const after = createFocusGuardElement(doc);
    before.addEventListener('focusin', focus.before);
    after.addEventListener('focusin', focus.after);
    return { before: [before] as const, after: [after] as const };
  });
  useElementSiblings(element, siblings);
  const setBefore = createElementSetter(context.beforeInsideRef, { keepWhileHeld: true });
  const setAfter = createElementSetter(context.afterInsideRef, { keepWhileHeld: true });
  watchPostEffect(() => {
    setBefore(siblings.value?.before[0] ?? null);
    setAfter(siblings.value?.after[0] ?? null);
  });
}
</script>

<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import FocusGuard from '../../utils/popups/focus/FocusGuard.vue';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';

defineSlots<{
  default(): unknown;
}>();

markChildrenMounted();

const inPositioner = useNavigationMenuPositionerContext(true) !== undefined;
const context = useNavigationMenuRootContext();
const { floatingRootStore } = context;
const focus = insideGuardHandlers(context);
const setBefore = createElementSetter(context.beforeInsideRef);
const setAfter = createElementSetter(context.afterInsideRef);
const setViewportTarget = createElementSetter(context.viewportTargetElement, {
  keepWhileHeld: true,
});
</script>

<template>
  <slot v-if="inPositioner" />
  <template v-else>
    <FocusGuard v-if="floatingRootStore" :ref="setBefore" @focusin="focus.before" />
    <div :ref="setViewportTarget"><slot /></div>
    <FocusGuard v-if="floatingRootStore" :ref="setAfter" @focusin="focus.after" />
  </template>
</template>
