---
order: 4
description: A guide to customizing the behavior of Vase UI components.
---

# Customization

A guide to customizing the behavior of Vase UI components.

## Vase UI events

The change events `openChange`, `valueChange` and `pressedChange` are custom to Vase UI. They are emits. In a template, write them as `@open-change`, `@value-change` and `@pressed-change`. A DOM event or another cause can emit them.

```ts
openChange: (open, eventDetails) => void
valueChange: (value, eventDetails) => void
pressedChange: (pressed, eventDetails) => void
```

The part passes `eventDetails` as the second argument to a change listener. It lets you customize the event. It also lets you run a side effect only for the reason or the DOM event that caused the change.

After the listener returns, the part emits `update:open`, `update:value` or `update:pressed` with the same value. `v-model` uses that event.

```ts
interface VaseUIChangeEventDetails {
  reason: string;
  event: Event;
  cancel: () => void;
  allowPropagation: () => void;
  isCanceled: boolean;
  isPropagationAllowed: boolean;
  trigger: Element | undefined;
}
```

- `reason` tells why the change event occurred. Use it to run a side effect only for some reasons. An editor can show the possible string values after you type `reason === '`.
- `event` is the native DOM event that caused the change. When no DOM event caused it, `event` is a generic `Event`.
- `cancel` stops the part from changing its internal state.
- `allowPropagation` allows the DOM event to propagate where Vase UI stops the propagation.
- `isCanceled` shows whether the change event is canceled.
- `isPropagationAllowed` shows whether the DOM event is allowed to propagate.
- `trigger` is the element that started the change, when there is one.

### Canceling a Vase UI event

Call the `cancel()` method on `eventDetails` to cancel an event. This sample keeps a tooltip open when the user presses its trigger:

<<< ../examples/customization/CancelChange.vue{5-8}

This lets you leave the part uncontrolled, because its internal state does not change. It is an alternative to controlling the part with external state and guarding the state updates.

Call `cancel()` before the listener returns. A call after an `await` has no effect. The part then emits no `update:open`.

### Allowing propagation of the DOM event

In a popup, pressing the <kbd>Esc</kbd> key stops the propagation of the event, so that parent popups do not close at the same time. The `allowPropagation()` method changes this:

<<< ../examples/customization/AllowPropagation.vue{5-8}

## Preventing Vase UI from handling an event

To prevent Vase UI from handling an event such as `paste`, call the `preventVaseUIHandler()` method on the event in your listener on the part:

<<< ../examples/customization/PreventHandler.vue{7}

Use it as an escape hatch where no prop customizes the behavior yet.

The method has no effect on a native event that the part declares as an emit, such as `submit` of `Form`. The part calls your listener from its own handler. A popup also handles the <kbd>Esc</kbd> key and an outside press with listeners on the document. Your listener on the part does not get these events. Use `cancel()` on the change event for them.

To add a listener of your own in a `#render` slot, merge it with [`mergeProps`](/utils/merge-props#preventing-vase-ui-s-default-behavior).

## Controlling components with state

Change listeners let you control a part with your own state.

Parts are uncontrolled by default. They manage their own state internally.

<<< ../examples/customization/Uncontrolled.vue

To control a part, bind your state with `v-model`. The pairs are `v-model:open`, `v-model:value`, `v-model:checked` and `v-model:pressed`. A part has no `modelValue`. The props `defaultOpen`, `defaultValue` and their kin give the first state of an uncontrolled part.

For example, you can open [Dialog](/components/dialog) after a timeout, without a trigger:

<<< ../examples/customization/Controlled.vue{20}

This also lets you read the state of the part outside the root.
