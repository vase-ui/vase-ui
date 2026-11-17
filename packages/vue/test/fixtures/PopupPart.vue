<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../src/internals/types';
import type { TransitionStatus } from '../../src/internals/useTransitionStatus';

export interface PopupPartState {
  /** Whether the popup is open. */
  open: boolean;
  transitionStatus: TransitionStatus;
}

export interface PopupPartProps
  extends VaseUIComponentProps<PopupPartState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /** Whether the element stays in the DOM while the popup is closed. */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRenderElement } from '../../src/internals/useRenderElement';
import { popupTransitionStateMapping } from '../../src/utils/popups/popupStateMapping';
import { PopupFixtureContext } from './PopupFixture';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopupPartProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: PopupPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopupPartState>;
}>();

const store = inject(PopupFixtureContext);
if (store === undefined) {
  throw new Error('Vase UI: <PopupPart> must be inside <PopupRootPart>.');
}

const open = computed(() => store.select('open'));
const mounted = computed(() => store.select('mounted'));
const defaultPopupId = computed(() => store.select('defaultPopupId'));
const state = computed<PopupPartState>(() => ({
  open: open.value,
  transitionStatus: store.select('transitionStatus'),
}));

const { element, elementProps, setRef } = useRenderElement('div', props, {
  state,
  ref: [
    (popupElement) => {
      store.context.popupRef.value = popupElement;
      store.set('popupElement', popupElement);
    },
  ],
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    { id: defaultPopupId.value, role: 'dialog', hidden: mounted.value ? undefined : true },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="(mounted || keepMounted) && $slots.render"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component :is="as" v-else-if="mounted || keepMounted" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
