---
order: 1
description: A CSP provider component that gives a nonce to the inline style and script elements of Vase UI parts, and that can remove the inline style elements.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
</script>

# CSP Provider

Sets the Content Security Policy (CSP) values of the inline elements that Vase UI parts render.

## Anatomy

Import the component and wrap it around your app:

<<< ./csp-provider/Anatomy.vue

## Supplying a nonce

A strict CSP blocks an inline `<style>` or `<script>` element unless its [nonce](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce) attribute matches the nonce of the CSP. If you enforce such a CSP, configure your server to:

1. Make a random nonce for each request.
2. Include the nonce in your CSP header, in `style-src-elem` and `script-src`.
3. Give the same nonce to `CSPProvider` when it renders.

```ts
const nonce = crypto.randomUUID();

// Example CSP header
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'nonce-${nonce}'`,
  `style-src-elem 'self' 'nonce-${nonce}'`,
].join('; ');
```

Then give the nonce to the root component as a prop, for example with `createSSRApp(App, { nonce })`:

<<< ./csp-provider/NonceApp.vue

These parts render an inline element that gets the nonce:

- `ScrollArea.Root` renders a `<style>` element that hides the native scrollbar of `ScrollArea.Viewport`.
- `Select.Popup` and `Select.List` use the same `<style>` element while the popup aligns its item with the trigger. They also use it while the popup has a scroll arrow and the user does not use touch.
- `Tabs.Indicator` with `renderBeforeHydration` renders a `<script>` element in the server HTML.

## Disable inline style elements

You need no nonce for `<style>` elements if you disable them and use only external style sheets. Set `disableStyleElements`:

<<< ./csp-provider/DisableStyleElements.vue

Then put the rules of the `<style>` element in your own style sheet:

```css
.vase-ui-disable-scrollbar {
  scrollbar-width: none;
}
.vase-ui-disable-scrollbar::-webkit-scrollbar {
  display: none;
}
```

`disableStyleElements` has no effect on `<script>` elements, and `CSPProvider` has no prop to disable them. A part that renders an inline script needs a `nonce`.

## Inline style attributes

`CSPProvider` covers inline `<style>` and `<script>` elements. It does not cover inline style attributes, such as `<div style="...">`. The `style-src-attr` directive of CSP controls the inline style attributes in the HTML that the browser parses from a server render. It has no effect on the styles that client-side JavaScript sets.

In CSP, `style-src` applies to both `<style>` elements and `style=""` attributes. To control only `<style>` elements, use `style-src-elem`.

If your CSP blocks inline style _attributes_ in addition to _elements_, use one of these options:

1. Add `'unsafe-inline'` to the `style-src-attr` directive, or use `style-src-elem` and not `style-src`. A style attribute is a smaller security risk than a style element, but a high-security environment can refuse this option.
2. Render the affected components only on the client. The first HTML then has no inline styles.
3. Remove an inline style of a part in its `style` attribute, and put the style in your CSS. An example is `<ScrollArea.Viewport :style="{ overflow: undefined }">`. Check each new version of Vase UI for new inline styles.

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
