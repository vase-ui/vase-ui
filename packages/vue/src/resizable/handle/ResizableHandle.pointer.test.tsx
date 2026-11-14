import { describe, expect, it, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createRenderer, screen, waitFor } from '#test-utils';
import * as Resizable from '../index.parts';

// The pointer of the browser stays where a case leaves it, for each later test. A call with no
// coordinates would move the pointer to the element of the last press, which is gone by then.
function releasePointerAfterTest() {
  onTestFinished(async () => {
    await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
  });
}

describe('<Resizable.Handle /> with the pointer of the browser', () => {
  const { render } = createRenderer();

  async function renderPanels(content?: unknown) {
    await render(
      <div style={{ width: '400px', height: '100px' }}>
        <Resizable.Root style={{ height: '100%' }}>
          <Resizable.Panel data-testid="first" />
          <Resizable.Handle data-testid="handle" style={{ flex: 'none', width: '8px' }} />
          <Resizable.Panel data-testid="second">{content}</Resizable.Panel>
        </Resizable.Root>
      </div>,
    );
    const handle = screen.getByTestId('handle').getBoundingClientRect();
    return {
      first: screen.getByTestId('first'),
      second: screen.getByTestId('second'),
      at: { x: handle.left + handle.width / 2, y: handle.top + handle.height / 2 },
    };
  }

  it('moves the layout with a press, a move and a release', async () => {
    const { first, at } = await renderPanels();
    const before = first.getBoundingClientRect().width;
    releasePointerAfterTest();

    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: at.x + 100, y: at.y } });
    expect(screen.getByTestId('handle')).toHaveAttribute('data-dragging');
    expect(first.getBoundingClientRect().width - before).toBeCloseTo(100, 0);

    await userEvent.pointer({ keys: '[/MouseLeft]' });

    expect(screen.getByTestId('handle')).not.toHaveAttribute('data-dragging');
    expect(first.getBoundingClientRect().width - before).toBeCloseTo(100, 0);
  });

  it('follows the pointer across an iframe', async () => {
    const { first, at } = await renderPanels(
      <iframe
        data-testid="frame"
        title="Frame"
        srcdoc="<p>Frame</p>"
        style={{ width: '100%', height: '100%', border: 0 }}
      />,
    );
    const frame = screen.getByTestId('frame') as HTMLIFrameElement;
    await waitFor(() => {
      expect(frame.contentDocument?.body.textContent).toBe('Frame');
    });
    const before = first.getBoundingClientRect().width;
    releasePointerAfterTest();

    // The first move goes over the iframe, which the handle has not reached yet.
    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: at.x + 150, y: at.y } });

    expect(first.getBoundingClientRect().width - before).toBeCloseTo(150, 0);
  });

  it('selects no text when the pointer crosses a paragraph', async () => {
    const { first, at } = await renderPanels(
      <p data-testid="text" style={{ margin: 0 }}>
        The panels show this text, and a drag across it keeps the page free of a selection.
      </p>,
    );
    const before = first.getBoundingClientRect().width;
    releasePointerAfterTest();

    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: at.x + 60, y: at.y } });
    await userEvent.pointer({ coords: { x: at.x + 150, y: at.y + 10 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });

    expect(first.getBoundingClientRect().width - before).toBeCloseTo(150, 0);
    expect(window.getSelection()?.toString()).toBe('');
  });
});
