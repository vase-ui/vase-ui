<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface SelectPopupState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectPopupProps
  extends
    VaseUIComponentProps<SelectPopupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { DISABLED_TRANSITIONS_STYLE } from '../../internals/constants';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useSelectRootContext } from '../root/SelectRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectPopupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectPopupState>;
}>();

const store = useSelectRootContext();
const { side, align } = useSelectPositionerContext();
const insideToolbar = useToolbarRootContext(true) !== undefined;

const open = computed(() => store.select('open'));
const transitionStatus = computed(() => store.select('transitionStatus'));

useOpenChangeComplete({
  open,
  ref: store.context.popupRef,
  onComplete() {
    if (open.value) {
      store.context.onOpenChangeComplete?.(true);
    }
  },
});

const state = computed<SelectPopupState>(() => ({
  open: open.value,
  transitionStatus: transitionStatus.value,
  side: side.value,
  align: align.value,
}));

// `Select.List` holds the role of the list when it exists.
const listProps = computed(() =>
  store.select('listElement')
    ? { role: 'presentation' }
    : {
        role: 'listbox',
        'aria-multiselectable': store.select('multiple') || undefined,
        'aria-readonly': store.select('readOnly') || undefined,
        id: `${store.select('id')}-list`,
      },
);

let popupElement: HTMLElement | null = null;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [
    (popup) => {
      // A compiled template can mount a new popup before it unmounts the old one. The old one then
      // must not clear the element of the new one.
      if (popup !== null || store.context.popupRef.value === popupElement) {
        store.context.popupRef.value = popup;
        store.set('popupElement', popup);
      }
      popupElement = popup;
    },
  ],
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    store.select('popupProps'),
    {
      ...listProps.value,
      onKeydown(event: KeyboardEvent) {
        // The arrow keys of the popup must not move the focus of a toolbar around the trigger.
        if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
          event.stopPropagation();
        }
      },
    },
    transitionStatus.value === 'starting' ? DISABLED_TRANSITIONS_STYLE : undefined,
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
