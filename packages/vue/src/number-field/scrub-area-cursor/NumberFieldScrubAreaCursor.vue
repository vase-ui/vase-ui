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
import { computed, shallowRef } from 'vue';
import type { CSSProperties } from 'vue';
import { ownerDocument } from '../../common/owner';
import { platform } from '../../common/platform';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import { usePortalRegistration } from '../../utils/popups/portal/portalElements';
import { createAttribute } from '../../utils/popups/createAttribute';
import {
  useNumberFieldRootContext,
  useNumberFieldScrubAreaContext,
  stateAttributesMapping,
} from '../root/NumberFieldRootContext';

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
const { isScrubbing, isTouchInput, isPointerLockDenied, cursor, scrubAreaElement } =
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

let transform: string | undefined;

// A replacement cursor can register before its predecessor unmounts.
function setCursorElement(next: HTMLSpanElement | null) {
  transform = undefined;
  if (next) {
    cursor.value = { element: next, setTransform };
  } else if (cursor.value?.setTransform === setTransform) {
    cursor.value = null;
  }
}

function setTransform(value: string) {
  transform = value;
  // A bound cursor transform added more than 10% to frame work.
  if (element.value) {
    element.value.style.transform = value;
  }
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  NumberFieldScrubAreaCursorState,
  HTMLSpanElement
>('span', props, {
  ref: setCursorElement,
  state,
  props: (attrs) => [{ role: 'presentation', style: CURSOR_STYLE }, attrs],
  overridingStyle: () => (transform ? { transform } : undefined),
  stateAttributesMapping,
});

const portal = shallowRef<HTMLElement | null>(null);
const { isHeld } = useKeepAliveState();
usePortalRegistration(portal, isHeld);

defineExpose({ element });
</script>

<template>
  <Teleport v-if="shouldRender" :to="getContainer()">
    <div v-bind="PORTAL_PROPS" :ref="(node) => (portal = node as HTMLElement | null)">
      <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
      <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
        <slot :state="state" />
      </component>
    </div>
  </Teleport>
</template>
