<script setup lang="ts">
import { h, ref, useId } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import styles from './index.module.css';

const fruits = ['fuji-apple', 'gala-apple', 'granny-smith-apple'];

const id = useId();
const value = ref<string[]>([]);

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

const HorizontalRuleIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '12',
      height: '12',
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      'stroke-width': 1,
      style: { display: 'block' },
    },
    [
      h('line', {
        x1: '3',
        y1: '12',
        x2: '21',
        y2: '12',
        stroke: 'currentColor',
        'vector-effect': 'non-scaling-stroke',
      }),
    ],
  );
</script>

<template>
  <CheckboxGroup
    v-model:value="value"
    :aria-labelledby="id"
    :all-values="fruits"
    :class="styles.CheckboxGroup"
    :style="{ marginLeft: '1rem' }"
  >
    <label :class="styles.Item" :id="id" :style="{ marginLeft: '-1rem' }">
      <Checkbox.Root :class="styles.Checkbox" parent>
        <Checkbox.Indicator :class="styles.Indicator">
          <template #render="{ props, state }">
            <span v-bind="props">
              <HorizontalRuleIcon v-if="state.indeterminate" />
              <CheckIcon v-else />
            </span>
          </template>
        </Checkbox.Indicator>
      </Checkbox.Root>
      Apples
    </label>

    <label :class="styles.Item">
      <Checkbox.Root value="fuji-apple" :class="styles.Checkbox">
        <Checkbox.Indicator :class="styles.Indicator">
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      Fuji
    </label>

    <label :class="styles.Item">
      <Checkbox.Root value="gala-apple" :class="styles.Checkbox">
        <Checkbox.Indicator :class="styles.Indicator">
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      Gala
    </label>

    <label :class="styles.Item">
      <Checkbox.Root value="granny-smith-apple" :class="styles.Checkbox">
        <Checkbox.Indicator :class="styles.Indicator">
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      Granny Smith
    </label>
  </CheckboxGroup>
</template>
