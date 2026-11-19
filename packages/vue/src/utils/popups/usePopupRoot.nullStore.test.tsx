import { describe, expect, it } from 'vitest';
import { isReactive } from 'vue';
import { NullStore } from './usePopupRoot';

describe('NullStore', () => {
  it('takes no write and gives no reactive state', () => {
    interface State {
      value: string;
    }
    const selectors = {
      value: (state: Readonly<State>) => state.value,
    };
    const store = new NullStore<Readonly<State>, Record<string, never>, typeof selectors>(
      Object.freeze({ value: 'initial' }),
      Object.freeze({}),
      selectors,
    );

    expect(() => {
      store.set('value', 'set');
      store.update({ value: 'update' });
      store.setState({ value: 'setState' });
    }).not.toThrow();

    expect(store.select('value')).toBe('initial');
    expect(isReactive(store.state)).toBe(false);
  });
});
