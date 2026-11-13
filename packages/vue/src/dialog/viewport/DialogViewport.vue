<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface DialogViewportState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the dialog is nested within another dialog.
   */
  nested: boolean;
  /**
   * Whether the dialog has nested dialogs open.
   */
  nestedDialogOpen: boolean;
}

export interface DialogViewportProps
  extends
    VaseUIComponentProps<DialogViewportState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useDialogPortalContext } from '../portal/DialogPortalContext';
import { useDialogRootContext } from '../root/DialogRootContext';
import { dialogStateAttributesMapping } from '../utils/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogViewportProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DialogViewportState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogViewportState>;
}>();

const keepMounted = useDialogPortalContext();
const store = useDialogRootContext();

const open = computed(() => store.select('open'));
const mounted = computed(() => store.select('mounted'));

const state = computed<DialogViewportState>(() => ({
  open: open.value,
  nested: store.select('nested'),
  transitionStatus: store.select('transitionStatus'),
  nestedDialogOpen: store.select('nestedOpenDialogCount') > 0,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: (viewport) => store.set('viewportElement', viewport),
  stateAttributesMapping: dialogStateAttributesMapping,
  props: (attrs) => [
    {
      role: 'presentation',
      hidden: mounted.value ? undefined : true,
      style: {
        'pointer-events': open.value ? undefined : 'none',
      },
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <template v-if="keepMounted || mounted">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
</template>
