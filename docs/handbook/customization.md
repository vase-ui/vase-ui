---
order: 4
description: A guide to customizing the behavior of Vase UI components.
---

# Customization

A guide to customizing the behavior of Vase UI components.

## Vase UI events

The change events `openChange`, `valueChange` and `pressedChange` are custom to Vase UI. They are emits. In a template, write them as `@open-change`, `@value-change` and `@pressed-change`. A DOM event, or a change in the part itself, can emit them.

```ts
openChange: (open, eventDetails) => void
valueChange: (value, eventDetails) => void
pressedChange: (pressed, eventDetails) => void
```

The part passes `eventDetails` as the second argument to a change listener. It lets you customize the event. It also lets you run a side effect only for the reason or the DOM event that caused the change.

After the listener accepts a change, the part emits its model update with the new value. For example, `v-model:open` listens for `update:open`, and `v-model` listens for `update:modelValue`. Automatic tab selection always emits its update, even if the listener calls `cancel()`.

```ts
interface ChangeEventDetails {
  reason: string;
  event: Event;
  cancel: () => void;
  readonly isCanceled: boolean;
}
```

- `reason` tells why the change event occurred. Use it to run a side effect only for some reasons. An editor can show the possible string values after you type `reason === '`.
- `event` is the native DOM event that caused the change. When no DOM event caused it, `event` is a plain `Event`.
- `cancel` stops a cancelable change.
- `isCanceled` shows whether the change event is canceled.

`@vase-ui/vue/types` exports `ChangeEventDetails`, and `GenericEventDetails` with only `reason` and `event` for an event that a listener cannot cancel. A part that adds a member lists it on its page. A popup part adds these members:

- `allowPropagation` allows the DOM event to propagate where Vase UI stops the propagation.
- `isPropagationAllowed` shows whether the DOM event is allowed to propagate.
- `trigger` is the element that started the change, when there is one. When a popup closes for a reason that names no element, such as <kbd>Esc</kbd> or a press outside, `trigger` is the trigger that opened the popup, if it is still in the document.

### Canceling a Vase UI event

Call the `cancel()` method on `eventDetails` to cancel an event. This sample keeps a tooltip open when the user presses its trigger:

<<< ../examples/customization/CancelChange.vue{5-8}

This lets you leave the part uncontrolled, because its internal state does not change. You do not need external state with a check on each update.

When the part is controlled, `cancel()` is still the way to decline a change. A request that you do not apply to the `open` prop stays pending until the prop changes, so the part still reports a later close.

Call `cancel()` before the listener returns. A call after an `await` has no effect.

### Allowing propagation of the DOM event

In a popup, the <kbd>Esc</kbd> key stops the propagation of the event, so that parent popups do not close at the same time. The `allowPropagation()` method changes this:

<<< ../examples/customization/AllowPropagation.vue{5-7}

## Stop a native event before a part gets it

To stop a change of a part, [cancel the change event](#canceling-a-vase-ui-event) for its `reason`. To stop a native event that causes no change event, add a capture listener on the part and call `event.stopPropagation()`:

<<< ../examples/customization/StopEvent.vue{7}

Your capture listener runs before the listeners of the part. After the call, no bubble listener gets the event. Two limits apply:

- No bubble listener above the part gets the event. This includes the listeners of your app and the <kbd>Esc</kbd> listener of a popup.
- A capture listener on an element around the part, or on the document, runs before your listener. The call does not stop it. A popup has such listeners for a press outside. To stop that close, call `cancel()` on the change event.

## Controlling components with state

You can control a part with your own state.

Parts are uncontrolled by default. They manage their own state internally.

<<< ../examples/customization/Uncontrolled.vue

Bind the value of a part with `v-model`. In a render function, pass `modelValue` and listen for `update:modelValue`. Bind independent state by name, such as `v-model:open` or `v-model:snapPoint`. The props `defaultOpen`, `defaultValue` and their kin give the first state of an uncontrolled part.

For example, you can open [Dialog](/components/dialog) after a timeout, without a trigger:

<<< ../examples/customization/Controlled.vue{20}

This also lets you read the state of the part outside the root.
