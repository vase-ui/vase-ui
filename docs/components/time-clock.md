---
order: 1
description: An unstyled Vue time clock component that picks a time on a clock face with a press, a drag or the keyboard.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
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

## Usage guidelines

- **Load `Temporal` first**: An engine with no `Temporal` needs a polyfill, and TypeScript before 6.0 needs `skipLibCheck`. [Dates and times](/handbook/dates-and-times) gives the steps.
- **Name the clock**: The root is a `group` with no name of its own. Give it an `aria-label`, or an `aria-labelledby` that names a heading, to say what the time is for.
- **Place the hand and the numbers**: The parts set no position. Give the face `position: relative`, and place the hand, the numbers and the range input in it with the CSS variables of `TimeClock.Hand` and `TimeClock.Number`. The style sheet of each demo is a model.

## Anatomy

Import the component and assemble its parts:

<<< ./time-clock/Anatomy.vue

## Examples

### 24-hour face

Set `:hour-cycle="24"` for a face with two rings. The outer ring has the hours 1 to 12, and the inner ring has the hours 13 to 23 and 00. A press nearer to the center than the middle between the two rings selects the inner ring. `TimeClock.DayPeriod` renders nothing on a 24-hour face.

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

A press measures the outer ring from the boxes of the numbers, so the rings can have any size. With no numbers, the outer ring is at the edge of the face.

### Seconds

The face shows one unit at a time. A commit shows the next unit, up to `granularity`. Set `granularity="second"` to go on to the seconds after the minutes.

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

`minuteStep` and `secondStep` set the step of the minutes and of the seconds, and a number that is not on a step is disabled. `min` and `max` limit the time, and `disabledTimes` disables a time. A press or a key does not select a disabled number.

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

A selection puts the time into the limits. An hour is in the limits when one of its minutes is, and a minute is in the limits when one of its seconds is.

### Render on the server

The server HTML has the angle variables of the hand and of each number, so the face is correct before the page hydrates. The clock never reads the locale of the visitor: give `locale` or a `LocaleProvider`, or the text is `en-US`. A server and a browser can still have other `Intl` data, such as other digits or another hour cycle. The hydration then writes the texts and the attributes of the browser, and a face with another count of numbers logs one message of Vue. Give `hourCycle` to keep the same face on the server and in the browser.

An element of the `element` slot, or of a component in `as`, keeps the attributes of the server. `TimeClock.Root` has `data-allow-mismatch="children"`, so Vue also gives no warning for your own content in the clock.

## Keyboard

| Key                    | Action                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab                    | Moves the focus to the range input of the face.                                                                                                                |
| Right Arrow, Up Arrow  | Selects the next number. The step of the view sets the distance, and the last number goes to the first. A right-to-left document does not swap the arrow keys. |
| Left Arrow, Down Arrow | Selects the number before. The first number goes to the last.                                                                                                  |
| Page Up                | Adds 2 hours, 15 minutes or 15 seconds, rounded up to a whole number of steps.                                                                                 |
| Page Down              | Takes away 2 hours, 15 minutes or 15 seconds, rounded up to a whole number of steps.                                                                           |
| Home, End              | Selects the first or the last number of the view.                                                                                                              |
| Enter, Space           | Commits the time and shows the next view.                                                                                                                      |

## API reference

<ApiReference />

### TimeClockView

A unit of the face.

<ApiReference name="TimeClockView" />

### TimeClockFaceNumber

A number of the face, as the `number` slot of `TimeClock.Face` gives it.

<ApiReference name="TimeClockFaceNumber" />

### TimeClockDayPeriodValue

A half of the day.

<ApiReference name="TimeClockDayPeriodValue" />

### TimeClock.Root.ChangeEventReason

The `reason` of the details of a change of the time: `item-press` is a press on `TimeClock.DayPeriod`, and `input-change` is a change of the range input by assistive technology.

<ApiReference name="TimeClock.Root.ChangeEventReason" />

### TimeClock.Root.CommitEventReason

The `reason` of the details of a commit.

<ApiReference name="TimeClock.Root.CommitEventReason" />

### TimeClock.Root.ViewChangeEventReason

The `reason` of the details of a change of the view.

<ApiReference name="TimeClock.Root.ViewChangeEventReason" />

## Differences from Base UI

<BaseUiDifferences />
