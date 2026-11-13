<script setup lang="ts">
import { useId } from 'vue';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import styles from './index.module.css';

const id = useId();
</script>

<template>
  <RadioGroup :aria-labelledby="id" default-value="fuji-apple" :class="styles.RadioGroup">
    <div :class="styles.Caption" :id="id">Best apple</div>

    <label :class="styles.Item">
      <Radio.Root value="fuji-apple" :class="styles.Radio">
        <Radio.Indicator :class="styles.Indicator" />
      </Radio.Root>
      Fuji
    </label>

    <label :class="styles.Item">
      <Radio.Root value="gala-apple" :class="styles.Radio">
        <Radio.Indicator :class="styles.Indicator" />
      </Radio.Root>
      Gala
    </label>

    <label :class="styles.Item">
      <Radio.Root value="granny-smith-apple" :class="styles.Radio">
        <Radio.Indicator :class="styles.Indicator" />
      </Radio.Root>
      Granny Smith
    </label>
  </RadioGroup>
</template>
