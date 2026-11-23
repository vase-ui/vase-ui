---
order: 4
description: A guide to customizing the behavior of Vase UI components.
---

# Customization

A guide to customizing the behavior of Vase UI components.

## Events

A part emits a change event when the user changes its state, such as `openChange`, `valueChange` or `pressedChange`. In a template, write `@open-change`, `@value-change` or `@pressed-change`. The last argument is the details of the change:

```ts
openChange: (open, eventDetails) => void
valueChange: (value, eventDetails) => void
pressedChange: (pressed, eventDetails) => void
```

```ts
interface ChangeEventDetails {
  reason: string;
  event: Event;
  cancel(): void;
  readonly isCanceled: boolean;
}
```

- `reason` tells why the change occurred. An editor shows the possible values after you type `reason === '`.
- `event` is the native event that caused the change.
- `cancel()` stops the change.
- `isCanceled` tells whether a listener stopped the change.

After the listeners, the part emits the update of its model, such as `update:open` or `update:modelValue`. It emits no update for a stopped change.

`@vase-ui/vue/types` exports `ChangeEventDetails`, and `GenericEventDetails` with only `reason` and `event`, for an event that a listener cannot stop. The details of a popup part have three more members:

- `allowPropagation()` lets the native event propagate where the popup stops it.
- `isPropagationAllowed` tells whether a listener called `allowPropagation()`.
- `trigger` is the trigger that opens the popup. At a close, it is the active trigger, while that trigger is in the document.

### Cancel a change

Call `cancel()` to stop a change. The part then stays as it is, so you need no state of your own. This tooltip stays open when the user presses its trigger:

<<< ../examples/customization/CancelChange.vue{5-7}

Call `cancel()` before the listener returns. A call after an `await` has no effect.

### Allow the propagation of the DOM event

A popup stops the propagation of the <kbd>Esc</kbd> key that closes it, so that a popup below it stays open. Call `allowPropagation()` to let the key event propagate:

<<< ../examples/customization/AllowPropagation.vue{5-7}

## Stop a native event before a part gets it

To stop a change, [cancel it](#cancel-a-change). To stop a native event that causes no change, add a capture listener on the part, and call `event.stopPropagation()`:

<<< ../examples/customization/StopEvent.vue{7}

Your capture listener runs before the listeners of the part, and no listener after it gets the event. Two limits apply:

- No listener above the part gets the event. This includes the listeners of your app and the <kbd>Esc</kbd> listener of a popup.
- A capture listener on an element around the part, or on the document, runs before yours, and the call does not stop it. A popup closes at a press outside it with such a listener. To stop that close, call `cancel()` on the change event.

## Control a component with v-model

A part owns its state, unless you bind it. This dialog owns its open state:

<<< ../examples/customization/Uncontrolled.vue

- `v-model` binds the main value of a part. A second state has a named model, such as `v-model:open`.
- A `default*` prop, such as `defaultValue` or `defaultOpen`, gives the first value of a part that you do not bind. The part reads it at its mount. A form control also reads it at a native reset of its form.
- A model that is not `undefined` controls the part, also with no update listener. After a change of the user, the part shows the new value only when you write it to the model.
- A model of `undefined` makes the part own its state again. The part keeps the value that it has.

For example, this dialog opens after a timeout, with no trigger:

<<< ../examples/customization/Controlled.vue{20}

A native reset of the form gives a form control the model of its mount. With no model at the mount, the control takes the `default*` prop that it has at the reset, as a native control does. The part emits the update of its model, so `v-model` follows. It emits no change event, so `cancel()` cannot stop the reset. When you keep your model at that update, the field takes your value as its first value. The field of the control is then not dirty.

## Differences from Base UI

| Base UI                                                                       | Vase UI                                                                                                                                 |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `onOpenChange`, `onValueChange` and the other change props                    | The events `openChange`, `valueChange` and the others: `@open-change`, `@value-change`.                                                 |
| `value` with `onValueChange`, `open` with `onOpenChange`                      | `v-model` for the main value. A named model, such as `v-model:open`, for another state.                                                 |
| `allowPropagation()` and `isPropagationAllowed` in the details of each change | Only in the details of a popup part, which stops the propagation of an event.                                                           |
| `event.preventBaseUIHandler()`                                                | `cancel()` for a change. For a native event that causes no change, a capture listener on the part that calls `event.stopPropagation()`. |
| The part keeps its control mode from its mount, and warns at a change of it   | A model can start and stop the control at each moment, with no warning. With `undefined`, the part keeps the value that it has.         |
| A warning at a change of a `default*` prop after the mount                    | No warning. The part reads the prop at its mount, and a form control also at a native reset of its form.                                |
