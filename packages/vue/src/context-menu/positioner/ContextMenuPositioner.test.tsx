import { describe, expect, it } from 'vitest';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';
import * as ContextMenu from '../index.parts';

const popupWidth = 150;
const popupHeight = 100;

function rectOf(element: Element) {
  const { x, y } = element.getBoundingClientRect();
  return [x, y];
}

describe('<ContextMenu.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(<ContextMenu.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <ContextMenu.Root open>
          <ContextMenu.Portal>{node}</ContextMenu.Portal>
        </ContextMenu.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  function renderMenu(positioner: ContextMenu.Positioner.Props = {}) {
    return render(
      <ContextMenu.Root>
        <ContextMenu.Trigger data-testid="trigger" style={{ position: 'fixed', inset: '0' }}>
          area
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner data-testid="positioner" {...positioner}>
            <ContextMenu.Popup style={{ width: `${popupWidth}px`, height: `${popupHeight}px` }} />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );
  }

  describe('the position at the pointer', () => {
    it.each([
      {
        name: 'below the pointer and at its start',
        positioner: {},
        point: { clientX: 100, clientY: 80 },
        rect: [102, 75],
        side: 'bottom',
        align: 'start',
      },
      {
        name: 'on a side that is set, with no offset',
        positioner: { side: 'top' } as const,
        point: { clientX: 200, clientY: 400 },
        rect: [200, 300],
        side: 'top',
        align: 'start',
      },
      {
        name: 'at the center, with no offset',
        positioner: { align: 'center' } as const,
        point: { clientX: 200, clientY: 400 },
        rect: [200 - popupWidth / 2, 400],
        side: 'bottom',
        align: 'center',
      },
    ])('places the popup $name', async ({ positioner, point, rect, side, align }) => {
      await renderMenu(positioner);

      await fireEvent.contextMenu(screen.getByTestId('trigger'), point);
      const element = screen.getByTestId('positioner');

      await waitFor(() => {
        expect(rectOf(element)).toEqual(rect);
      });
      expect(element).toHaveAttribute('data-side', side);
      expect(element).toHaveAttribute('data-align', align);
      expect(element).toHaveStyle({ position: 'fixed' });
    });

    it('moves the open popup to the point of a second contextmenu event', async () => {
      await renderMenu();
      const trigger = screen.getByTestId('trigger');

      await fireEvent.contextMenu(trigger, { clientX: 100, clientY: 80 });
      const element = screen.getByTestId('positioner');
      await waitFor(() => {
        expect(rectOf(element)).toEqual([102, 75]);
      });

      await fireEvent.contextMenu(trigger, { clientX: 200, clientY: 120 });

      await waitFor(() => {
        expect(rectOf(element)).toEqual([202, 115]);
      });
      expect(screen.getByTestId('positioner')).toBe(element);
    });
  });

  describe('the edges of the viewport', () => {
    it.each([
      {
        name: 'the right edge',
        point: () => ({ clientX: window.innerWidth - 20, clientY: 80 }),
        rect: () => [window.innerWidth - 20 - popupWidth - 2, 75],
        side: 'bottom',
        align: 'end',
      },
      {
        name: 'the bottom edge',
        point: () => ({ clientX: 100, clientY: window.innerHeight - 20 }),
        rect: () => [102, window.innerHeight - 5 - popupHeight],
        side: 'bottom',
        align: 'start',
      },
      {
        name: 'the bottom right corner',
        point: () => ({ clientX: window.innerWidth - 20, clientY: window.innerHeight - 20 }),
        rect: () => [window.innerWidth - 20 - popupWidth - 2, window.innerHeight - 5 - popupHeight],
        side: 'bottom',
        align: 'end',
      },
    ])('keeps the popup in the viewport at $name', async ({ point, rect, side, align }) => {
      await renderMenu();

      await fireEvent.contextMenu(screen.getByTestId('trigger'), point());
      const element = screen.getByTestId('positioner');

      await waitFor(() => {
        expect(rectOf(element)).toEqual(rect());
      });
      expect(element).toHaveAttribute('data-side', side);
      expect(element).toHaveAttribute('data-align', align);
    });

    it('flips the popup above the pointer when collisionAvoidance flips the side', async () => {
      await renderMenu({ collisionAvoidance: { side: 'flip' } });

      await fireEvent.contextMenu(screen.getByTestId('trigger'), {
        clientX: window.innerWidth - 20,
        clientY: window.innerHeight - 20,
      });
      const element = screen.getByTestId('positioner');

      await waitFor(() => {
        expect(element).toHaveAttribute('data-side', 'top');
      });
      expect(rectOf(element)).toEqual([
        window.innerWidth - 20 - popupWidth,
        window.innerHeight - 20 + 5 - popupHeight,
      ]);
    });
  });

  it('positions the popup against the anchor prop in place of the pointer', async () => {
    await render(() => (
      <div>
        <div
          data-testid="anchor"
          style={{ position: 'fixed', left: '40px', top: '60px', width: '30px', height: '20px' }}
        />
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger" style={{ position: 'fixed', inset: '0' }}>
            area
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner
              data-testid="positioner"
              anchor={() => document.querySelector('[data-testid="anchor"]')}
            >
              <ContextMenu.Popup style={{ width: `${popupWidth}px`, height: `${popupHeight}px` }} />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </div>
    ));

    await fireEvent.contextMenu(screen.getByTestId('trigger'), { clientX: 200, clientY: 300 });

    await waitFor(() => {
      expect(rectOf(screen.getByTestId('positioner'))).toEqual([40 + 2, 60 + 20 - 5]);
    });
  });
});
