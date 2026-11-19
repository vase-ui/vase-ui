<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import type { NavigationMenuActivationDirection } from '../root/NavigationMenuRootContext';
import * as NavigationMenuContentDataAttributes from './NavigationMenuContentDataAttributes';

export interface NavigationMenuContentState {
  /**
   * If `true`, the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * The direction of the activation.
   */
  activationDirection: NavigationMenuActivationDirection;
}

export interface NavigationMenuContentProps
  extends
    VaseUIComponentProps<NavigationMenuContentState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the content mounted in the DOM while the popup is closed.
   * Ensures the content is present during server-side rendering for web crawlers.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

const stateAttributesMapping: StateAttributesMapping<NavigationMenuContentState> = {
  ...popupTransitionStateMapping,
  activationDirection(value) {
    if (!value) {
      return null;
    }
    return {
      [NavigationMenuContentDataAttributes.activationDirection]: value,
    };
  },
};
</script>

<script setup lang="ts">
import { computed, shallowRef, watchPostEffect, watchSyncEffect } from 'vue';
import { contains, getTarget } from '../../common/shadowDom';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { createAttribute } from '../../utils/popups/createAttribute';
import { provideFloatingNode } from '../../utils/popups/tree/FloatingTree';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuContentProps>(), {
  as: 'div',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: NavigationMenuContentState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuContentState>;
}>();

const {
  nodeId,
  mounted: popupMounted,
  viewportElement,
  value,
  activationDirection,
  registerContent,
  viewportTargetElement,
} = useNavigationMenuRootContext();
const { value: itemValue } = useNavigationMenuItemContext();
provideFloatingNode(nodeId);

const open = computed(() => popupMounted.value && value.value === itemValue.value);

const portalContainer = computed(() => viewportTargetElement.value || viewportElement.value);
const hasMountedInPortal = shallowRef(false);

watchSyncEffect(() => {
  if (props.keepMounted && portalContainer.value) hasMountedInPortal.value = true;
});

const shouldRenderInline = computed(
  () => props.keepMounted && !portalContainer.value && !hasMountedInPortal.value,
);

// The inline content is not the content that the popup shows, so it has no `contentElement`.
const renderedElement = shallowRef<HTMLElement | null>(null);
const contentElement = computed(() => (shouldRenderInline.value ? null : renderedElement.value));
const focusInside = shallowRef(false);

const { mounted, setMounted, transitionStatus } = useTransitionStatus(
  open,
  false,
  false,
  false,
  contentElement,
);

// When the popup unmounts before the exit animation of the content ends, the content resets its
// mounted state. The next open can then enter with the transition status `starting`.
watchSyncEffect(() => {
  if (mounted.value && !popupMounted.value) setMounted(false);
});

useOpenChangeComplete({
  enabled: () => !open.value,
  ref: contentElement,
  open,
  onComplete() {
    if (!open.value) {
      setMounted(false);
    }
  },
});

watchPostEffect((onCleanup) => {
  const content = contentElement.value;
  if (open.value && content) onCleanup(registerContent(content));
});

const state = computed<NavigationMenuContentState>(() => ({
  open: open.value,
  transitionStatus: transitionStatus.value,
  activationDirection: activationDirection.value,
}));

const hidden = computed(() => props.keepMounted && !mounted.value);
const shouldRenderInPortal = computed(
  () =>
    !shouldRenderInline.value && !!portalContainer.value && (mounted.value || props.keepMounted),
);

function handleFocusin(event: FocusEvent) {
  const target = getTarget(event) as Element | null;
  if (target?.hasAttribute(createAttribute('focus-guard'))) {
    return;
  }
  focusInside.value = true;
}

function handleFocusout(event: FocusEvent) {
  if (!contains(event.currentTarget as Element, event.relatedTarget as Element | null)) {
    focusInside.value = false;
  }
}

const { onFocusin, onFocusout, onKeydown, registerRoot } = useCompositeRoot({});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  elementRef: renderedElement,
  state,
  stateAttributesMapping,
  ref: registerRoot,
  props: (attrs) => [
    { onFocusin, onFocusout, onKeydown },
    {
      onFocusin: handleFocusin,
      onFocusout: handleFocusout,
      hidden: shouldRenderInline.value || hidden.value ? true : undefined,
      // A content that leaves stays in the viewport until its exit transition ends. It is out of the
      // flow, so it adds nothing to the size of the viewport, and it is inert unless the focus is in it.
      ...(!open.value && mounted.value
        ? {
            style: { position: 'absolute', top: 0, left: 0 },
            inert: focusInside.value ? undefined : true,
          }
        : undefined),
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="shouldRenderInline && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component :is="as" v-else-if="shouldRenderInline" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <Teleport v-else-if="shouldRenderInPortal" :to="portalContainer">
    <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
      <slot :state="state" />
    </component>
  </Teleport>
</template>
