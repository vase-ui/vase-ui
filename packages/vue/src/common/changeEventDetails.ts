/**
 * The details of an event that a listener cannot cancel. `E` is the type of the native event. A
 * family that knows the event of each reason writes a union with one member for each event type.
 */
export interface GenericEventDetails<Reason extends string = string, E extends Event = Event> {
  reason: Reason;
  event: E;
}

/** The details of a change. `cancel()` stops the change. */
export interface ChangeEventDetails<
  Reason extends string = string,
  E extends Event = Event,
> extends GenericEventDetails<Reason, E> {
  cancel(): void;
  readonly isCanceled: boolean;
}

export function createChangeEventDetails<Reason extends string, E extends Event = Event>(
  reason: Reason,
  event: E,
): ChangeEventDetails<Reason, E> {
  let isCanceled = false;
  return {
    reason,
    event,
    cancel() {
      isCanceled = true;
    },
    get isCanceled() {
      return isCanceled;
    },
  };
}
