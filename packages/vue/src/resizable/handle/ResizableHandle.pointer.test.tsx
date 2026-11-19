import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, shallowRef } from 'vue';
import { createRenderer, penDrag, screen, touchDrag, waitFor } from '#test-utils';
import { platform } from '../../common/platform';
import { Resizable } from '@vase-ui/vue/resizable';

// The pointer of the browser stays where a case leaves it, for each later test. A call with no
// coordinates would move the pointer to the element of the last press, which is gone by then.
function releasePointerAfterTest() {
  onTestFinished(async () => {
    await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
  });
}

describe('<Resizable.Handle /> with the pointer of the browser', () => {
  const { render } = createRenderer();

  async function renderPanels(content?: unknown, handleProps: Record<string, unknown> = {}) {
    await render(
      <div style={{ width: '400px', height: '100px' }}>
        <Resizable.Root style={{ height: '100%' }}>
          <Resizable.Panel data-testid="first" />
          <Resizable.Handle
            data-testid="handle"
            style={{ flex: 'none', width: '8px' }}
            {...handleProps}
          />
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

  it('ends the drag when the handle replaces its capture target', async () => {
    const tag = shallowRef<'div' | 'span'>('div');
    await render(() => (
      <Resizable.Root style={{ width: '400px', height: '100px' }}>
        <Resizable.Panel />
        <Resizable.Handle as={tag.value} style={{ width: '8px' }} />
        <Resizable.Panel />
      </Resizable.Root>
    ));
    releasePointerAfterTest();
    const handle = screen.getByRole('separator');
    const rect = handle.getBoundingClientRect();
    await userEvent.pointer({
      coords: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      keys: '[MouseLeft>]',
    });
    expect(handle).toHaveAttribute('data-dragging');

    tag.value = 'span';
    await nextTick();
    const replacement = screen.getByRole('separator');
    expect(replacement.tagName).toBe('SPAN');
    expect(replacement).not.toHaveAttribute('data-dragging');
    await userEvent.pointer({ keys: '[/MouseLeft]' });
  });

  it('focuses the handle with the press', async () => {
    const { at } = await renderPanels();
    releasePointerAfterTest();

    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });

    expect(screen.getByTestId('handle')).toHaveFocus();
  });

  it('shows no focus ring for a press, also when a key focused another element before', async () => {
    await render(
      <div style={{ width: '400px', height: '100px' }}>
        <input data-testid="before" aria-label="Before" />
        <Resizable.Root style={{ height: '100%' }}>
          <Resizable.Panel />
          <Resizable.Handle data-testid="handle" style={{ flex: 'none', width: '8px' }} />
          <Resizable.Panel />
        </Resizable.Root>
      </div>,
    );
    releasePointerAfterTest();
    // The Tab key puts a visible focus on the text input.
    await userEvent.keyboard('{Tab}');
    expect(screen.getByTestId('before')).toHaveFocus();
    expect(screen.getByTestId('before').matches(':focus-visible')).toBe(true);
    const handle = screen.getByTestId('handle');
    const rect = handle.getBoundingClientRect();

    await userEvent.pointer({
      coords: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      keys: '[MouseLeft>]',
    });

    expect(handle).toHaveFocus();
    expect(handle.matches(':focus-visible')).toBe(false);
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

  it('runs a click listener of the consumer after a press with no move, and not after a drag', async () => {
    const onClick = vi.fn();
    const { at } = await renderPanels(undefined, { onClick });
    releasePointerAfterTest();

    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(onClick).toHaveBeenCalledTimes(1);

    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: at.x + 60, y: at.y } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(onClick).toHaveBeenCalledTimes(1);

    // The next press clears the rule, so a press and a release with no move give a click again.
    const moved = screen.getByTestId('handle').getBoundingClientRect();
    await userEvent.pointer({
      coords: { x: moved.left + moved.width / 2, y: moved.top + moved.height / 2 },
      keys: '[MouseLeft>]',
    });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  describe('hit area', () => {
    const thin = { style: { flex: 'none', width: '1px' } };

    it('starts a drag with a press beside a thin handle, and focuses the handle', async () => {
      const { first, at } = await renderPanels(undefined, thin);
      const before = first.getBoundingClientRect().width;
      releasePointerAfterTest();

      // The hit area is 10 px wide and the handle is 1 px wide, so 4 px from the center is on it.
      await userEvent.pointer({ coords: { x: at.x + 4, y: at.y }, keys: '[MouseLeft>]' });
      await userEvent.pointer({ coords: { x: at.x + 54, y: at.y } });

      expect(screen.getByTestId('handle')).toHaveFocus();
      expect(first.getBoundingClientRect().width - before).toBeCloseTo(50, 0);
    });

    it('starts no drag with a press that a layer over the handle takes', async () => {
      const { first, at } = await renderPanels(undefined, thin);
      await render(
        <div
          data-testid="layer"
          style={{
            position: 'fixed',
            left: `${at.x - 20}px`,
            top: `${at.y - 20}px`,
            width: '40px',
            height: '40px',
            zIndex: 2,
            background: 'white',
          }}
        />,
      );
      const before = first.getBoundingClientRect().width;
      releasePointerAfterTest();

      await userEvent.pointer({ coords: { x: at.x + 4, y: at.y }, keys: '[MouseLeft>]' });
      await userEvent.pointer({ coords: { x: at.x + 54, y: at.y } });

      expect(screen.getByTestId('handle')).not.toHaveAttribute('data-dragging');
      expect(first.getBoundingClientRect().width).toBe(before);
    });

    it('lets a click reach a button at the edge of a panel, 3 px beside a disabled handle', async () => {
      const onClick = vi.fn();
      await render(
        <div style={{ width: '400px', height: '100px' }}>
          <Resizable.Root style={{ height: '100%' }}>
            <Resizable.Panel />
            <Resizable.Handle
              data-testid="handle"
              disabled
              style={{ flex: 'none', width: '2px' }}
            />
            <Resizable.Panel>
              <button
                data-testid="button"
                type="button"
                style={{ width: '100%', height: '100%' }}
                onClick={onClick}
              >
                Press
              </button>
            </Resizable.Panel>
          </Resizable.Root>
        </div>,
      );
      const handle = screen.getByTestId('handle').getBoundingClientRect();

      await userEvent.pointer({
        coords: { x: handle.right + 3, y: handle.top + handle.height / 2 },
        keys: '[MouseLeft]',
      });

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('crossing', () => {
    // The outer root is 408 px wide with a handle of 8 px, so 1% of its panel space is 4 px. The
    // inner root is 308 px high with a handle of 8 px, so 1% of its panel space is 3 px.
    async function renderCrossing(inner: Record<string, unknown> = {}) {
      const committed = { outer: vi.fn(), inner: vi.fn() };
      await render(
        <div style={{ width: '408px', height: '308px' }}>
          <Resizable.Root
            data-testid="outer"
            style={{ height: '100%' }}
            onLayoutCommitted={committed.outer}
          >
            <Resizable.Panel />
            <Resizable.Handle data-testid="outer-handle" style={{ flex: 'none', width: '8px' }} />
            <Resizable.Panel>
              <Resizable.Root
                data-testid="inner"
                orientation="vertical"
                style={{ height: '100%' }}
                onLayoutCommitted={committed.inner}
              >
                <Resizable.Panel />
                <Resizable.Handle
                  data-testid="inner-handle"
                  style={{ flex: 'none', height: '8px' }}
                  {...inner}
                />
                <Resizable.Panel />
              </Resizable.Root>
            </Resizable.Panel>
          </Resizable.Root>
        </div>,
      );
      const outer = screen.getByTestId('outer-handle');
      const innerHandle = screen.getByTestId('inner-handle');
      const outerRect = outer.getBoundingClientRect();
      const innerRect = innerHandle.getBoundingClientRect();
      return {
        outer,
        inner: innerHandle,
        committed,
        // On the outer handle, 2 px from its right border and 4 px above the row of the inner handle.
        press: { x: outerRect.right - 2, y: innerRect.top - 4 },
        // The pointer on the right border of the outer handle, at the middle of the inner handle.
        junction: { x: outerRect.right - 2, y: innerRect.top + innerRect.height / 2 },
      };
    }

    const values = () => [
      screen.getByTestId('outer-handle').getAttribute('aria-valuenow'),
      screen.getByTestId('inner-handle').getAttribute('aria-valuenow'),
    ];

    it('moves both layouts with a press at the junction of two handles, and commits both roots', async () => {
      const { press, committed } = await renderCrossing();
      releasePointerAfterTest();

      await userEvent.pointer({ coords: press, keys: '[MouseLeft>]' });
      await userEvent.pointer({ coords: { x: press.x + 40, y: press.y + 30 } });
      expect(values()).toEqual(['60', '60']);
      await userEvent.pointer({ keys: '[/MouseLeft]' });

      expect(values()).toEqual(['60', '60']);
      expect(committed.outer).toHaveBeenCalledTimes(1);
      expect(committed.inner).toHaveBeenCalledTimes(1);
    });

    it('moves only the layout of the pressed handle with a press away from the junction', async () => {
      const { press } = await renderCrossing();
      releasePointerAfterTest();

      await userEvent.pointer({ coords: { x: press.x, y: press.y - 60 }, keys: '[MouseLeft>]' });
      await userEvent.pointer({ coords: { x: press.x + 40, y: press.y - 30 } });

      expect(values()).toEqual(['60', '50']);
    });

    it('sets data-crossing on the handle under a pointer with no button at the junction', async () => {
      const { outer, inner, junction } = await renderCrossing();

      await userEvent.pointer({ coords: junction });

      const under = document
        .elementFromPoint(junction.x, junction.y)
        ?.closest('[role="separator"]');
      expect(under).toHaveAttribute('data-crossing');

      await userEvent.pointer({ coords: { x: junction.x, y: junction.y - 80 } });

      expect(outer).not.toHaveAttribute('data-crossing');
      expect(inner).not.toHaveAttribute('data-crossing');
    });

    it('moves only the layout of a layer over the page with a press on a handle of the layer', async () => {
      const onLayerCommitted = vi.fn();
      await render(
        <div>
          <div style={{ width: '408px', height: '308px' }}>
            <Resizable.Root style={{ height: '100%' }}>
              <Resizable.Panel />
              <Resizable.Handle data-testid="page-handle" style={{ flex: 'none', width: '8px' }} />
              <Resizable.Panel />
            </Resizable.Root>
          </div>
          <div
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: '408px',
              height: '208px',
              zIndex: 2,
              background: 'white',
            }}
          >
            <Resizable.Root
              orientation="vertical"
              style={{ height: '100%' }}
              onLayoutCommitted={onLayerCommitted}
            >
              <Resizable.Panel />
              <Resizable.Handle
                data-testid="layer-handle"
                style={{ flex: 'none', height: '8px' }}
              />
              <Resizable.Panel />
            </Resizable.Root>
          </div>
        </div>,
      );
      const page = screen.getByTestId('page-handle').getBoundingClientRect();
      const layer = screen.getByTestId('layer-handle').getBoundingClientRect();
      // The point is on the handle of the page, and the layer covers it.
      const at = { x: page.left + page.width / 2, y: layer.top + layer.height / 2 };
      releasePointerAfterTest();

      await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
      await userEvent.pointer({ coords: { x: at.x + 40, y: at.y + 20 } });
      await userEvent.pointer({ keys: '[/MouseLeft]' });

      expect(screen.getByTestId('layer-handle')).toHaveAttribute('aria-valuenow', '60');
      expect(screen.getByTestId('page-handle')).toHaveAttribute('aria-valuenow', '50');
      expect(onLayerCommitted).toHaveBeenCalledTimes(1);
    });

    it('lets a click that a script makes reach the joined handle after a crossing drag', async () => {
      const onClick = vi.fn();
      const { inner, press } = await renderCrossing({ onClick });
      releasePointerAfterTest();

      await userEvent.pointer({ coords: press, keys: '[MouseLeft>]' });
      await userEvent.pointer({ coords: { x: press.x + 40, y: press.y + 30 } });
      await userEvent.pointer({ keys: '[/MouseLeft]' });
      inner.click();

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  // Only Chromium has the protocol that sends a real touch or a real pen. The dispatched cases of
  // the handle test give the same behavior in each engine.
  describe('touch and pen of Chromium', () => {
    const thin = { style: { flex: 'none', width: '1px' } };

    it.skipIf(!platform.engine.blink)(
      'moves the layout with a touch drag, and the browser cancels no pointer',
      async () => {
        const onPointercancel = vi.fn();
        const { first, at } = await renderPanels(undefined, { onPointercancel });
        const before = first.getBoundingClientRect().width;

        await touchDrag(at, { x: at.x + 100, y: at.y });

        expect(first.getBoundingClientRect().width - before).toBeCloseTo(100, 0);
        expect(onPointercancel).not.toHaveBeenCalled();
      },
    );

    it.skipIf(!platform.engine.blink)(
      'moves the layout with a touch drag that starts on the hit area beside the handle',
      async () => {
        const onPointercancel = vi.fn();
        const { first, at } = await renderPanels(undefined, { ...thin, onPointercancel });
        const before = first.getBoundingClientRect().width;

        await touchDrag({ x: at.x + 4, y: at.y }, { x: at.x + 104, y: at.y });

        expect(first.getBoundingClientRect().width - before).toBeCloseTo(100, 0);
        expect(onPointercancel).not.toHaveBeenCalled();
      },
    );

    it.skipIf(!platform.engine.blink)(
      'lets a click that a script makes reach the handle after a touch drag',
      async () => {
        const onClick = vi.fn();
        const { at } = await renderPanels(undefined, { onClick });

        await touchDrag(at, { x: at.x + 60, y: at.y });
        screen.getByTestId('handle').click();

        expect(onClick).toHaveBeenCalledTimes(1);
      },
    );

    it.skipIf(!platform.engine.blink)(
      'moves the layout with a pen drag, and stops the click that follows it',
      async () => {
        const onClick = vi.fn();
        const clicks: Event[] = [];
        const record = (event: Event) => clicks.push(event);
        window.addEventListener('click', record, true);
        onTestFinished(() => {
          window.removeEventListener('click', record, true);
        });
        const { first, at } = await renderPanels(undefined, { onClick });
        const before = first.getBoundingClientRect().width;

        await penDrag(at, { x: at.x + 60, y: at.y });

        expect(first.getBoundingClientRect().width - before).toBeCloseTo(60, 0);
        // The click of the pen comes with the release, and the handle stops it.
        await waitFor(() => {
          expect(clicks).toHaveLength(1);
        });
        expect(onClick).not.toHaveBeenCalled();
      },
    );

    it.skipIf(!platform.engine.blink)(
      'gives the click of a pen press and release with no move to the handle',
      async () => {
        const onClick = vi.fn();
        const { at } = await renderPanels(undefined, { onClick });

        await penDrag(at, at);

        await waitFor(() => {
          expect(onClick).toHaveBeenCalledTimes(1);
        });
      },
    );
  });
});
