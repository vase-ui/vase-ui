<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { Button, type ButtonState } from '@vase-ui/vue/button';
</script>

<!-- A button takes the native attributes of its element, and its slots give the state. -->
<template>
  <Button type="submit" form="order" name="action" value="save" aria-label="Save" />
  <Button v-slot="{ state }">
    <span @click="expectType<ButtonState, typeof state>(state)">Save</span>
  </Button>
  <Button>
    <template #element="{ props, elementRef, state }">
      <div
        v-bind="props"
        :ref="elementRef"
        @click="
          () => {
            expectType<ButtonState, typeof state>(state);
            expectType<(target: unknown) => void, typeof elementRef>(elementRef);
            expectType<Record<string, unknown>, typeof props>(props);
          }
        "
      >
        Save
      </div>
    </template>
  </Button>
  <!-- @vue-expect-error `focusableWhenDisabled` is a Boolean -->
  <Button focusable-when-disabled="yes" />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Button :aria-label="5" />
</template>
