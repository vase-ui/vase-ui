export interface ChangeEventDetails<Reason extends string> {
  reason: Reason;
  event: Event;
  cancel(): void;
  readonly isCanceled: boolean;
}

export function createChangeEventDetails<Reason extends string>(
  reason: Reason,
  event: Event,
): ChangeEventDetails<Reason> {
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
