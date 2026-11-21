---
order: 8
description: A guide to rendering Vase UI components on the server.
---

# Server rendering

Vase UI components render on the server, and the browser hydrates them.

## What the server renders

Each part renders with `renderToString` of Vue. The server HTML has what the first render of the browser has: the elements, their attributes, the text and the form inputs.

A closed panel that `keepMounted` or `hiddenUntilFound` keeps in the DOM, such as a panel of `Collapsible` or `Tabs`, is in the server HTML too. A search engine can then read its text. Find-in-page finds only the text of a `hiddenUntilFound` panel: a closed panel with `keepMounted` is `hidden` and `inert`.

## Popups and portals

A `Portal` part renders its content after its mount, as the [Vue guide](https://vuejs.org/guide/scaling-up/ssr.html#teleports) says for a `<Teleport>`. The server HTML thus has the triggers and no popup. The popup of a root that is open at the mount comes one update after the mount.

With `disabled`, a `Portal` part renders its content in its place, also on the server. A CSS selector in `to` is read in the browser only, so the server needs no document.

## Values that the server cannot know

The server and the browser must render the same HTML. So no part reads a value of the visitor in a render. Give each such value, or the part uses one fixed value on both sides.

- **Locale.** A part uses its `locale` prop, else the nearest [`LocaleProvider`](/utils/locale-provider), else `en-US`. It never reads the locale of the visitor. A server and a browser can still have other `Intl` data for one locale. Then the text of the browser wins after the hydration. Give `data-allow-mismatch="text"` to your own element that shows such a text.
- **Time zone and today.** No part reads the clock in a render. A part that needs today reads it after the mount. A server that knows the day of the visitor gives it with the data of the page, such as the `today` prop of `Calendar`. In your own template, an expression of `Temporal.Now` can give the browser another day than the server. See [Dates and times](/handbook/dates-and-times).
- **Direction.** A server cannot read the direction of an element around a part. `Slider.Root` places its thumbs in the server HTML, so give it its own `dir`. See [Text direction](/handbook/styling#text-direction).
- **Measures.** A server cannot measure the page. A part that places itself by a measure takes the measure after the mount. Examples are `Tabs.Indicator` and a panel of `Resizable` with a length size. With `renderBeforeHydration`, `Tabs.Indicator` places itself with an inline script before the app starts.

The server HTML and the first render of the browser can differ in a value that the browser corrects. The part then has `data-allow-mismatch`, and Vue shows no message for that value.

## Before the hydration

A part handles the events of the browser after the hydration. Before it, a part does not read text that the visitor types, a press on a label, or form state that the browser restores.

## Nuxt

Add the [Nuxt module](/handbook/nuxt) of the package. Your components then use each component of Vase UI with no import. When your app has `temporal-polyfill`, the module also loads it where the engine has no `Temporal`.

Without the module, import each component from its entry point, such as `@vase-ui/vue/dialog`. Vase UI needs no other configuration.

- Without the module, load the `Temporal` polyfill in a plugin for the date and time components. See [Dates and times](/handbook/dates-and-times).
- For a link of the router in a part, see [The element slot](/handbook/composition#the-element-slot).

## Content Security Policy

Some parts render an inline `<style>` or `<script>` element. Under a strict Content Security Policy, give the nonce of each request to [`CSPProvider`](/utils/csp-provider). The parts below it write the nonce on these elements.
