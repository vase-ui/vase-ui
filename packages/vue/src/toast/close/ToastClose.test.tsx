import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, fireEvent, screen } from '#test-utils';
import * as Toast from '../index.parts';

describe('<Toast.Close />', () => {
  const { render } = createRenderer();

  const toast: Toast.Root.ToastObject = {
    id: 'test',
    title: 'title',
  };

  describeConformance(<Toast.Close />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render(node) {
      return render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast}>{node}</Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );
    },
  }));

  it('hides the button from assistive technology until the viewport expands or the button has focus', async () => {
    await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport" style={{ pointerEvents: 'none' }}>
          <Toast.Root toast={toast}>
            <Toast.Close data-testid="close" />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>,
    );

    const close = screen.getByTestId('close');
    expect(close).toHaveAttribute('aria-hidden', 'true');

    await fireEvent.focusIn(close);
    expect(close).toHaveAttribute('aria-hidden', 'false');

    await fireEvent.focusOut(close);
    expect(close).toHaveAttribute('aria-hidden', 'true');

    await fireEvent.mouseEnter(screen.getByTestId('viewport'));
    expect(close).toHaveAttribute('aria-hidden', 'false');
  });
});
