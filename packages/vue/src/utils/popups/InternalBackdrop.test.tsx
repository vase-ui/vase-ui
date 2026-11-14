import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createApp, KeepAlive, nextTick, shallowRef } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { createScrollDocument, HIDDEN_SCROLLBARS_CSS } from '../../../test/fixtures/scrollDocument';
import { recordVueWarnings } from '../../../test/reportedMessages';
import { createAttribute } from './createAttribute';
import InternalBackdrop from './InternalBackdrop.vue';

// `startSpy` gets one call for each start of `autoUpdate`, and `stopSpy` one call for each stop.
const { startSpy, stopSpy } = vi.hoisted(() => ({ startSpy: vi.fn(), stopSpy: vi.fn() }));

vi.mock('@floating-ui/vue', async () => {
  const actual = await vi.importActual<typeof import('@floating-ui/vue')>('@floating-ui/vue');

  return {
    ...actual,
    autoUpdate: ((...args: Parameters<typeof actual.autoUpdate>) => {
      startSpy();
      const stop = actual.autoUpdate(...args);
      return () => {
        stopSpy();
        stop();
      };
    }) satisfies typeof actual.autoUpdate,
  };
});

const BACKDROP_FILE = 'src/utils/popups/InternalBackdrop.vue';

interface InternalBackdropInstance {
  element: HTMLElement | null;
}

// A browser rewrites the value of `clip-path`, so the expected value goes through the same rewrite.
function normalizeClipPath(value: string, document: Document = window.document) {
  const scratch = document.createElement('div');
  scratch.style.clipPath = value;
  return scratch.style.clipPath;
}

// The polygon of Base UI: the whole backdrop, and the rectangle of the cutout as a hole.
function getClipPath(element: Element) {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return normalizeClipPath(
    `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${left}px ${top}px,${left}px ${bottom}px,${right}px ${bottom}px,${right}px ${top}px,${left}px ${top}px)`,
    element.ownerDocument,
  );
}

function addCutout(parent: HTMLElement = document.body) {
  const cutout = document.createElement('div');
  cutout.style.cssText = 'position: fixed; top: 50px; left: 100px; width: 40px; height: 20px';
  parent.append(cutout);
  onTestFinished(() => cutout.remove());
  return cutout;
}

