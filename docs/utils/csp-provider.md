---
order: 1
description: A CSP provider component that gives a nonce to the inline style and script tags of Vase UI components, and that can disable inline style elements.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
</script>

# CSP Provider

Configures CSP-related behavior for inline tags that Vase UI components render.

## Anatomy

Import the component and wrap it around your app:

<<< ./csp-provider/Anatomy.vue

Under a strict Content Security Policy (CSP), the browser blocks an inline `<style>` or `<script>` tag. The tag needs a matching [nonce](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce) attribute. `CSPProvider` gives its `nonce` and `disableStyleElements` values to all Vase UI components below it.

## Supplying a nonce

If you enforce a CSP that blocks inline tags by default, configure your server to:

1. Generate a random nonce for each request.
2. Include the nonce in your CSP header, in `style-src-elem` and `script-src`.
3. Pass the same nonce to `CSPProvider` when it renders.

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

`CSPProvider` gives the same nonce to each component below it.

## Disable inline style elements

You do not need a `nonce` for `<style>` elements if you disable them and use external style sheets only. Components must then get their CSS from custom class names or other methods.

Set `disableStyleElements` to remove these elements:

<<< ./csp-provider/DisableStyleElements.vue

This prop does not affect `<script>` tags, and `CSPProvider` has no prop to disable them. A `nonce` is required if a component renders an inline script.

## Inline style attributes

`CSPProvider` covers inline `<style>` and `<script>` tags that are elements. It does not cover inline style attributes, such as `<div style="...">`. The `style-src-attr` directive of CSP governs the inline style attributes in the HTML that the browser parses from a server render. It does not affect the styles that client-side JavaScript sets.

In CSP, `style-src` applies to both `<style>` elements and `style=""` attributes. To control only `<style>` elements, use `style-src-elem`.

If your CSP blocks inline style _attributes_ in addition to _elements_, you can use one of these options:

1. Add `'unsafe-inline'` to the `style-src-attr` directive, or use `style-src-elem` and not `style-src`. A style attribute is a smaller security risk than a style element, but a high-security environment can reject this option.
2. Render the affected components only on the client. The first HTML then has no inline styles.

## API reference

<ApiReference />
