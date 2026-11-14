<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type {
  MenuPositionerProps,
  MenuPositionerState,
} from '../../menu/positioner/MenuPositioner.vue';

export interface ContextMenuPositionerState extends MenuPositionerState {}

export interface ContextMenuPositionerProps
  extends
    VaseUIComponentProps<ContextMenuPositionerState>,
    Omit<
      MenuPositionerProps,
      | 'as'
      | 'stateClass'
      | 'stateStyle'
      | 'anchor'
      | 'positionMethod'
      | 'side'
      | 'sideOffset'
      | 'align'
      | 'alignOffset'
      | 'arrowPadding'
    >,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * An element to position the popup against.
   * By default, root context menus are positioned at the pointer, and submenus are positioned
   * against their trigger.
   */
  anchor?: MenuPositionerProps['anchor'] | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   *
   * Submenus default to `'inline-end'`.
   * @default 'bottom'
   */
  side?: MenuPositionerProps['side'] | undefined;
  /**
   * Distance between the anchor and the popup in pixels.
   * Also accepts a function that returns the distance to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * Defaults to `-5` for root context menus when `side` is not specified and `align` is not
   * `'center'`. Otherwise, it defaults to `0`.
   *
   * @example
   * ```vue
   * <ContextMenu.Positioner
   *   :side-offset="({ side, anchor }) =>
   *     side === 'top' || side === 'bottom' ? anchor.height : anchor.width
   *   "
   * />
   * ```
   */
  sideOffset?: MenuPositionerProps['sideOffset'] | undefined;
  /**
   * How to align the popup relative to the specified side.
   * @default 'start'
   */
  align?: MenuPositionerProps['align'] | undefined;
  /**
   * Additional offset along the alignment axis in pixels.
   * Also accepts a function that returns the offset to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * Defaults to `2` for root context menus when `side` is not specified and `align` is not
   * `'center'`. Otherwise, it defaults to `0`.
   *
   * @example
   * ```vue
   * <ContextMenu.Positioner
   *   :align-offset="({ side, anchor }) =>
   *     side === 'top' || side === 'bottom' ? anchor.width : anchor.height
   *   "
   * />
   * ```
   */
  alignOffset?: MenuPositionerProps['alignOffset'] | undefined;
  /**
   * Minimum distance to maintain between the arrow and the edges of the popup.
   *
   * Root context menus always use `0`. Submenus default to `5`.
   */
  arrowPadding?: MenuPositionerProps['arrowPadding'] | undefined;
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import MenuPositioner from '../../menu/positioner/MenuPositioner.vue';

defineOptions({ inheritAttrs: false });

// `side`, `align` and the offsets have no default here, because `Menu.Positioner` gives each of
// them a default from the parent of the menu.
const props = withDefaults(defineProps<ContextMenuPositionerProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ContextMenuPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, ContextMenuPositionerState>;
}>();

// As in Base UI, this part renders `Menu.Positioner` and makes no element of its own.
const positioner = useTemplateRef('positioner');
const element = computed(() => positioner.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <MenuPositioner ref="positioner" v-bind="{ ...$attrs, ...props }">
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </MenuPositioner>
</template>
