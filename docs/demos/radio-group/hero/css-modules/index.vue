<script setup lang="ts">
import { useId } from 'vue';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import styles from './index.module.css';

const captionId = useId();
</script>

<template>
  <RadioGroup :aria-labelledby="captionId" default-value="fuji-apple" :class="styles.RadioGroup">
    <div :class="styles.Caption" :id="captionId">Best apple</div>

    <label :class="styles.Item">
      <Radio value="fuji-apple" :class="styles.Radio" />
      Fuji
    </label>

    <label :class="styles.Item">
      <Radio value="gala-apple" :class="styles.Radio" />
      Gala
    </label>

    <label :class="styles.Item">
      <Radio value="granny-smith-apple" :class="styles.Radio" />
      Granny Smith
    </label>
  </RadioGroup>
</template>
