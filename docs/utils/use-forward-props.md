---
order: 1
description: Forward the props that the caller of a wrapper component sets, plus the wrapper defaults.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
</script>

# useForwardProps

Forward the props that your caller sets, plus your wrapper defaults.

Vue sets an absent Boolean prop to `false`, even when its type is optional. A wrapper that passes that value to a part can replace a parent value, control state, or disable a default. Call `useForwardProps` in `setup` to omit that cast value:

<<< ./use-forward-props/AccordionPanel.vue

`useForwardProps` and `useForwardPropsEmits` have the names and the behavior of the Reka UI composables. A wrapper that you port from Reka UI or shadcn-vue keeps its calls of them.

## What it forwards

- The declared props that the caller sets, with their resolved values.
- The declared props with a default other than `undefined`, even when the caller omits them.
- An explicit `false`, or a bare Boolean attribute as `true`.
- A kebab-case name as its camel-case name: `keep-mounted` becomes `keepMounted`.

A prop with the value `undefined` is absent from the result. An absent Boolean prop with no default is absent too.

The result follows new values and props that the caller adds or removes. Pass the props object, a ref, or a getter. Do not pass a copy of the props if you need it to follow changes.

Attributes and listeners that the wrapper does not declare stay in `$attrs`. Vue passes them to the root of the wrapper as usual. They are not in the result.

`ForwardedProps<Props>` makes Boolean keys optional. Vue types an optional Boolean prop as present, but the helper can omit it.

## Events

Use `useForwardPropsEmits` when your wrapper declares its events with `defineEmits`. It adds a listener for each declared event. An event that a mixin or `extends` declares is a declared event too. Each listener calls the wrapper's `emit` before it returns, so `details.cancel()` can stop `update:open`.

<<< ./use-forward-props/CollapsibleRoot.vue

A wrapper that declares no events needs only `useForwardProps`. Its listeners stay in `$attrs` and reach the part. Vase UI parts export no `Emits` type: declare the events your wrapper needs, or leave them undeclared.

A part that checks for a listener then always finds one for each event you declare. For example, Form finds a `formSubmit` listener even when your caller sets none.

Without `emit`, `useForwardPropsEmits(props)` gives only the props. With `emit` but no declared events, a development build warns and the result has no listeners.

The return type describes the props, without listener keys. The listeners exist at run time. This avoids a TypeScript recursion error for an emit whose parameter has type `void`.

## The development warning

In a development build, a part checks each Boolean prop for which an absent prop and `false` give different results. It makes the check one time, in `setup`. The part warns when it gets `false`, its wrapper declares that prop with no default, and the caller of the wrapper omits the prop:

```text
Vase UI: <MyMenubar> gives `modal: false` to <Menubar>, but its caller did not set `modal`. Vue sets an absent Boolean prop to `false`, so the part cannot use its default or the value of its parent. Give `modal` the default `undefined` in <MyMenubar>, or forward the props with `useForwardProps`.
```

Each wrapper name, part and prop gets one message. A production bundle has no code for this check. [Wrap a part](/handbook/composition#wrap-a-part) lists the affected props and their behavior.

The check cannot detect these cases:

- A wrapper that gives the prop another name.
- A vnode that `setup` made, or that no render made.
- A wrapper in Vapor mode.
- A wrapper that receives array children.
- A cast that starts after setup.

One case can warn without a fault. A wrapper declares the prop without a default, and its caller omits the prop. The render of the wrapper then gives the part a `false` from another source: a literal, another value, or a vnode that a function prop returns. Give the prop of the wrapper a default to remove that message.

## Vapor mode

Vue does not expose the caller's set props to this helper in a Vapor wrapper. The helper warns in development and forwards each value other than `undefined`. An absent Boolean prop can thus remain `false`. Vue does not expose the declared events either, so `useForwardPropsEmits` warns in development and forwards no event.

Give each optional Boolean prop the default `undefined`. Bind `props` on the part without this helper. You can instead leave the prop undeclared and pass `$attrs` to the part. Leave events undeclared so `$attrs` passes their listeners to the part. The same fallback applies to a call outside component setup.

## API reference

### useForwardProps

<ApiReference name="useForwardProps" :heading-level="4" />

### useForwardPropsEmits

<ApiReference name="useForwardPropsEmits" :heading-level="4" />
