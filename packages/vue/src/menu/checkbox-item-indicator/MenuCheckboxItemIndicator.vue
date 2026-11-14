<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface MenuCheckboxItemIndicatorState {
  /**
   * Whether the checkbox item is currently ticked.
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

export interface MenuCheckboxItemIndicatorProps
  extends
    VaseUIComponentProps<MenuCheckboxItemIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the HTML element in the DOM when the checkbox item is not checked.
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
import { useMenuCheckboxItemContext } from '../checkbox-item/MenuCheckboxItemContext';
import { itemMapping } from '../utils/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuCheckboxItemIndicatorProps>(), {
  as: 'span',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: MenuCheckboxItemIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuCheckboxItemIndicatorState>;
}>();

const item = useMenuCheckboxItemContext();

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

const state = computed<MenuCheckboxItemIndicatorState>(() => ({
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
