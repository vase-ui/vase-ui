import { describe, expect, onTestFinished, vi, it } from 'vitest';
import { defineComponent, defineCustomElement, provide, shallowRef, Teleport } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import {
  createRenderer,
  describeConformance,
  expectSetupErrorWarnings,
  flushMicrotasks,
  installPartsInterop,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import { platform } from '../../common/platform';
import { NumberFieldScrubAreaContext } from '../root/NumberFieldRootContext';
import NumberFieldScrubAreaCursorReplace from './NumberFieldScrubAreaCursorReplace.test.vue';

const isWebKit = platform.engine.webkit;

const defaultScrubAreaContext: NumberFieldScrubAreaContext = {
  isScrubbing: shallowRef(true),
  isTouchInput: shallowRef(false),
  isPointerLockDenied: shallowRef(false),
  setCursor() {},
  scrubAreaElement: shallowRef<HTMLElement | null>(null),
};

const ScrubAreaContextProvider = defineComponent((_, { slots }) => {
  provide(NumberFieldScrubAreaContext, defaultScrubAreaContext);
  return () => slots.default?.();
});

const CURSOR_CSS = '.cursor { width: 20px; height: 10px; }';

// Vue renders this element in a shadow root, and it puts `styles` in that root.
const CURSOR_ELEMENT_NAME = 'vase-ui-test-scrub-cursor';
customElements.define(
  CURSOR_ELEMENT_NAME,
  defineCustomElement({
    styles: [CURSOR_CSS],
    configureApp: installPartsInterop,
    render: () => (
      <NumberField.Root>
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor class="cursor" data-testid="cursor" />
        </NumberField.ScrubArea>
      </NumberField.Root>
    ),
  }),
);

function getCenter(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// This component doesn't render on WebKit.
describe.skipIf(isWebKit)('<NumberField.ScrubAreaCursor />', () => {
  const { render } = createRenderer();

  describeConformance(<NumberField.ScrubAreaCursor />, () => ({
    elementIsRoot: false,
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <NumberField.Root>
          <NumberField.ScrubArea>
            <ScrubAreaContextProvider>{node}</ScrubAreaContextProvider>
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );
    },
  }));

  it('has presentation role', async () => {
    await render(
      <NumberField.Root>
        <NumberField.ScrubArea />
      </NumberField.Root>,
    );
    expect(screen.queryByRole('presentation')).not.toBe(null);
  });

  it('renders when using mouse input', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = vi.fn().mockResolvedValue(undefined);

      const { user } = await render(
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');

      await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });

      expect(screen.queryByTestId('scrub-area-cursor')).not.toBe(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('only renders a cursor for the active scrub area', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = vi.fn().mockResolvedValue(undefined);

      const { user } = await render(
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area-1">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
          <NumberField.ScrubArea data-testid="scrub-area-2">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const firstScrubArea = screen.getByTestId('scrub-area-1');

      await user.pointer({ target: firstScrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });

      expect(screen.queryAllByTestId('scrub-area-cursor')).toHaveLength(1);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render when using touch input', async () => {
    const { user } = await render(
      <NumberField.Root>
        <NumberField.ScrubArea>
          <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    const scrubArea = screen.getByRole('presentation');

    await user.pointer({ target: scrubArea, keys: '[TouchA>]', pointerName: 'touch' });
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
  });

  it('handles pointer lock denial through requestPointerLock API', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      const requestLockStub = vi.fn(() => {
        throw new Error('User denied pointer lock');
      });
      Element.prototype.requestPointerLock =
        requestLockStub as typeof Element.prototype.requestPointerLock;

      const { user } = await render(
        <NumberField.Root>
          <NumberField.ScrubArea>
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByRole('presentation');

      await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });

      expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
      expect(requestLockStub).toHaveBeenCalled();
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render after a quick tap when pointer lock resolves later', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      // Simulate pointer lock resolving after the user already released the pointer (tap)
      Element.prototype.requestPointerLock = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          setTimeout(resolve, 30);
        }),
      );

      const { user } = await render(
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');

      // Quick press and release (tap)
      await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
      await user.pointer({ target: scrubArea, keys: '[/MouseLeft]', pointerName: 'mouse' });
      window.dispatchEvent(new Event('pointerup'));
      // Wait longer than the delayed pointer lock resolution
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      // After a tap, the scrub cursor should not remain rendered
      expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('keeps the sampled position when the cursor renders during a scrub', async () => {
    const pointerLock = vi.spyOn(document.body, 'requestPointerLock').mockResolvedValue();
    onTestFinished(() => pointerLock.mockRestore());
    const label = shallowRef('first');

    await render(() => (
      <NumberField.Root>
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="area">
          <NumberField.ScrubAreaCursor
            data-testid="cursor"
            data-label={label.value}
            style={{ transform: 'scale(2)' }}
          />
        </NumberField.ScrubArea>
      </NumberField.Root>
    ));
    screen
      .getByTestId('area')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    await flushMicrotasks();
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, movementX: 4 }));
    const cursor = screen.getByTestId('cursor');
    const sample = cursor.style.transform;
    expect(sample).toContain('translate3d(14px,');
    label.value = 'second';
    await flushMicrotasks();
    expect(cursor).toHaveAttribute('data-label', 'second');
    expect(cursor.style.transform).toBe(sample);
  });

  it('moves a cursor that mounts before the old cursor unmounts', async () => {
    const pointerLock = vi
      .spyOn(document.body, 'requestPointerLock')
      .mockImplementation(() => Promise.resolve());

    try {
      const swapped = shallowRef(false);
      await render(() => <NumberFieldScrubAreaCursorReplace swapped={swapped.value} />);

      const scrubArea = screen.getByTestId('scrub-area');
      scrubArea.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }),
      );
      await flushMicrotasks();

      swapped.value = true;
      await flushMicrotasks();
      expect(screen.queryByTestId('old-cursor')).toBe(null);
      const cursor = screen.getByTestId('new-cursor');
      expect(cursor.style.transform).toBe('');

      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, movementX: 4 }));
      await flushMicrotasks();

      expect(cursor.style.transform).toContain('translate3d(14px,');
    } finally {
      pointerLock.mockRestore();
    }
  });

  describe('VUE-96: the portal element of the cursor', () => {
    it('renders the cursor in a portal element in the body that makes no box', async () => {
      const pointerLock = vi
        .spyOn(document.body, 'requestPointerLock')
        .mockImplementation(() => Promise.resolve());

      try {
        await render(
          <NumberField.Root>
            <NumberField.Input />
            <NumberField.ScrubArea data-testid="scrub-area">
              <NumberField.ScrubAreaCursor data-testid="cursor" />
            </NumberField.ScrubArea>
          </NumberField.Root>,
        );
        screen
          .getByTestId('scrub-area')
          .dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }),
          );
        await flushMicrotasks();

        const portal = screen.getByTestId('cursor').parentElement!;
        expect(portal).toHaveAttribute('data-vase-ui-portal');
        expect(portal.parentElement).toBe(document.body);
        expect(portal.getClientRects()).toHaveLength(0);
      } finally {
        pointerLock.mockRestore();
      }
    });
  });

  describe('VUE-108: the container of the cursor', () => {
    it('renders the cursor in the shadow root of its scrub area, where the styles of that root apply', async () => {
      const pointerLock = vi
        .spyOn(document.body, 'requestPointerLock')
        .mockImplementation(() => Promise.resolve());
      const host = document.body.appendChild(document.createElement(CURSOR_ELEMENT_NAME));

      try {
        await flushMicrotasks();
        const shadowRoot = host.shadowRoot!;
        shadowRoot
          .querySelector('[data-testid="scrub-area"]')!
          .dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 150 }),
          );
        await flushMicrotasks();

        const cursor = shadowRoot.querySelector('[data-testid="cursor"]')!;
        const portal = cursor.parentElement!;
        expect(portal).toHaveAttribute('data-vase-ui-portal');
        expect(portal.parentNode).toBe(shadowRoot);
        expect(getComputedStyle(cursor).width).toBe('20px');

        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        await waitFor(() => {
          expect(portal).not.toBeInTheDocument();
        });
        expect(shadowRoot.querySelector('[data-vase-ui-portal]')).toBe(null);
      } finally {
        pointerLock.mockRestore();
        host.remove();
        // Vue unmounts the app of the element in a microtask after the removal.
        await flushMicrotasks();
      }
    });

    // The field is in a shadow root below an ancestor with `style`. The press is at `200, 150`.
    async function pressScrubAreaBelow(style: string) {
      const pointerLock = vi
        .spyOn(document.body, 'requestPointerLock')
        .mockImplementation(() => Promise.resolve());
      onTestFinished(() => pointerLock.mockRestore());
      const ancestor = document.body.appendChild(document.createElement('div'));
      onTestFinished(() => ancestor.remove());
      ancestor.style.cssText = style;
      const shadowRoot = ancestor
        .appendChild(document.createElement('div'))
        .attachShadow({ mode: 'open' });
      const styleElement = document.createElement('style');
      // The rule for `div` shows that the styles of the page do not move the cursor.
      styleElement.textContent = `${CURSOR_CSS} div { margin: 9px; padding: 3px; }`;
      const container = document.createElement('div');
      shadowRoot.append(styleElement, container);

      await render(
        <Teleport to={container}>
          <NumberField.Root>
            <NumberField.Input />
            <NumberField.ScrubArea data-testid="scrub-area">
              <NumberField.ScrubAreaCursor class="cursor" data-testid="cursor" />
            </NumberField.ScrubArea>
          </NumberField.Root>
        </Teleport>,
      );
      shadowRoot
        .querySelector('[data-testid="scrub-area"]')!
        .dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 150 }),
        );
      await flushMicrotasks();

      return { ancestor, cursor: shadowRoot.querySelector('[data-testid="cursor"]')! };
    }

    it.each([
      {
        name: 'a translation and a border',
        style: 'transform: translate(100px, 40px); border: 7px solid',
      },
      { name: 'a scale', style: 'transform: scale(0.5); transform-origin: 0 0' },
    ])(
      'puts the cursor at the pointer when an ancestor of the shadow host has $name',
      async ({ style }) => {
        const { cursor } = await pressScrubAreaBelow(style);
        expect(getCenter(cursor).x).toBeCloseTo(200, 1);
        expect(getCenter(cursor).y).toBeCloseTo(150, 1);

        window.dispatchEvent(
          new PointerEvent('pointermove', { bubbles: true, movementX: 30, movementY: 10 }),
        );

        expect(getCenter(cursor).x).toBeCloseTo(230, 1);
        expect(getCenter(cursor).y).toBeCloseTo(160, 1);
        // The portal has only the cursor as a child.
        expect(cursor.parentElement!.children).toHaveLength(1);
      },
    );

    it('keeps the cursor at the pointer when the containing block moves during the scrub', async () => {
      const { ancestor, cursor } = await pressScrubAreaBelow('transform: translate(100px, 40px)');
      ancestor.style.transform = 'translate(150px, 60px)';

      window.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, movementX: 30, movementY: 10 }),
      );

      expect(getCenter(cursor).x).toBeCloseTo(230, 1);
      expect(getCenter(cursor).y).toBeCloseTo(160, 1);
    });

    it('keeps the cursor as the only child of its render slot during a scrub', async () => {
      const lock = vi.spyOn(document.body, 'requestPointerLock').mockResolvedValue();
      onTestFinished(() => lock.mockRestore());
      await render(() => (
        <NumberField.Root>
          <style>{'[data-testid="wrapper"] > span:only-child { width: 20px; height: 10px }'}</style>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="area">
            <NumberField.ScrubAreaCursor
              data-testid="cursor"
              v-slots={{
                render: ({ props }: { props: Record<string, unknown> }) => (
                  <div
                    data-testid="wrapper"
                    style="transform: translate(30px, 40px) scale(0.5); transform-origin: 0 0"
                  >
                    <span {...props} />
                  </div>
                ),
              }}
            />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));
      const area = screen.getByTestId('area');
      area.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, clientX: 120, clientY: 80 }),
      );
      await flushMicrotasks();
      const cursor = screen.getByTestId('cursor');
      const wrapper = screen.getByTestId('wrapper');
      expect(getComputedStyle(cursor).width).toBe('20px');
      const box = document.body.querySelector<HTMLElement>(':scope > [inert]');
      expect(box).toHaveAttribute('aria-hidden', 'true');
      expect(getComputedStyle(box!)).toMatchObject({ visibility: 'hidden', pointerEvents: 'none' });
      expect(getCenter(cursor)).toEqual({ x: 120, y: 80 });

      wrapper.style.transform = 'translate(60px, 10px) scale(2)';
      window.dispatchEvent(new PointerEvent('pointermove', { movementX: 5, movementY: 8 }));
      expect(getCenter(cursor)).toEqual({ x: 125, y: 88 });
      expect(wrapper.children).toHaveLength(1);
      expect(document.body.querySelector(':scope > [inert]')).toBe(box);

      window.dispatchEvent(new PointerEvent('pointerup'));
      await waitFor(() =>
        expect(document.querySelectorAll('[data-testid="wrapper"]')).toHaveLength(0),
      );
      expect(box!.isConnected).toBe(false);
    });

    it('renders the cursor in the document of its scrub area', async () => {
      const frame = document.body.appendChild(document.createElement('iframe'));
      onTestFinished(() => frame.remove());
      const frameDocument = frame.contentDocument!;
      const styleElement = frameDocument.createElement('style');
      styleElement.textContent = CURSOR_CSS;
      frameDocument.head.append(styleElement);
      const pointerLock = vi
        .spyOn(frameDocument.body, 'requestPointerLock')
        .mockImplementation(() => Promise.resolve());

      try {
        await render(
          <Teleport to={frameDocument.body}>
            <NumberField.Root>
              <NumberField.Input />
              <NumberField.ScrubArea data-testid="scrub-area">
                <NumberField.ScrubAreaCursor class="cursor" data-testid="cursor" />
              </NumberField.ScrubArea>
            </NumberField.Root>
          </Teleport>,
        );
        frameDocument
          .querySelector('[data-testid="scrub-area"]')!
          .dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 20 }),
          );
        await flushMicrotasks();

        const cursor = frameDocument.querySelector('[data-testid="cursor"]')!;
        expect(cursor.parentElement!.parentElement).toBe(frameDocument.body);
        // The coordinates of the pointer and of the cursor are those of the frame.
        expect(getCenter(cursor)).toEqual({ x: 50, y: 20 });
      } finally {
        pointerLock.mockRestore();
      }
    });

    it('renders the cursor in the root node of the scrub area after the field moves to another root', async () => {
      const pointerLock = vi
        .spyOn(document.body, 'requestPointerLock')
        .mockImplementation(() => Promise.resolve());
      onTestFinished(() => pointerLock.mockRestore());
      const host = document.body.appendChild(document.createElement('div'));
      const documentTarget = document.body.appendChild(document.createElement('div'));
      onTestFinished(() => {
        host.remove();
        documentTarget.remove();
      });
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const target = shallowRef(shadowRoot.appendChild(document.createElement('div')));
      await render(() => (
        <Teleport to={target.value}>
          <NumberField.Root>
            <NumberField.Input />
            <NumberField.ScrubArea data-testid="scrub-area">
              <NumberField.ScrubAreaCursor data-testid="cursor" />
            </NumberField.ScrubArea>
          </NumberField.Root>
        </Teleport>
      ));
      const scrubArea = shadowRoot.querySelector('[data-testid="scrub-area"]')!;
      scrubArea.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }),
      );
      await flushMicrotasks();
      const portal = shadowRoot.querySelector('[data-testid="cursor"]')!.parentElement!;
      expect(portal.parentNode).toBe(shadowRoot);
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await waitFor(() => {
        expect(portal).not.toBeInTheDocument();
      });

      target.value = documentTarget;
      await flushMicrotasks();
      expect(documentTarget.contains(scrubArea)).toBe(true);
      scrubArea.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }),
      );
      await flushMicrotasks();

      expect(screen.getByTestId('cursor').parentElement!.parentElement).toBe(document.body);
    });
  });

  // After a `setup` that throws, Vue 3.5.12 keeps the current instance set, so this case is last.
  it('throws a descriptive error when rendered outside <NumberField.ScrubArea>', async () => {
    await expect(
      render(
        <NumberField.Root>
          <NumberField.ScrubAreaCursor />
        </NumberField.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A part of the scrub area of Number Field must be inside <NumberField.ScrubArea>. Without a scrub area the part has no scrub to follow. Put the part inside <NumberField.ScrubArea>.',
    );

    expectSetupErrorWarnings(takeReportedMessages());
  });
});
