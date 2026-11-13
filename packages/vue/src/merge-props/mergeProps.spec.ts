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

const untypedLink = mergeProps(slotProps, { href: '/' });
expectType<NativeElements['div'], typeof untypedLink>(untypedLink);
mergeProps<'a'>(slotProps, { href: '/' });

mergeProps({ type: 'button' }, slotProps);
mergeProps({ for: 'id' }, slotProps);
mergeProps({ value: 1 }, slotProps);
mergeProps({ viewBox: '0 0 1 1' }, slotProps);
mergeProps({ 'data-state': 'on' }, slotProps);
mergeProps<'div'>({ 'data-state': 'on' }, slotProps);
mergeProps(slotProps, {
  href: '/',
  'aria-label': 'Home',
  class: ['a', { b: true }],
  style: [{ color: 'red' }, 'margin: 0'],
  onKeydown(event) {
    event.preventVaseUIHandler();
  },
});

// @ts-expect-error No element has the attribute `hreff`.
mergeProps(slotProps, { hreff: '/' });
// @ts-expect-error No element has the listener `onClik`.
mergeProps(slotProps, { onClik() {} });
// @ts-expect-error `tabindex` is a number or a string.
mergeProps(slotProps, { tabindex: {} });
// @ts-expect-error `href` is a string.
mergeProps(slotProps, { class: 'a', href: {} });
// @ts-expect-error A `data-*` attribute is a string, a number or a boolean.
mergeProps(slotProps, { 'data-state': {} });
// @ts-expect-error `div` has no `href`.
mergeProps<'div'>(slotProps, { href: '/' });

const typedFromArray = mergePropsN<'button'>([slotProps, { type: 'submit' }]);
const untypedFromArray = mergePropsN([slotProps, { href: '/' }, { 'data-state': 'on' }]);

expectType<NativeElements['button'], typeof typedFromArray>(typedFromArray);
expectType<NativeElements['div'], typeof untypedFromArray>(untypedFromArray);
// @ts-expect-error No element has the attribute `hreff`.
mergePropsN([slotProps, { hreff: '/' }]);

mergeProps<'button'>(slotProps, (mergedProps) => {
  expectType<NativeElements['button'], typeof mergedProps>(mergedProps);

  return {
    onKeydown(event) {
      event.preventVaseUIHandler();
      mergedProps.onKeydown?.(event);
    },
  };
});
