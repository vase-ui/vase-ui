<script setup lang="ts">
import { useId } from 'vue';
import { TimeClock } from '@vase-ui/vue/time-clock';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { Popover } from '@vase-ui/vue/popover';
import styles from '../../_index.module.css';

const id = useId();
const defaultValue = Temporal.PlainTime.from('10:30');

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Reminder time</label>
    <TimePicker.Root :default-value="defaultValue" locale="en-US" :hour-cycle="12">
      <div :class="styles.Control">
        <TimePicker.Field :id="id" :class="styles.Group">
          <TimeField.Input :class="styles.Input">
            <template #segment="{ segment }">
              <TimeField.Segment
                v-if="segment.editable"
                :segment="segment"
                :class="styles.Segment"
              />
              <TimeField.Literal v-else :segment="segment" :class="styles.Literal" />
            </template>
          </TimeField.Input>
        </TimePicker.Field>
        <TimePicker.Trigger aria-label="Choose time" :class="styles.Trigger">
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-linecap="square"
          >
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 4.5V8l2.5 1.5" />
          </svg>
        </TimePicker.Trigger>
      </div>
      <Popover.Portal>
        <TimePicker.Positioner :side-offset="4">
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <TimePicker.Popup aria-label="Choose a reminder time" :class="styles.Popup">
              <TimePicker.Clock :class="styles.Clock">
                <div :class="styles.Header">
                  <TimeClock.ViewTrigger view="hour" :class="styles.ViewTrigger" />
                  <span aria-hidden="true" :class="styles.Separator">:</span>
                  <TimeClock.ViewTrigger view="minute" :class="styles.ViewTrigger" />
                  <TimeClock.DayPeriod value="am" :class="styles.DayPeriod" />
                  <TimeClock.DayPeriod value="pm" :class="styles.DayPeriod" />
                </div>
                <TimeClock.Face :class="styles.Face">
                  <TimeClock.Hand :class="styles.Hand" />
                  <template #number="{ number }">
                    <TimeClock.Number :number="number" :class="styles.Number" />
                  </template>
                </TimeClock.Face>
              </TimePicker.Clock>
            </TimePicker.Popup>
          </Transition>
        </TimePicker.Positioner>
      </Popover.Portal>
    </TimePicker.Root>
  </div>
</template>
