<script setup lang="ts">
import { h, useId } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import styles from './index.module.css';

const id = useId();

const CheckIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'm2.5 8.5 4 4 7-9' })],
  );
</script>

<template>
  <CheckboxGroup
    :aria-labelledby="id"
    :default-value="['fuji-apple']"
    :class="styles.CheckboxGroup"
  >
    <div :class="styles.Caption" :id="id">Apples</div>

    <label :class="styles.Item">
      <Checkbox.Root name="apple" value="fuji-apple" :class="styles.Checkbox">
        <Checkbox.Indicator :class="styles.Indicator">
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      Fuji
    </label>

    <label :class="styles.Item">
      <Checkbox.Root name="apple" value="gala-apple" :class="styles.Checkbox">
        <Checkbox.Indicator :class="styles.Indicator">
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      Gala
    </label>

    <label :class="styles.Item">
      <Checkbox.Root name="apple" value="granny-smith-apple" :class="styles.Checkbox">
        <Checkbox.Indicator :class="styles.Indicator">
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      Granny Smith
    </label>
  </CheckboxGroup>
</template>
