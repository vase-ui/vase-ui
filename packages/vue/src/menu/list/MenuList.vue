<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface MenuListState {}

export interface MenuListProps
  extends
    VaseUIComponentProps<MenuListState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {
  /**
   * The id of the list. The active trigger of the menu uses it for `aria-controls`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { toRaw, watch } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { resolvePopupLabel } from '../../internals/resolvePopupLabel';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuRootContext } from '../root/MenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuListProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: MenuListState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuListState>;
}>();

const { store, orientation } = useMenuRootContext();

const listId = useVaseUiId(() => props.id);

let listElement: HTMLElement | null = null;

// `aria-controls` of the trigger reads the id from the store, so a change of the id goes there too.
watch(listId, (id) => {
  if (listElement !== null && toRaw(store.state).listElement === listElement) {
    store.set('listElementId', id);
  }
});

const state: MenuListState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [
    (list) => {
      // A compiled template can mount a new list before it unmounts the old one. The old list
      // then must not clear the element of the new one.
      if (list !== null || toRaw(store.state).listElement === listElement) {
        store.update({
          listElement: list,
          listElementId: list === null ? undefined : listId.value,
        });
      }
      listElement = list;
    },
  ],
  props: (attrs) => [
    {
      id: listId.value,
      role: 'menu',
      // The list holds the `menu` role, so it can take the focus in place of the popup.
      tabindex: -1,
      // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
      'aria-orientation': orientation.value === 'horizontal' ? 'horizontal' : undefined,
      'aria-labelledby': resolvePopupLabel(
        attrs,
        store.select('activeTriggerElement'),
        store.select('activeTriggerId'),
      ),
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
