<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { NumberFieldRootState } from '../root/NumberFieldRoot.vue';

export interface NumberFieldScrubAreaCursorState extends NumberFieldRootState {}

export interface NumberFieldScrubAreaCursorProps
  extends
    VaseUIComponentProps<NumberFieldScrubAreaCursorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import { platform } from '../../common/platform';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import { useNumberFieldScrubAreaContext } from '../scrub-area/NumberFieldScrubAreaContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';

const CURSOR_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  'pointer-events': 'none',
};

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldScrubAreaCursorProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: NumberFieldScrubAreaCursorState }): unknown;
  render: ComponentRenderFn<HTMLProps, NumberFieldScrubAreaCursorState>;
}>();

const { state } = useNumberFieldRootContext();
const { isScrubbing, isTouchInput, isPointerLockDenied, scrubAreaCursorRef } =
  useNumberFieldScrubAreaContext();

const shouldRender = computed(
  () =>
    isScrubbing.value &&
    !platform.engine.webkit &&
    !isTouchInput.value &&
    !isPointerLockDenied.value,
);

// A template can mount the cursor that replaces this cursor before it unmounts this cursor.
let ownElement: HTMLSpanElement | null = null;

function setCursorElement(next: HTMLSpanElement | null) {
  if (next !== null || scrubAreaCursorRef.value === ownElement) {
    scrubAreaCursorRef.value = next;
  }
  ownElement = next;
}

const { element, elementProps } = useRenderElement<
  NumberFieldScrubAreaCursorState,
  HTMLSpanElement
>('span', props, {
  ref: setCursorElement,
  state,
  props: (attrs) => [{ role: 'presentation', style: CURSOR_STYLE }, attrs],
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <Teleport v-if="shouldRender" to="body">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </Teleport>
</template>
