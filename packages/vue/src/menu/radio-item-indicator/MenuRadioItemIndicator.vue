<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface MenuRadioItemIndicatorState {
  /**
   * Whether the radio item is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface MenuRadioItemIndicatorProps
  extends
    VaseUIComponentProps<MenuRadioItemIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the HTML element in the DOM when the radio item is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { useMenuRadioItemContext } from '../radio-item/MenuRadioItemContext';
import { itemMapping } from '../utils/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuRadioItemIndicatorProps>(), {
  as: 'span',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: MenuRadioItemIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuRadioItemIndicatorState>;
}>();

const item = useMenuRadioItemContext();

const checked = computed(() => item.value.checked);

// The getter for `element` runs after `setup`, so the later declaration of `element` is in scope.
// The indicator has an enter transition, so the composable needs the element.
const { mounted, transitionStatus, setMounted } = useTransitionStatus(
  checked,
  false,
  false,
  false,
  () => element.value,
);

const state = computed<MenuRadioItemIndicatorState>(() => ({
  checked: item.value.checked,
  disabled: item.value.disabled,
  highlighted: item.value.highlighted,
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps } = useRenderElement('span', props, {
  state,
  stateAttributesMapping: itemMapping,
  props: (attrs) => [{ 'aria-hidden': true }, attrs],
});

useOpenChangeComplete({
  batch: true,
  enabled: () => !checked.value,
  open: checked,
  ref: element,
  onComplete() {
    if (!checked.value) {
      setMounted(false);
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
