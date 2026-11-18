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
import { computed, useTemplateRef } from 'vue';
import type { CSSProperties } from 'vue';
import { ownerDocument, ownerWindow } from '../../common/owner';
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
const { isScrubbing, isTouchInput, isPointerLockDenied, registerCursor, scrubAreaElement } =
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

const portal = useTemplateRef<HTMLElement>('portal');
const probe = useTemplateRef<HTMLDivElement>('probe');
let transform: string | undefined;
let releaseCursor: (() => void) | undefined;

function setCursorElement(node: HTMLSpanElement | null) {
  transform = undefined;
  releaseCursor?.();
  releaseCursor = node ? registerCursor({ element: node, place }) : undefined;
}

function place(x: number, y: number) {
  const node = element.value;
  const bounds = probe.value?.getBoundingClientRect();
  if (!node || !bounds) return;

  // The page can move or scale the containing block between pointer events.
  const halfWidth = node.offsetWidth / 2;
  const halfHeight = node.offsetHeight / 2;
  const blockX = ((x + halfWidth - bounds.left) * 100) / bounds.width - halfWidth;
  const blockY = ((y + halfHeight - bounds.top) * 100) / bounds.height - halfHeight;
  const scale = ownerWindow(node).visualViewport?.scale ?? 1;
  transform = `translate3d(${blockX}px,${blockY}px,0) scale(${1 / scale})`;
  // A bound transform exceeded the frame budget during a scrub.
  node.style.transform = transform;
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

// The portal has no box. A render slot can supply its own containing block.
const probeTarget = computed(() => {
  const parent = element.value?.parentNode;
  return parent === portal.value ? getContainer() : (parent as Element | ShadowRoot | undefined);
});
const { isHeld } = useKeepAliveState();
usePortalRegistration(portal, isHeld);

defineExpose({ element });
</script>

<template>
  <Teleport v-if="shouldRender" :to="getContainer()">
    <div ref="portal" v-bind="PORTAL_PROPS">
      <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
      <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
        <slot :state="state" />
      </component>
      <Teleport v-if="probeTarget" :to="probeTarget">
        <div
          ref="probe"
          aria-hidden="true"
          inert
          style="
            all: initial;
            position: fixed;
            left: 0;
            top: 0;
            width: 100px;
            height: 100px;
            visibility: hidden;
            pointer-events: none;
          "
        />
      </Teleport>
    </div>
  </Teleport>
</template>
