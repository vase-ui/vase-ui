<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { Switch, type SwitchState } from '@vase-ui/vue/switch';
</script>

<!-- A switch takes the native attributes of its input, and its slot gives the state. -->
<template>
  <Switch
    name="wifi"
    value="yes"
    form="settings"
    aria-label="Wifi"
    disabled
    focusable-when-disabled
  />
  <Switch :focusable-when-disabled="undefined" />
  <Switch>
    <template #element="{ props, elementRef, state }">
      <input
        v-bind="props"
        :ref="elementRef"
        @click="
          () => {
            expectType<SwitchState, typeof state>(state);
            expectType<(target: unknown) => void, typeof elementRef>(elementRef);
            expectType<Record<string, unknown>, typeof props>(props);
          }
        "
      />
    </template>
  </Switch>
  <!-- @vue-expect-error `focusableWhenDisabled` is a Boolean -->
  <Switch focusable-when-disabled="yes" />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Switch :aria-label="5" />
</template>
