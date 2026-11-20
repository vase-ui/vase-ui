---
order: 1
description: An unstyled Vue clock face that picks a time with a press, a drag or the keyboard.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoTimeClockHero from '../demos/time-clock/hero/css-modules/index.vue';
import DemoTimeClockHeroTailwind from '../demos/time-clock/hero/tailwind/index.vue';
import DemoTimeClockSeconds from '../demos/time-clock/seconds/css-modules/index.vue';
import DemoTimeClockSecondsTailwind from '../demos/time-clock/seconds/tailwind/index.vue';
import DemoTimeClockStep from '../demos/time-clock/step/css-modules/index.vue';
import DemoTimeClockStepTailwind from '../demos/time-clock/step/tailwind/index.vue';
import DemoTimeClockTwentyFourHours from '../demos/time-clock/twenty-four-hours/css-modules/index.vue';
import DemoTimeClockTwentyFourHoursTailwind from '../demos/time-clock/twenty-four-hours/tailwind/index.vue';
</script>

# Time Clock

A clock face that picks the hours, the minutes and the seconds of a time.

Base UI has no such component. The face follows the [slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) of the WAI-ARIA Authoring Practices Guide, which has no clock pattern. The entry point `@vase-ui/vue/time-clock` needs TypeScript 6.0, or `skipLibCheck`. See the [Dates and times](/handbook/dates-and-times) guide.

<DemoFrame>
  <DemoTimeClockHero />
  <template #tailwind>
    <DemoTimeClockHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/time-clock/hero/css-modules/index.vue

<<< ../demos/time-clock/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/time-clock/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./time-clock/Anatomy.vue

`TimeClock.Face` is the part that the user presses or drags. The `number` slot of the face gives each number of the face to `TimeClock.Number`. The face has no numbers without that slot. It also keeps a range input that is hidden from sight. The input is the one slider that assistive technology sees.

Bind the time with `v-model`. The value is a `Temporal.PlainTime`, a `Temporal.PlainDateTime` or a `Temporal.ZonedDateTime`. A pick keeps the kind of the value, and its date, its time zone and each unit that the user did not pick.

The root emits `valueChange` with the new value and `eventDetails`, and then `update:modelValue`. To stop the change, call `eventDetails.cancel()` before the `valueChange` listener returns. The root then emits no `update:modelValue` and keeps its value.

A clock with no value shows the time of `referenceDate`, or 00:00. The first pick has the kind, the date and the time zone of `referenceDate`. With no `referenceDate`, it is a `Temporal.PlainTime`.

## Views

The face shows one unit at a time: the hours, the minutes or the seconds. The `view` prop, or `v-model:view`, sets the unit. The `defaultView` prop sets the unit of an uncontrolled clock. A `TimeClock.ViewTrigger` shows its unit when the user presses it.

The root emits `valueCommitted` when a press or a drag that selects a number ends, and when the user presses Enter or Space on the face. A commit shows the next unit, up to `granularity`. The default `granularity` is `minute`.

## Hour cycle

A 12-hour face has the hours 1 to 12. `TimeClock.DayPeriod` moves the time to the other half of the day and keeps the rest of the time. A 24-hour face has the hours 1 to 12 on an outer ring, and the hours 13 to 23 and 00 on an inner ring. A press nearer to the center than the middle between the two rings selects the inner ring. `TimeClock.DayPeriod` renders nothing on a 24-hour face.

The `hourCycle` prop sets the hour cycle. With no prop, the hour cycle of the locale applies.

## Steps and limits

The `minuteStep` and `secondStep` props set the step of the minutes and of the seconds. The user selects a minute for each step, and a number that is not on a step is disabled.

The `min` and `max` props limit the time. The `disabledTimes` function disables a time. A disabled number has `data-disabled`, and a press or a key does not select it. A selection puts the time into the limits. An hour is in the limits when one of its minutes is. A minute is in the limits when one of its seconds is.

## Style the face

The parts set no position. They write the angle of the hand and of each number as a CSS variable, and the styles of the demo place them:

| Variable                     | Part               | Value                                            |
| ---------------------------- | ------------------ | ------------------------------------------------ |
| `--time-clock-hand-angle`    | `TimeClock.Hand`   | The angle in degrees from 12 o'clock, clockwise. |
| `--time-clock-hand-length`   | `TimeClock.Hand`   | 1, and 0.64 for an hour of the inner ring.       |
| `--time-clock-number-angle`  | `TimeClock.Number` | The angle in degrees from 12 o'clock, clockwise. |
| `--time-clock-number-radius` | `TimeClock.Number` | 1, and 0.64 for an hour of the inner ring.       |

