<script setup lang="ts">
import CompositeItemPart from '../../../../test/fixtures/CompositeItemPart.vue';
import { useCompositeRoot } from '../root/useCompositeRoot';
import CompositeItemAsyncBranch from './CompositeItemAsyncBranch.test.vue';

const props = defineProps<{
  hasActiveItem?: boolean;
  active?: string[];
  disabled?: string[];
  late?: boolean;
}>();

const { props: compositeProps, rootRef } = useCompositeRoot({
  hasActiveItem: () => props.hasActiveItem,
});

// A family writes the attributes of an item itself, so the fixture does the same.
function itemProps(id: string) {
  const isActive = props.active?.includes(id) ?? false;
  const isDisabled = props.disabled?.includes(id) ?? false;
  return {
    'data-testid': id,
    active: isActive,
    'data-composite-item-active': isActive ? '' : undefined,
    disabled: isDisabled,
    'aria-disabled': isDisabled ? ('true' as const) : undefined,
  };
}
</script>

<template>
  <div v-bind="compositeProps" :ref="(element) => rootRef(element as HTMLElement | null)">
    <CompositeItemPart v-bind="itemProps('a')" />
    <Suspense v-if="late">
      <CompositeItemAsyncBranch>
        <CompositeItemPart v-bind="itemProps('b')" />
      </CompositeItemAsyncBranch>
    </Suspense>
    <CompositeItemPart v-else v-bind="itemProps('b')" />
    <CompositeItemPart v-bind="itemProps('c')" />
  </div>
</template>
