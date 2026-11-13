<script setup lang="ts">
import CompositeItemPart from '../../../../test/fixtures/CompositeItemPart.vue';
import CompositeRootPart from '../../../../test/fixtures/CompositeRootPart.vue';
import CompositeItemAsyncBranch from './CompositeItemAsyncBranch.test.vue';

const props = defineProps<{ disabled?: string[] }>();

// A family writes the attributes of an item itself, so the fixture does the same.
function itemProps(id: string) {
  const isDisabled = props.disabled?.includes(id) ?? false;
  return {
    'data-testid': id,
    disabled: isDisabled,
    'aria-disabled': isDisabled ? ('true' as const) : undefined,
  };
}
</script>

<template>
  <Suspense>
    <CompositeRootPart>
      <CompositeItemPart v-bind="itemProps('a')" />
      <CompositeItemAsyncBranch>
        <CompositeItemPart v-bind="itemProps('b')" />
      </CompositeItemAsyncBranch>
      <CompositeItemPart v-bind="itemProps('c')" />
    </CompositeRootPart>
  </Suspense>
</template>
