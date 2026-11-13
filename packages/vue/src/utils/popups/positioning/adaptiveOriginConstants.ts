export const DEFAULT_SIDES = {
  sideX: 'left',
  sideY: 'top',
} as const;

// The state of a store holds this type, not the `Middleware` type of Floating UI.
// With the real type, a declaration build refers to `Platform` and `detectOverflow` of
// `@floating-ui/core`. The build of a consumer then fails with TS2883.
export type AdaptiveOriginMiddleware = {
  name: string;
  fn: (...args: any[]) => any;
};
