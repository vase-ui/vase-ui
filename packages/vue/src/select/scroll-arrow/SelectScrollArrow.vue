<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface SelectScrollArrowState {
  /**
   * The direction of the element.
   */
  direction: 'up' | 'down';
  /**
   * Whether the element is visible.
   */
  visible: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectScrollArrowProps
  extends
    VaseUIComponentProps<SelectScrollArrowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  direction: 'up' | 'down';
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose } from 'vue';
import { useTimeout } from '../../common/useTimeout';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import {
  getMaxScrollOffset,
  normalizeScrollOffset,
  SCROLL_EDGE_TOLERANCE_PX,
} from '../../utils/scrollEdges';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useSelectRootContext } from '../root/SelectRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectScrollArrowProps>(), {
  as: 'div',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: SelectScrollArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectScrollArrowState>;
}>();

const store = useSelectRootContext();
const { side } = useSelectPositionerContext();

const isUp = computed(() => props.direction === 'up');

// Scroll arrows are disabled for touch modality as they are a hover-only element.
const visible = computed(
  () =>
    store.select(isUp.value ? 'scrollUpArrowVisible' : 'scrollDownArrowVisible') &&
    store.select('openMethod') !== 'touch',
);

const timeout = useTimeout();

// The getter for `element` runs after `setup`, so the later declaration of `element` is in scope.
const { mounted, transitionStatus, setMounted } = useTransitionStatus(
  visible,
  false,
  false,
  false,
  () => element.value,
);

let unregisterScrollArrow: (() => void) | undefined;

onMounted(() => {
  unregisterScrollArrow = store.context.registerScrollArrow();
});
onScopeDispose(() => {
  unregisterScrollArrow?.();
});

const state = computed<SelectScrollArrowState>(() => ({
  direction: props.direction,
  visible: visible.value,
  side: side.value,
  transitionStatus: transitionStatus.value,
}));

function scrollNextItem() {
  const scroller = store.select('listElement') ?? store.context.popupRef.value;
  if (!scroller) {
    return;
  }

  store.set('activeIndex', null);
  store.context.handleScrollArrowVisibility(scroller);

  const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
  const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
  const isScrolledToEdge = scrollTop === (isUp.value ? 0 : maxScrollTop);
  const items = store.context.listRef.value;

  if (scrollTop !== scroller.scrollTop) {
    scroller.scrollTop = scrollTop;
  }

  if (isScrolledToEdge) {
    timeout.clear();
    return;
  }

  if (items.length > 0) {
    const scrollArrowHeight = element.value?.offsetHeight || 0;
    scroller.scrollTop = getTargetScrollTop(
      items,
      props.direction,
      scrollTop,
      scroller.clientHeight,
      scrollArrowHeight,
      maxScrollTop,
    );
  }

  timeout.start(40, scrollNextItem);
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: transitionStatusMapping,
  props: (attrs) => [
    {
      'aria-hidden': true,
      style: { position: 'absolute' },
      onMousemove(event: MouseEvent) {
        if ((event.movementX === 0 && event.movementY === 0) || timeout.isStarted()) {
          return;
        }

        store.set('activeIndex', null);
        timeout.start(40, scrollNextItem);
      },
      onMouseleave() {
        timeout.clear();
      },
    },
    attrs,
  ],
});

useOpenChangeComplete({
  open: visible,
  ref: element,
  onComplete() {
    if (!visible.value) {
      setMounted(false);
    }
  },
});

const shouldRender = computed(() => mounted.value || props.keepMounted);

defineExpose({ element });

function getTargetScrollTop(
  items: (HTMLElement | null)[],
  direction: 'up' | 'down',
  scrollTop: number,
  clientHeight: number,
  scrollArrowHeight: number,
  maxScrollTop: number,
) {
  if (direction === 'up') {
    let firstVisibleIndex = 0;
    const visibleTop = scrollTop + scrollArrowHeight - SCROLL_EDGE_TOLERANCE_PX;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.offsetTop >= visibleTop) {
        firstVisibleIndex = i;
        break;
      }
    }

    const targetIndex = Math.max(0, firstVisibleIndex - 1);
    const targetItem = items[targetIndex];
    return targetIndex < firstVisibleIndex && targetItem
      ? normalizeScrollOffset(targetItem.offsetTop - scrollArrowHeight, maxScrollTop)
      : 0;
  }

  let lastVisibleIndex = items.length - 1;
  const visibleBottom = scrollTop + clientHeight - scrollArrowHeight + SCROLL_EDGE_TOLERANCE_PX;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item && item.offsetTop + item.offsetHeight > visibleBottom) {
      lastVisibleIndex = Math.max(0, i - 1);
      break;
    }
  }

  const targetIndex = Math.min(items.length - 1, lastVisibleIndex + 1);
  const targetItem = items[targetIndex];
  return targetIndex > lastVisibleIndex && targetItem
    ? normalizeScrollOffset(
        targetItem.offsetTop + targetItem.offsetHeight - clientHeight + scrollArrowHeight,
        maxScrollTop,
      )
    : maxScrollTop;
}
</script>

<template>
  <template v-if="shouldRender">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"
      ><slot :state="state">{{ isUp ? '▲' : '▼' }}</slot></component
    >
  </template>
</template>
