<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Side } from '../../internals/useAnchorPositioning';

export interface ComboboxInputGroupState extends FieldRootState {
  /**
   * Whether the corresponding popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxInputGroupProps
  extends
    VaseUIComponentProps<ComboboxInputGroupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, toRaw } from 'vue';
import { contains } from '../../common/shadowDom';
import { useFieldRootContext } from '../../internals/field-root-context';
import type { ComponentRenderFn, HTMLProps, VaseUIEvent } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { handleInputPress } from '../utils/handleInputPress';
import { useListEmpty, usePopupSide } from '../utils/parts';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxInputGroupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxInputGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxInputGroupState>;
}>();

const { state: fieldState } = useFieldRootContext();
const store = useComboboxRootContext();

const disabled = computed(() => store.select('disabled'));
const popupSide = usePopupSide(store);
const listEmpty = useListEmpty();

const state = computed<ComboboxInputGroupState>(() => ({
  ...fieldState.value,
  open: store.select('open'),
  disabled: disabled.value,
  readOnly: store.select('readOnly'),
  popupSide: popupSide.value,
  listEmpty: listEmpty.value,
  placeholder: store.select('selectionMode') === 'none' ? false : !store.select('hasSelectedValue'),
}));

// A template can mount the group that replaces this group before it unmounts this group. The
// group then clears the element in the store only when the store holds its own element.
let ownGroup: HTMLElement | null = null;
function setInputGroupElement(group: HTMLElement | null) {
  if (group !== null || toRaw(store.state).inputGroupElement === ownGroup) {
    store.set('inputGroupElement', group as HTMLDivElement | null);
  }
  ownGroup = group;
}

function handleMousedown(event: VaseUIEvent<MouseEvent>) {
  handleInputPress(event, store, disabled.value, (target) =>
    contains(store.context.chipsContainerRef.value, target),
  );
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: setInputGroupElement,
  props: (attrs) => [{ role: 'group', onMousedown: handleMousedown }, attrs],
  stateAttributesMapping: triggerStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
