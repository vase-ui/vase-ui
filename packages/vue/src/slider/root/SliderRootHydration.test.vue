<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Slider } from '@vase-ui/vue/slider';

defineProps<{
  id?: string | undefined;
  defaultValue: number;
  sliderLabel?: 'before' | 'after' | undefined;
  field?: boolean | undefined;
  laterRemovedAtMount?: boolean | undefined;
}>();

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Field.Root v-if="field">
    <Slider.Root :id="id" :default-value="defaultValue" data-testid="root">
      <Slider.Label v-if="sliderLabel === 'before'">Volume</Slider.Label>
      <Slider.Control>
        <Slider.Thumb data-testid="thumb" />
      </Slider.Control>
      <Slider.Label v-if="sliderLabel === 'after' && !(laterRemovedAtMount && isMounted)">
        Volume
      </Slider.Label>
    </Slider.Root>
    <template v-if="!(laterRemovedAtMount && isMounted)">
      <Field.Label id="label-a">Volume</Field.Label>
      <Field.Description id="desc-a">Set the volume.</Field.Description>
    </template>
  </Field.Root>
  <Slider.Root v-else :id="id" :default-value="defaultValue" data-testid="root">
    <Slider.Label v-if="sliderLabel === 'before'">Volume</Slider.Label>
    <Slider.Control>
      <Slider.Thumb data-testid="thumb" />
    </Slider.Control>
    <Slider.Label v-if="sliderLabel === 'after' && !(laterRemovedAtMount && isMounted)">
      Volume
    </Slider.Label>
  </Slider.Root>
</template>
