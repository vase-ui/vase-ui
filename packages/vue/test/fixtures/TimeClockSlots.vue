<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { TimeClock } from '../../src/time-clock';

const time = Temporal.PlainTime.from('15:30');
const root = useTemplateRef('root');
const trigger = useTemplateRef('trigger');
const hand = useTemplateRef('hand');
defineExpose({ root, trigger, hand });
</script>

<!-- Each part with an `element` slot renders an element of the developer, with attributes of its own. -->
<template>
  <TimeClock.Root ref="root" :default-value="time" aria-label="Time">
    <template #element="{ props, elementRef, state }">
      <section v-bind="props" :ref="elementRef" :data-root-view="state.view">
        <TimeClock.ViewTrigger ref="trigger" view="hour">
          <template #element="slot">
            <button
              v-bind="slot.props"
              :ref="slot.elementRef"
              aria-label="Pick the hour"
              :data-active="slot.state.active"
            >
              H
            </button>
          </template>
        </TimeClock.ViewTrigger>
        <TimeClock.DayPeriod value="pm" type="submit">
          <template #element="slot">
            <button v-bind="slot.props" :ref="slot.elementRef">PM</button>
          </template>
        </TimeClock.DayPeriod>
        <TimeClock.Face aria-label="Hour">
          <TimeClock.Hand ref="hand" class="Hand">
            <template #element="slot">
              <i
                v-bind="slot.props"
                :ref="slot.elementRef"
                class="Mine"
                :data-inner-hand="slot.state.inner"
              />
            </template>
          </TimeClock.Hand>
          <template #number="{ number }">
            <TimeClock.Number :number="number" class="Number">
              <template #element="slot">
                <b
                  v-bind="slot.props"
                  :ref="slot.elementRef"
                  class="Mine"
                  :data-picked="slot.state.selected"
                  >{{ number.value }}</b
                >
              </template>
            </TimeClock.Number>
          </template>
        </TimeClock.Face>
      </section>
    </template>
  </TimeClock.Root>
</template>
