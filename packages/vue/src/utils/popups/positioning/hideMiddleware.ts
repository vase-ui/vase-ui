import type { Middleware } from '@floating-ui/vue';

export const hide: Middleware = {
  name: 'hide',
  async fn(state) {
    const { width, height, x, y } = state.rects.reference;
    const anchorHidden = width === 0 && height === 0 && x === 0 && y === 0;
    // This is the `referenceHidden` strategy of `hide()` of Floating UI. Floating UI gives
    // `detectOverflow` to the platform of a middleware before it calls the middleware.
    const overflow = await state.platform.detectOverflow(state, {
      elementContext: 'reference',
    });
    const referenceHidden =
      overflow.top - height >= 0 ||
      overflow.right - width >= 0 ||
      overflow.bottom - height >= 0 ||
      overflow.left - width >= 0;

    return {
      data: {
        referenceHidden: referenceHidden || anchorHidden,
      },
    };
  },
};
