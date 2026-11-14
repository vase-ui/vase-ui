import { describe, expect, it } from 'vitest';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
} from '#test-utils';
import * as Toast from '../index.parts';
import { List, Button } from '../utils/test-utils';

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

  it('closes the toast when clicked', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });
    const viewport = screen.getByTestId('viewport');

    await user.click(button);

    expect(screen.getByTestId('title')).not.toBe(null);

    viewport.focus();
    await flushMicrotasks();

    const closeButton = screen.getByRole('button', { name: 'close-press' });

    await user.click(closeButton);

    expect(screen.queryByTestId('title')).toBe(null);
  });

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
