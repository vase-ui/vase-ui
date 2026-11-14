import { expect, describe, it } from 'vitest';
import { defineComponent, ref } from 'vue';
import { createRenderer, fireEvent, screen } from '#test-utils';

describe('fireEvent', () => {
  const { render } = createRenderer();

  it('resolves to false when a listener prevents the default action', async () => {
    await render(
      <button type="button" onClick={(event) => event.preventDefault()}>
        Press
      </button>,
    );

    expect(await fireEvent.click(screen.getByRole('button'))).toBe(false);
  });

  it('resolves to true when no listener prevents the default action', async () => {
    await render(
      <button type="button" onClick={() => {}}>
        Press
      </button>,
    );

    expect(await fireEvent.click(screen.getByRole('button'))).toBe(true);
  });

  it('shows a state change in the DOM when the call resolves', async () => {
    const Counter = defineComponent(() => {
      const count = ref(0);
      async function increment() {
        // The state changes after the dispatch returns.
        await Promise.resolve();
        count.value += 1;
      }
      return () => (
        <button type="button" onClick={() => void increment()}>
          {count.value}
        </button>
      );
    });
    await render(<Counter />);
    const button = screen.getByRole('button');

    expect(button).toHaveTextContent('0');

    await fireEvent.click(button);

    expect(button).toHaveTextContent('1');
  });
});
