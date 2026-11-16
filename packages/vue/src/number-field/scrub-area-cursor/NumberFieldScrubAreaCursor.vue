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
import { isShadowRoot } from '@floating-ui/utils/dom';
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import { ownerDocument } from '../../common/owner';
import { platform } from '../../common/platform';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { createAttribute } from '../../utils/popups/createAttribute';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import { useNumberFieldScrubAreaContext } from '../scrub-area/NumberFieldScrubAreaContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';

const CURSOR_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  'pointer-events': 'none',
};

// A style that is scoped to the portal elements of the page reaches the cursor in this element.
// The element makes no box, so its container gets no new box during a scrub.
// A `<Transition>` of the consumer around the part gets this element in Vue 3.5.41 and later, and
// in Vue 3.6.0-rc.3 and later. It does not animate the cursor, because the element has no box.
// The element is in this template and not in `FloatingPortalLite`, because that portal renders its
// slot after the mount of this part. The checks of the `#render` slot run in the hooks of this part,
// and they then do not see the element.
const PORTAL_PROPS = { [createAttribute('portal')]: '', style: { display: 'contents' } };

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldScrubAreaCursorProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: NumberFieldScrubAreaCursorState }): unknown;
  render: ComponentRenderFn<HTMLProps, NumberFieldScrubAreaCursorState>;
}>();

const { state } = useNumberFieldRootContext();
const { isScrubbing, isTouchInput, isPointerLockDenied, scrubAreaCursorRef, scrubAreaElement } =
  useNumberFieldScrubAreaContext();

// The styles of a shadow root apply only in that root. The coordinates of the pointer are those of
// the document of the scrub area.
// A function reads the root node, because `getRootNode()` is not reactive.
function getContainer() {
  const scrubArea = scrubAreaElement.value;
  const root = scrubArea?.getRootNode();
  return root && isShadowRoot(root) ? root : ownerDocument(scrubArea).body;
}

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
  <Teleport v-if="shouldRender" :to="getContainer()">
    <div v-bind="PORTAL_PROPS">
      <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
      <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
    </div>
  </Teleport>
</template>
