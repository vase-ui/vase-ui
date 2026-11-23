<script setup lang="ts">
import { DatePicker } from '@ark-ui/vue/date-picker';
import { parseDate } from '@internationalized/date';
import '../../../behavior/style.css';

const locale = new URLSearchParams(location.search).get('locale') ?? 'en-US';
const defaultValue = [parseDate('2026-01-31')];
</script>

<template>
  <div class="bench-page">
    <!-- The inline form of the docs has no Content part, and there the arrow keys move no focus. -->
    <DatePicker.Root
      data-bench="calendar"
      default-open
      :default-value="defaultValue"
      :locale="locale"
    >
      <DatePicker.Label>Date</DatePicker.Label>
      <DatePicker.Control>
        <DatePicker.Input />
        <DatePicker.Trigger>Open</DatePicker.Trigger>
      </DatePicker.Control>
      <DatePicker.Positioner>
        <DatePicker.Content>
          <DatePicker.View view="day">
            <DatePicker.Context v-slot="api">
              <DatePicker.ViewControl>
                <DatePicker.PrevTrigger>&lsaquo;</DatePicker.PrevTrigger>
                <DatePicker.ViewTrigger>
                  <DatePicker.RangeText data-bench="calendar-heading" />
                </DatePicker.ViewTrigger>
                <DatePicker.NextTrigger>&rsaquo;</DatePicker.NextTrigger>
              </DatePicker.ViewControl>
              <DatePicker.Table>
                <DatePicker.TableHead>
                  <DatePicker.TableRow>
                    <DatePicker.TableHeader v-for="(weekDay, id) in api.weekDays" :key="id">
                      {{ weekDay.short }}
                    </DatePicker.TableHeader>
                  </DatePicker.TableRow>
                </DatePicker.TableHead>
                <DatePicker.TableBody>
                  <DatePicker.TableRow v-for="(week, id) in api.weeks" :key="id">
                    <DatePicker.TableCell v-for="(day, id) in week" :key="id" :value="day">
                      <DatePicker.TableCellTrigger>{{ day.day }}</DatePicker.TableCellTrigger>
                    </DatePicker.TableCell>
                  </DatePicker.TableRow>
                </DatePicker.TableBody>
              </DatePicker.Table>
            </DatePicker.Context>
          </DatePicker.View>
        </DatePicker.Content>
      </DatePicker.Positioner>
    </DatePicker.Root>
  </div>
</template>
