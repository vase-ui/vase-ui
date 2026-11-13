import { expectType } from '../../common/testUtils';
import { ReactiveStore } from './ReactiveStore';

interface TestState {
  count: number | undefined;
  text: string;
}

const selectors = {
  count: (state: TestState) => state.count,
  text: (state: TestState) => state.text,
  textLongerThan(state: TestState, length: number) {
    return state.text.length > length;
  },
  textLengthBetween(state: TestState, minLength: number, maxLength: number) {
    return state.text.length >= minLength && state.text.length <= maxLength;
  },
};

const store = new ReactiveStore<TestState, Record<string, never>, typeof selectors>(
  { count: 0, text: '' },
  undefined,
  selectors,
);

store.set('text', 'next');
store.set('count', undefined);
store.update({ text: 'next' });
store.update({ count: undefined });

// @ts-expect-error `text` only accepts strings.
store.set('text', 1);
// @ts-expect-error `text` does not accept undefined.
store.set('text', undefined);
// @ts-expect-error Store values must match their corresponding keys.
store.update({ text: undefined });
// @ts-expect-error Store updates cannot contain unknown keys.
store.update({ unknown: true });
// @ts-expect-error The state has no key `unknown`.
store.set('unknown', true);

const count = store.select('count');
expectType<number | undefined, typeof count>(count);

const text = store.select('text');
expectType<string, typeof text>(text);

const isTextLongerThan5 = store.select('textLongerThan', 5);
expectType<boolean, typeof isTextLongerThan5>(isTextLongerThan5);

const isTextLengthBetween3And10 = store.select('textLengthBetween', 3, 10);
expectType<boolean, typeof isTextLengthBetween3And10>(isTextLengthBetween3And10);

// @ts-expect-error select requires a selector name.
store.select();
// @ts-expect-error The count selector accepts no additional arguments.
store.select('count', 1);
// @ts-expect-error The textLongerThan selector requires a length argument.
store.select('textLongerThan');
// @ts-expect-error The textLengthBetween selector requires both minimum and maximum lengths.
store.select('textLengthBetween', 1);
// @ts-expect-error The textLongerThan selector accepts only one length argument.
store.select('textLongerThan', 2, 3);
// @ts-expect-error The store has no selector `unknown`.
store.select('unknown');
