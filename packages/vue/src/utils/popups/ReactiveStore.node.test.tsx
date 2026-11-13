import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { NullStore } from './NullStore';

interface State {
  value: string;
}

const selectors = {
  value: (state: Readonly<State>) => state.value,
};

// All server requests share the store of a module, as they share the inert store of a handle.
const store = new NullStore<Readonly<State>, Record<string, never>, typeof selectors>(
  Object.freeze({ value: 'initial' }),
  Object.freeze({}),
  selectors,
);

const Writer = defineComponent(() => {
  store.set('value', 'set');
  store.update({ value: 'update' });
  return () => <span>{store.select('value')}</span>;
});

const Reader = defineComponent(() => () => <span>{store.select('value')}</span>);

describe('NullStore', () => {
  it('gives the initial value to a server render after another render wrote to the store', async () => {
    const first = await renderToString(<Writer />);
    const second = await renderToString(<Reader />);

    expect(first).toBe('<span>initial</span>');
    expect(second).toBe('<span>initial</span>');
  });
});
