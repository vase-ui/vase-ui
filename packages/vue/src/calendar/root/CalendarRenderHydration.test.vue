<script setup lang="ts">
import * as Calendar from '../index.parts';
</script>

<template>
  <Calendar.Root locale="en-US">
    <template #render="{ props }">
      <div v-bind="props">
        <Calendar.Months>
          <template #month="{ month }">
            <Calendar.Month :month="month">
              <Calendar.Grid>
                <Calendar.GridBody>
                  <template #week="{ week }">
                    <Calendar.Week :week="week">
                      <template #day="{ day }">
                        <Calendar.Day :day="day">
                          <Calendar.DayButton />
                        </Calendar.Day>
                      </template>
                    </Calendar.Week>
                  </template>
                </Calendar.GridBody>
              </Calendar.Grid>
            </Calendar.Month>
          </template>
        </Calendar.Months>
      </div>
    </template>
  </Calendar.Root>
</template>