Give the face `position: relative`. The hand, the numbers and the range input are placed in the face. The first demo places each of them, in its style sheet or in its classes.

A press measures the outer ring from the boxes of the numbers, so the rings of a 24-hour face can have any size. With no numbers, the outer ring is at the edge of the face.

`TimeClock.Hand` renders nothing while the clock has no value. It has `data-between-numbers` when the time is between two numbers, for example the minute 37.

## Examples

### 24-hour face

Set `:hour-cycle="24"` for a face with an inner ring.

<DemoFrame>
  <DemoTimeClockTwentyFourHours />
  <template #tailwind>
    <DemoTimeClockTwentyFourHoursTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/time-clock/twenty-four-hours/css-modules/index.vue

<<< ../demos/time-clock/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/time-clock/twenty-four-hours/tailwind/index.vue

:::

</DemoSource>

### Seconds

Set `granularity="second"` to go on to the seconds after the minutes.

<DemoFrame>
  <DemoTimeClockSeconds />
  <template #tailwind>
    <DemoTimeClockSecondsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/time-clock/seconds/css-modules/index.vue

<<< ../demos/time-clock/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/time-clock/seconds/tailwind/index.vue

:::

</DemoSource>

### Step and limits

Set `minuteStep` for a step of the minutes, and `min` and `max` for the limits.

<DemoFrame>
  <DemoTimeClockStep />
  <template #tailwind>
    <DemoTimeClockStepTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/time-clock/step/css-modules/index.vue

<<< ../demos/time-clock/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/time-clock/step/tailwind/index.vue

:::

</DemoSource>

## Server render

The server HTML has the angle variables of the hand and of each number, the texts and the values of the range input. The face is thus exact before the page hydrates.

The locale of the clock is its `locale` prop, else the nearest `LocaleProvider`, else `en-US`, on the server and in the browser. The clock never reads the locale of the visitor. A server and a browser can still have other `Intl` data, such as other digits. A number, a day period and a view trigger then show the text of the browser after the hydration, with no message.

## Keyboard

The Tab key moves the focus to the range input of the face. Then each key does this:

| Key                    | Result                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Right Arrow, Up Arrow  | Selects the next number. The step of the view sets the distance, and the last number goes to the first. |
| Left Arrow, Down Arrow | Selects the number before. The first number goes to the last.                                           |
| Page Up                | Adds 2 hours, 15 minutes or 15 seconds, rounded up to a whole number of steps.                          |
| Page Down              | Takes the same distance.                                                                                |
| Home, End              | Selects the first or the last number of the view.                                                       |
| Enter, Space           | Commits the time and shows the next view.                                                               |

A key goes over a disabled number. The Left Arrow and the Right Arrow do not change places in a right-to-left page, because a clock has one direction. A key with Alt, Control or Meta is not a key of the clock.

## Accessibility

- The root is a `group`. Give it a name with `aria-label` or `aria-labelledby`.
- The range input has the name of the unit of the view, such as "hour", in the locale. Its `aria-valuetext` is the number and the unit, such as "10 hours". The `id` and each `aria-*` attribute on `TimeClock.Face` go to the range input: `aria-label` or `aria-labelledby` replaces the name, and `aria-describedby` adds a description. An `aria-valuetext` attribute replaces the value text, else the result of `getAriaValueText`. That function also gets the number of a clock with no value.
- The numbers and the hand have `aria-hidden`, because the range input has the same information.
- A touch screen reader changes the range input with its own gestures. A change that comes from the input selects the number like a key.
- `TimeClock.DayPeriod` and `TimeClock.ViewTrigger` are buttons with `aria-pressed`. Style them with `[aria-pressed="true"]` and `:disabled`. `TimeClock.ViewTrigger` has the name of its unit and the number, such as "hour 10", unless it has content of your own. A trigger works in a read-only clock.
- A read-only clock keeps the keys and the presses from a change. The range input has `aria-readonly`.
- The face has `touch-action: none`, so that a drag on a touch screen does not scroll the page.

## API reference

<ApiReference />

## Additional types

### TimeClockView

<ApiReference name="TimeClockView" />

### TimeClockFaceNumber

<ApiReference name="TimeClockFaceNumber" />

### TimeClockDayPeriodValue

<ApiReference name="TimeClockDayPeriodValue" />

### TimeClock.Root.ChangeEventReason

<ApiReference name="TimeClock.Root.ChangeEventReason" />

### TimeClock.Root.CommitEventReason

<ApiReference name="TimeClock.Root.CommitEventReason" />

### TimeClock.Root.ViewChangeEventReason

<ApiReference name="TimeClock.Root.ViewChangeEventReason" />
