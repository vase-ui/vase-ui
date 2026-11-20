import type { Component, HTMLAttributes } from 'vue';
import type { AsTag } from 'motion-v';
import { expectType } from '#test-utils';
import type { GenericComponent, VaseUIComponentProps, WithVaseUIEvent } from './types';

// The import of `motion-v` adds the options of `motion-v` to `HTMLAttributes`, `as` among them.
expectType<AsTag | undefined, HTMLAttributes['as']>(undefined);

expectType<false, 'as' extends keyof WithVaseUIEvent<HTMLAttributes> ? true : false>(false);

// Without the omit of `as`, TypeScript reports TS2320 on this line: the two parents declare `as`
// with different types.
interface PartProps extends VaseUIComponentProps<object>, WithVaseUIEvent<HTMLAttributes> {
  active?: boolean;
}

declare const partProps: PartProps;
expectType<string | Component | GenericComponent | undefined, typeof partProps.as>(partProps.as);

expectType<string | null | undefined, WithVaseUIEvent<HTMLAttributes>['aria-description']>(
  undefined,
);
expectType<string | null | undefined, WithVaseUIEvent<HTMLAttributes>['aria-labelledby']>(
  undefined,
);
expectType<false, null extends WithVaseUIEvent<HTMLAttributes>['onClick'] ? true : false>(false);
// An attribute that reaches a declared prop takes no `null`.
expectType<
  string | undefined,
  WithVaseUIEvent<HTMLAttributes, 'aria-labelledby'>['aria-labelledby']
>(undefined);
