import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export interface SliderThumbContext {
  /**
   * Makes the props of the input of the thumb. The `children` component calls it in its render.
   */
  inputProps: () => Record<string, any>;
  /**
   * Whether the `children` component renders the script that places the thumbs before the page
   * hydrates.
   */
  hasPrehydrationScript: ComputedRef<boolean>;
}

export const SliderThumbContext: InjectionKey<SliderThumbContext> = Symbol();

export function useSliderThumbContext(): SliderThumbContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(SliderThumbContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: The `children` component of <Slider.Thumb> must be inside <Slider.Thumb>. Without the part it has no input to render. Mount the `children` component in the element of the `#render` slot of <Slider.Thumb>.',
    );
  }

  return context;
}
