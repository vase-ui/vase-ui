export type VaseUIEvent<E extends Event> = E & {
  preventVaseUIHandler: () => void;
  readonly vaseUIHandlerPrevented?: boolean | undefined;
};

type WithPreventVaseUIHandler<T> = T extends (event: infer E) => any
  ? E extends Event
    ? (event: VaseUIEvent<E>) => ReturnType<T>
    : T
  : T extends undefined
    ? undefined
    : T;

/**
 * Adds a `preventVaseUIHandler` method to all event handlers.
 */
export type WithVaseUIEvent<T> = {
  [K in keyof T]: WithPreventVaseUIHandler<T[K]>;
};
