import type { NativeElements } from 'vue';
import { expectType } from '#test-utils';
import { mergeProps, mergePropsN } from '@vase-ui/vue/merge-props';
import type { HTMLProps } from '@vase-ui/vue/types';

const slotProps = null as unknown as HTMLProps;

const typed = mergeProps<'button'>(slotProps, {
  type: 'submit',
  onKeydown(event) {
    event.preventVaseUIHandler();
  },
});

expectType<NativeElements['button'], typeof typed>(typed);
typed.onKeydown?.(new KeyboardEvent('keydown'));

const untyped = mergeProps(slotProps, {
  onKeydown(event) {
    event.preventVaseUIHandler();
  },
});

expectType<NativeElements['div'], typeof untyped>(untyped);
untyped.onKeydown?.(new KeyboardEvent('keydown'));

// @ts-expect-error With no type argument, the tag is `div`, and `div` has no `href`.
mergeProps(slotProps, { href: '/' });
mergeProps<'a'>(slotProps, { href: '/' });

const typedFromArray = mergePropsN<'button'>([slotProps, { type: 'submit' }]);
const untypedFromArray = mergePropsN([slotProps, { id: 'a' }]);

expectType<NativeElements['button'], typeof typedFromArray>(typedFromArray);
expectType<NativeElements['div'], typeof untypedFromArray>(untypedFromArray);

mergeProps<'button'>(slotProps, (mergedProps) => {
  expectType<NativeElements['button'], typeof mergedProps>(mergedProps);

  return {
    onKeydown(event) {
      event.preventVaseUIHandler();
      mergedProps.onKeydown?.(event);
    },
  };
});
