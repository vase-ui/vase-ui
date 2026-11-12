export function NOOP() {}

// The type is a mutable `never[]`, so it is assignable to each `T[]` fallback.
// Then `T` does not widen.
// The array is frozen, so a write through a widened alias throws.
export const EMPTY_ARRAY: never[] = Object.freeze([]) as never[];

export const EMPTY_OBJECT = Object.freeze({});