describe('InternalBackdrop', () => {
  const { render } = createRenderer();

  describe('element', () => {
    it('is a div with the role presentation, the inert marker and four styles, and no clip path', async () => {
      const { getByTestId } = await render(<InternalBackdrop data-testid="backdrop" />);
      const backdrop = getByTestId('backdrop');
      const computed = getComputedStyle(backdrop);

      expect(backdrop.tagName).toBe('DIV');
      expect(backdrop).toHaveAttribute('role', 'presentation');
      expect(backdrop).toHaveAttribute(createAttribute('inert'), '');
      expect(computed.position).toBe('fixed');
      expect(backdrop.style.getPropertyValue('inset')).toBe('0px');
      expect(computed.userSelect).toBe('none');
      expect(computed.getPropertyValue('-webkit-user-select')).toBe('none');
      expect(backdrop.style.clipPath).toBe('');
    });

    it('passes the attributes and the listeners of the caller to the element', async () => {
      const handleClick = vi.fn();
      const { getByTestId } = await render(
        <InternalBackdrop
          data-testid="backdrop"
          data-extra="value"
          class="caller"
          {...{ onClick: handleClick }}
        />,
      );
      const backdrop = getByTestId('backdrop');

      backdrop.click();

      expect(backdrop).toHaveAttribute('data-extra', 'value');
      expect(backdrop).toHaveClass('caller');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('lets the role of the caller win, and keeps its own style over the style of the caller', async () => {
      const { getByTestId } = await render(
        <InternalBackdrop
          data-testid="backdrop"
          role="dialog"
          style={{ position: 'absolute', color: 'red' }}
        />,
      );
      const backdrop = getByTestId('backdrop');

      expect(backdrop).toHaveAttribute('role', 'dialog');
      expect(backdrop.style.position).toBe('fixed');
      expect(backdrop.style.color).toBe('');
    });

    it.each([
      { name: 'true', inert: true },
      { name: 'false', inert: false },
    ])('passes inert $name to the element', async ({ inert }) => {
      const { getByTestId } = await render(
        <InternalBackdrop data-testid="backdrop" inert={inert} />,
      );
      const backdrop = getByTestId('backdrop');

      expect(backdrop.hasAttribute('inert')).toBe(inert);
      expect(backdrop.inert).toBe(inert);
    });

    it('exposes its div as `element`', async () => {
      let backdrop: InternalBackdropInstance | null = null;
      const { getByTestId } = await render(() => (
        <InternalBackdrop
          data-testid="backdrop"
          ref={(value) => {
            backdrop = value as InternalBackdropInstance | null;
          }}
        />
      ));

      expect(backdrop!.element).toBe(getByTestId('backdrop'));
    });
  });

  describe('cutout', () => {
    it('cuts the rectangle of the cutout out of the clip path', async () => {
      const cutout = addCutout();
      const { getByTestId } = await render(
        <InternalBackdrop data-testid="backdrop" cutout={cutout} />,
      );

      expect(getByTestId('backdrop').style.clipPath).toBe(
        normalizeClipPath(
          'polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,100px 50px,100px 70px,140px 70px,140px 50px,100px 50px)',
        ),
      );
    });

    it.each([
      {
        name: 'a layout change moves it',
        move: ({ spacer }: { spacer: HTMLElement }) => {
          spacer.style.height = '40px';
        },
      },
      {
        name: 'the scroll of an ancestor moves it',
        move: ({ scroller }: { scroller: HTMLElement }) => {
          scroller.scrollTop = 25;
        },
      },
    ])('moves the hole when $name', async ({ move }) => {
      const scroller = document.createElement('div');
      scroller.style.cssText =
        'position: fixed; top: 100px; left: 100px; width: 200px; height: 150px; overflow: auto';
      const spacer = document.createElement('div');
      spacer.style.height = '10px';
      const cutout = document.createElement('div');
      cutout.style.cssText = 'width: 40px; height: 20px';
      const content = document.createElement('div');
      content.style.height = '1000px';
      scroller.append(spacer, cutout, content);
      document.body.append(scroller);
      onTestFinished(() => scroller.remove());
      const { getByTestId } = await render(
        <InternalBackdrop data-testid="backdrop" cutout={cutout} />,
      );
      const backdrop = getByTestId('backdrop');
      await flushMicrotasks();
      const before = getClipPath(cutout);
      expect(backdrop.style.clipPath).toBe(before);

      move({ spacer, scroller });
      const after = getClipPath(cutout);
      expect(after).not.toBe(before);

      await waitFor(() => expect(backdrop.style.clipPath).toBe(after));
    });

    it('follows a new cutout element', async () => {
      const first = addCutout();
      const second = addCutout();
      second.style.top = '200px';
      const cutout = shallowRef(first);
      const { getByTestId } = await render(() => (
        <InternalBackdrop data-testid="backdrop" cutout={cutout.value} />
      ));
      const backdrop = getByTestId('backdrop');
      // The first notification of each observer of `autoUpdate` comes after two animation frames.
      await waitSingleFrame();
      await waitSingleFrame();

      cutout.value = second;
      await nextTick();
      expect(backdrop.style.clipPath).toBe(getClipPath(second));
      expect(startSpy).toHaveBeenCalledTimes(2);
      expect(stopSpy).toHaveBeenCalledTimes(1);

      second.style.top = '260px';
      const after = getClipPath(second);
      expect(after).not.toBe(getClipPath(first));

      await waitFor(() => expect(backdrop.style.clipPath).toBe(after));
    });

    it('moves the hole when the window of a frame resizes', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const frame = page.win.frameElement as HTMLIFrameElement;
      const cutout = page.doc.createElement('div');
      cutout.style.cssText = 'position: fixed; top: 10px; right: 10px; width: 40px; height: 20px';
      page.body.append(cutout);
      const container = page.doc.createElement('div');
      page.body.append(container);
      const app = createApp({ render: () => <InternalBackdrop cutout={cutout} /> });
      recordVueWarnings(app);
      app.mount(container);
      onTestFinished(() => app.unmount());
      await flushMicrotasks();
      const backdrop = container.firstElementChild as HTMLElement;
      const before = getClipPath(cutout);
      expect(backdrop.style.clipPath).toBe(before);

      frame.style.width = '300px';
      await waitFor(() => expect(page.win.innerWidth).toBe(300));
      const after = getClipPath(cutout);
      expect(after).not.toBe(before);

      await waitFor(() => expect(backdrop.style.clipPath).toBe(after));
    });

    it('starts `autoUpdate` for a cutout only, and stops it when the part unmounts', async () => {
      const cutout = addCutout();
      const { unmount } = await render(<InternalBackdrop />);
      await flushMicrotasks();
      expect(startSpy).not.toHaveBeenCalled();

      const { unmount: unmountWithCutout } = await render(<InternalBackdrop cutout={cutout} />);
      await flushMicrotasks();
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).not.toHaveBeenCalled();

      unmountWithCutout();
      expect(stopSpy).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('stops `autoUpdate` at the deactivation of KeepAlive and starts it again at the activation', async () => {
      const cutout = addCutout();
      const visible = shallowRef(true);
      await render(() => (
        <KeepAlive>
          {visible.value ? (
            <InternalBackdrop key="backdrop" cutout={cutout} />
          ) : (
            <span key="other" />
          )}
        </KeepAlive>
      ));
      await flushMicrotasks();
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).not.toHaveBeenCalled();

      visible.value = false;
      await nextTick();
      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledTimes(1);

      visible.value = true;
      await nextTick();
      expect(startSpy).toHaveBeenCalledTimes(2);
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('hydration', () => {
    it('renders the element on a server and hydrates it with no message', async () => {
      const serverHtml = await renderOnServer(BACKDROP_FILE);

      expect(serverHtml).toBe(
        '<div role="presentation" data-vase-ui-inert style="position:fixed;inset:0;user-select:none;-webkit-user-select:none;"></div>',
      );

      const { container } = await hydrate(InternalBackdrop, { serverHtml });

      expect(container.firstElementChild).toHaveAttribute('role', 'presentation');
    });
  });
});
