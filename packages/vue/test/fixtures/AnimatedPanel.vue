<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../src/internals/types';
import type { TransitionStatus } from '../../src/internals/useTransitionStatus';

export interface AnimatedPanelState {
  /** Whether the panel is open. */
  open: boolean;
  /** The transition status of the panel. */
  transitionStatus: TransitionStatus;
}

export interface AnimatedPanelProps
  extends
    VaseUIComponentProps<AnimatedPanelState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /** Whether the panel is open. */
  open: boolean;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Whether completions that are ready in the same microtask share one flush.
   * @default false
   */
  batch?: boolean | undefined;
  /**
   * Whether the status has the `'idle'` value between `'starting'` and `'ending'`.
   * The part reads it one time, in `setup`.
   * @default false
   */
  enableIdleState?: boolean | undefined;
  /**
   * Whether a panel that mounts open still gets the `'starting'` status.
   * The part reads it one time, in `setup`.
   * @default false
   */
  animateInitialOpen?: boolean | undefined;
  /**
   * Whether the completion of an open or a close runs in a later task.
   * A frame can then paint a closed panel.
   * @default false
   */
  completeInLaterTask?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { transitionStatusMapping } from '../../src/internals/stateAttributesMapping';
import { useOpenChangeComplete } from '../../src/internals/useOpenChangeComplete';
import { useRenderElement } from '../../src/internals/useRenderElement';
import { useTransitionStatus } from '../../src/internals/useTransitionStatus';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AnimatedPanelProps>(), {
  as: 'div',
  keepMounted: false,
  batch: false,
  enableIdleState: false,
  animateInitialOpen: false,
  completeInLaterTask: false,
});

const emit = defineEmits<{
  openChangeComplete: [open: boolean];
}>();

defineSlots<{
  default(props: { state: AnimatedPanelState }): unknown;
  render: ComponentRenderFn<HTMLProps, AnimatedPanelState>;
}>();

// The getter for `element` runs after `setup`, so the later declaration of `element` is in scope.
const { mounted, setMounted, transitionStatus } = useTransitionStatus(
  () => props.open,
  props.enableIdleState,
  false,
  props.animateInitialOpen,
  () => element.value,
);

const state = computed<AnimatedPanelState>(() => ({
  open: props.open,
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
  props: (attrs) => [{ hidden: mounted.value ? undefined : true }, attrs],
  stateAttributesMapping: transitionStatusMapping,
});

function completeOpenChange() {
  if (!props.open) {
    setMounted(false);
  }
  emit('openChangeComplete', props.open);
}

useOpenChangeComplete({
  open: () => props.open,
  ref: element,
  batch: props.batch,
  onComplete() {
    if (props.completeInLaterTask) {
      setTimeout(completeOpenChange, 0);
    } else {
      completeOpenChange();
    }
  },
});

defineExpose({ element });
</script>

<template>
  <template v-if="keepMounted || mounted">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
</template>

<style>
.animated-panel-transition {
  width: 100px;
  height: 40px;
  background: gray;
  transition: opacity 150ms linear;
}

.animated-panel-transition[data-starting-style],
.animated-panel-transition[data-ending-style] {
  opacity: 0;
}

/* No fill mode: a closed panel that a frame paints is at full opacity. */
.animated-panel-animation {
  width: 100px;
  height: 40px;
  background: gray;
}

.animated-panel-animation[data-ending-style] {
  animation: animated-panel-out 150ms linear;
}

@keyframes animated-panel-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

/* The exit of a panel that a test moves to its end must not end by itself. A late frame can end a
   short exit before the part reads its animations. */
.animated-panel-long-exit[data-ending-style] {
  transition-duration: 100s;
  animation-duration: 100s;
}
</style>
