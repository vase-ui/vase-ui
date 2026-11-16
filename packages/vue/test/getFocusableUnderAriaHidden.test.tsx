import { describe, expect, it } from 'vitest';
import { createRenderer, getFocusableUnderAriaHidden, screen } from '#test-utils';

describe('getFocusableUnderAriaHidden', () => {
  const { render } = createRenderer();

  it('returns the elements in the Tab order that have aria-hidden or an ancestor with it', async () => {
    await render(
      <div>
        <span aria-hidden="true" tabindex={0} data-testid="hidden-tab-stop" />
        <div aria-hidden="true">
          <button data-testid="button-below-hidden">Below</button>
          <button tabindex={-1}>Not in the Tab order</button>
          <span>Text</span>
        </div>
        <div aria-hidden="false">
          <button>Not hidden</button>
        </div>
        <button>Outside</button>
      </div>,
    );

    expect(getFocusableUnderAriaHidden()).toEqual([
      screen.getByTestId('hidden-tab-stop'),
      screen.getByTestId('button-below-hidden'),
    ]);
  });
});
