---
order: 9
description: A guide to the Temporal API, the polyfill and the types in the date and time components of Vase UI.
---

# Dates and times

A guide to the `Temporal` API in the date and time components of Vase UI.

## Why Temporal

The date and time components take and give values of `Temporal`, the built-in date and time API of JavaScript. `Temporal` has one type for each kind of value. It also has calendars other than Gregorian.

The components use no `Date` and no date library. They call `Temporal` and `Intl` directly. A component needs the global `Temporal`.

## Browser support

`Temporal` is native in Chrome 144, Edge 144, Firefox 139 and Node.js 26, and in each later version. No release of Safari has it. Node.js 24 and Node.js 22 do not have it. [Can I use](https://caniuse.com/temporal) lists the current versions.

An engine that has no `Temporal` needs a polyfill. In a development build, a component throws an error that names the global `Temporal` when the engine has none.

## Polyfill

Vase UI does not include a polyfill. Add [`temporal-polyfill`](https://github.com/fullcalendar/temporal-polyfill) to your app:

::: code-group

```sh [pnpm]
pnpm add temporal-polyfill
```

```sh [npm]
npm install temporal-polyfill
```

```sh [yarn]
yarn add temporal-polyfill
```

:::

Import it before the app mounts. Put it first in the entry file of the app. The polyfill sets the global `Temporal` only when the engine has none:

```ts
import 'temporal-polyfill/global';
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

The entry `temporal-polyfill/global` has the ISO and Gregorian calendars only. For each other calendar, import `temporal-polyfill/full/global`.

In a Nuxt app, the [Nuxt module](/handbook/nuxt#temporal-polyfill) loads the polyfill. Without the module, import the polyfill in a plugin. A plugin runs on the server and in the browser before the app mounts. In Nuxt 3, the folder is `plugins` and not `app/plugins`:

```ts
// app/plugins/temporal.ts
import 'temporal-polyfill/global';

export default defineNuxtPlugin(() => {});
```

## TypeScript

The types of Vase UI use the global `Temporal` types of TypeScript 6.0. The built declarations of each date and time entry point carry the line `/// <reference lib="esnext.temporal" preserve="true" />`. A project on TypeScript 6.0 needs no change of its `lib`.

The entry point `@vase-ui/vue` does not export the date and time components. A project that imports none of them needs no `Temporal` types, and it can use an earlier version of TypeScript. Import each date or time component from its own entry point.

On a version below 6.0, set `skipLibCheck` to `true` in `tsconfig.json`. To give your own code the `Temporal` types, add `import 'temporal-polyfill/types/global'` to one file of the project.

## Value kinds

A component gives back a value of the kind that it got. These are the kinds:

- `Temporal.PlainDate`: a date.
- `Temporal.PlainDateTime`: a date and a time.
- `Temporal.ZonedDateTime`: a date and a time in a time zone.
- `Temporal.PlainTime`: a time.
- `Temporal.PlainYearMonth`: a month of a year.

<<< ../examples/dates-and-times/ValueKinds.vue

A date component takes a date, a date and time, or a date and time in a zone. A time component takes a time, a date and time, or a date and time in a zone. Some date components also take a year and month.

When the user picks a day, the new value keeps the time, the time zone and the calendar of the value that you gave. When the user picks a time, it keeps the date, the time zone and the calendar.

## Calendars

A component shows a date in the calendar that its `calendar` prop names. With no prop, it uses the calendar of the value when that calendar is not ISO. With neither, it uses the calendar of the locale. `th-TH` gives the Buddhist calendar, and `fa-IR` gives the Persian calendar.

Set `calendar="gregory"` to show Gregorian dates in each locale. The value that the component gives back keeps its own calendar. A grid of another calendar does not change the calendar of the value.

For a calendar other than ISO and Gregorian in an engine that needs the polyfill, import `temporal-polyfill/full/global`. When `Temporal` has no calendar of the locale, the component uses `gregory`. This happens with the plain polyfill, and with a locale such as `ar-SA-u-ca-islamic` in Chrome.

## Time zones

A `Temporal.ZonedDateTime` value keeps its time zone. A component reads today in the zone of its value, else in the zone of the runtime. The `timeZone` prop of `DateField`, `DatePicker` and `DateRangePicker` sets that zone. `Calendar` and `RangeCalendar` take `today` for another zone, such as `Temporal.Now.plainDateISO('Asia/Tokyo')`.

A zone change can skip an hour, and a time in that hour does not exist. When a pick gives a time in that hour, the component moves the time forward by the size of the gap, as `Temporal` does.

## Servers

A server does not know the locale and the time zone of a visitor. With no `locale` prop, each date and time component uses the locale of the nearest `LocaleProvider`, else `en-US`, on the server and in the browser. The server HTML and the first render of the browser are then equal.

`Calendar` reads today to mark the day and to pick its first month. With no `today` prop, it reads the clock only after the mount, so the server HTML marks no day as today. Give it `today` when the server knows the day of the visitor. The server HTML then has that day.

A date field reads today only at an arrow key in an empty segment, so the server HTML and the first render of the browser agree with no `referenceDate`. `DatePicker` and `DateRangePicker` read today after the mount and at each open of the popup. No render reads the clock. While the year is empty, the month segment allows the most months of its calendar, such as 13 in `hebrew`. A time field does not read the day.

On a Node.js version before 26, load the polyfill before the server starts: `node --import temporal-polyfill/global server.js`. In a Nuxt app, the module or the plugin above covers the server.

Node.js 22, 24 and 26 end the process for some date formats of `Intl`, with no error that code can catch ([nodejs/node#67076](https://github.com/nodejs/node/issues/67076)). A date field takes its layout from another format in these fields:

- The language `my` (Burmese), a field that shows a day, and a calendar other than `gregory`, `chinese` and `dangi`.
- The language `ksh` (Colognian), a year and month field, and a calendar other than `chinese` and `dangi`.
- The language `sc` (Sardinian), a year and month field, and the calendar `gregory`.

In `ksh` and `sc`, the layout is the same as without the fault. In `my`, the year comes before the day. A Japanese era shows its name, such as `Reiwa`, in place of a letter, such as `R`. Firefox and Safari show these fields in the same layout as Node.js.
