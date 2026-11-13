import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, KeepAlive, nextTick, onMounted, shallowRef, Teleport } from 'vue';
import type { PropType, ShallowRef } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import { platform } from '../../../common/platform';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { useFloatingRootStore } from '../floating-root/useFloatingRootStore';
import { usePortalContext } from '../portal/FloatingPortalContext';
import type { PortalContextValue } from '../portal/FloatingPortalContext';
import FloatingPortal from '../portal/FloatingPortal.vue';
import FloatingFocusManager from './FloatingFocusManager.vue';
import type { FloatingFocusManagerProps } from './FloatingFocusManager.vue';
import FocusGuard from './FocusGuard.vue';

// A module namespace is read-only. The mock gives `engine` as a plain object, so a case can set the
// flag.
vi.mock('../../../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../../../common/platform')>(
    '../../../common/platform',
  );
  return { platform: { ...actual.platform, engine: { ...actual.platform.engine } } };
});

function setWebKit(webkit: boolean) {
  const actual = platform.engine.webkit;
  Object.defineProperty(platform.engine, 'webkit', { value: webkit, configurable: true });
  onTestFinished(() => {
    Object.defineProperty(platform.engine, 'webkit', { value: actual, configurable: true });
  });
}

type ManagerProps = Partial<Omit<FloatingFocusManagerProps, 'store'>>;

// A popup with a reference field. The reference opens the popup for a click, and for a
// `mousedown` as a trigger of a popup part does. With `keepMounted`, the popup element stays and
// the focus manager is disabled while the popup is closed.
const Popup = defineComponent({
  props: {
    manager: { type: Object as PropType<ManagerProps>, default: () => ({}) },
    portal: Boolean,
    keepMounted: Boolean,
    role: { type: String, default: undefined },
    popupTabindex: { type: String, default: undefined },
    referenceRole: { type: String, default: undefined },
    onOpenChange: {
      type: Function as PropType<(open: boolean, reason: string) => void>,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    const open = shallowRef(false);
    const reference = shallowRef<HTMLElement | null>(null);
    const floating = shallowRef<HTMLElement | null>(null);
    const store = useFloatingRootStore({
      open,
      onOpenChange(nextOpen, eventDetails) {
        props.onOpenChange?.(nextOpen, eventDetails.reason);
        open.value = nextOpen;
      },
      elements: { anchor: reference, positionerElement: floating },
    });

    return () => {
      const content =
        open.value || props.keepMounted ? (
          <FloatingFocusManager
            store={store}
            {...props.manager}
            disabled={props.keepMounted ? !open.value : props.manager.disabled}
          >
            <div
              role={props.role}
              tabindex={props.popupTabindex}
              data-testid="floating"
              ref={(el) => {
                floating.value = el as HTMLElement | null;
              }}
            >
              {slots.default?.() ?? [
                <input data-testid="one" />,
                <input data-testid="two" />,
                <button
                  data-testid="close"
                  onClick={() => {
                    open.value = false;
                  }}
                />,
              ]}
            </div>
          </FloatingFocusManager>
        ) : null;

      return (
        <>
          <input
            data-testid="reference"
            role={props.referenceRole}
            ref={(el) => {
              reference.value = el as HTMLElement | null;
            }}
            onClick={() => {
              open.value = !open.value;
            }}
            onMousedown={(event: MouseEvent) => {
              store.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event));
            }}
          />
          {props.portal ? <FloatingPortal>{content}</FloatingPortal> : content}
        </>
      );
    };
  },
});

async function openPopup(root: ParentNode = document) {
  const reference = root.querySelector<HTMLElement>('[data-testid="reference"]')!;
  reference.focus();
  await fireEvent.click(reference);
  await flushMicrotasks();
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

// Holds the animation frames until the test runs them, so that a case controls when the focus
// manager moves the focus.
function holdAnimationFrames() {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  return () => frames.splice(0).forEach((callback) => callback(0));
}

function getInsideGuards(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-type="inside"]'));
}

describe('FloatingFocusManager', () => {
  const { render } = createRenderer();

  describe('initial focus', () => {
    it('focuses the first tabbable element when the popup opens', async () => {
      await render(<Popup />);

      await openPopup();

      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
    });

    it('focuses the popup with no scroll when the popup has no tabbable element', async () => {
      const runFrames = holdAnimationFrames();
      await render(<Popup role="dialog">{{ default: () => <span>text</span> }}</Popup>);
      await openPopup();
      const floating = screen.getByTestId('floating');
      const focus = vi.spyOn(floating, 'focus');

      runFrames();

      expect(floating).toHaveFocus();
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });

    const target = shallowRef<HTMLElement | null>(null);
    const guard = shallowRef<InstanceType<typeof FocusGuard> | null>(null);

    it.each<{
      name: string;
      initialFocus: ManagerProps['initialFocus'] | 'element' | 'component';
      focused: string;
    }>([
      { name: 'a ref of an element', initialFocus: target, focused: 'two' },
      { name: 'a ref of a component', initialFocus: guard, focused: 'exposed' },
      { name: 'an element', initialFocus: 'element', focused: 'two' },
      { name: 'a component', initialFocus: 'component', focused: 'exposed' },
      {
        name: 'a function that returns an element',
        initialFocus: () => target.value,
        focused: 'two',
      },
      { name: 'a function that returns true', initialFocus: () => true, focused: 'one' },
      { name: 'a function that returns null', initialFocus: () => null, focused: 'one' },
      { name: 'an empty ref', initialFocus: shallowRef(null), focused: 'one' },
      { name: 'a ref with no value', initialFocus: shallowRef(), focused: 'one' },
      { name: 'false', initialFocus: false, focused: 'reference' },
      {
        name: 'a function that returns nothing',
        initialFocus: () => undefined,
        focused: 'reference',
      },
    ])('takes initialFocus as $name', async ({ initialFocus, focused }) => {
      // A template gives the value of a ref, so the prop is first `null` and then the element or
      // the component.
      const getInitialFocus = () => {
        if (initialFocus === 'element') {
          return target.value;
        }
        return initialFocus === 'component' ? guard.value : initialFocus;
      };
      await render(() => (
        <Popup manager={{ initialFocus: getInitialFocus(), modal: false }}>
          {{
            default: () => [
              <input data-testid="one" />,
              <input
                data-testid="two"
                ref={(el) => {
                  target.value = el as HTMLElement | null;
                }}
              />,
              <FocusGuard
                data-testid="exposed"
                ref={(instance) => {
                  guard.value = instance as InstanceType<typeof FocusGuard> | null;
                }}
              />,
            ],
          }}
        </Popup>
      ));

      await openPopup();
      await nextFrame();
      await nextFrame();

      expect(screen.getByTestId(focused)).toHaveFocus();
    });

    it('gives the open interaction type to an initialFocus function', async () => {
      const initialFocus = vi.fn(() => true);
      await render(<Popup manager={{ initialFocus, openInteractionType: 'touch' }} />);

      await openPopup();

      expect(initialFocus).toHaveBeenCalledWith('touch');
    });

    it('keeps the focus that a part of the popup takes when it is mounted', async () => {
      const FocusedField = defineComponent({
        setup() {
          const field = shallowRef<HTMLInputElement | null>(null);
          onMounted(() => field.value?.focus());
          return () => <input data-testid="focused" ref={field} />;
        },
      });
      await render(
        <Popup>{{ default: () => [<input data-testid="one" />, <FocusedField />] }}</Popup>,
      );

      await openPopup();
      await nextFrame();
      await nextFrame();

      expect(screen.getByTestId('focused')).toHaveFocus();
    });

    it.each([
      { name: 'in the task of a screen reader press', detail: 0, focused: 'one' },
      { name: 'one frame after a mouse press', detail: 1, focused: 'reference' },
    ])('moves the focus $name', async ({ detail, focused }) => {
      await render(<Popup />);
      const reference = screen.getByTestId('reference');
      reference.focus();
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

      await fireEvent.mouseDown(reference, { detail });
      await flushMicrotasks();

      expect(screen.getByTestId(focused)).toHaveFocus();
    });

    it('moves no focus when the popup closes before the frame', async () => {
      const runFrames = holdAnimationFrames();
      await render(<Popup keepMounted />);
      await openPopup();

      await fireEvent.click(screen.getByTestId('reference'));
      runFrames();

      expect(screen.getByTestId('reference')).toHaveFocus();
    });

    it('moves the focus when a disabled focus manager becomes enabled', async () => {
      const disabled = shallowRef(true);
      await render(() => <Popup manager={{ disabled: disabled.value }} />);
      await openPopup();
      await nextFrame();
      await nextFrame();
      expect(screen.getByTestId('reference')).toHaveFocus();

      disabled.value = false;

      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
    });
  });

  describe('modal popup', () => {
    it('keeps the Tab key in the popup', async () => {
      await render(
        <div>
          <input data-testid="before" />
          <Popup>
            {{ default: () => [<input data-testid="one" />, <input data-testid="two" />] }}
          </Popup>
          <input data-testid="after" />
        </div>,
      );
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await userEvent.tab();
      expect(screen.getByTestId('two')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('one')).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('two')).toHaveFocus();
    });

    it('keeps the focus on a popup that has no tabbable element', async () => {
      await render(
        <div>
          <Popup role="dialog">{{ default: () => <span>text</span> }}</Popup>
          <input data-testid="after" />
        </div>,
      );
      await openPopup();
      const floating = screen.getByTestId('floating');
      await waitFor(() => expect(floating).toHaveFocus());

      await userEvent.tab();
      expect(floating).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(floating).toHaveFocus();
    });

    it.each<{ name: string; props: Record<string, unknown>; guards: number }>([
      { name: 'a modal popup', props: {}, guards: 2 },
      {
        name: 'a non-modal popup with no portal',
        props: { manager: { modal: false } },
        guards: 0,
      },
      {
        name: 'a non-modal popup in a portal',
        props: { manager: { modal: false }, portal: true },
        guards: 2,
      },
      { name: 'a disabled focus manager', props: { manager: { disabled: true } }, guards: 0 },
      {
        name: 'a combobox field with no initial focus',
        props: { manager: { initialFocus: false }, referenceRole: 'combobox' },
        guards: 0,
      },
    ])('renders $guards guards for $name', async ({ props, guards }) => {
      await render(<Popup {...props} />);

      await openPopup();

      expect(getInsideGuards()).toHaveLength(guards);
    });
  });

  describe('popup that is not modal, in a portal', () => {
    async function renderPortalPopup(manager: ManagerProps = {}) {
      const handleOpenChange = vi.fn();
      await render(
        <div>
          <input data-testid="before" />
          <Popup portal manager={{ modal: false, ...manager }} onOpenChange={handleOpenChange}>
            {{ default: () => [<input data-testid="one" />, <input data-testid="two" />] }}
          </Popup>
          <input data-testid="after" />
        </div>,
      );
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
      return handleOpenChange;
    }

    it('sends Shift+Tab from the first field to the reference, and Tab back into the popup', async () => {
      const handleOpenChange = await renderPortalPopup();

      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('reference')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('one')).toHaveFocus();

      expect(handleOpenChange).not.toHaveBeenCalled();
    });

    it('sends Tab from the last field to the field after the reference, and closes the popup', async () => {
      const handleOpenChange = await renderPortalPopup();
      screen.getByTestId('two').focus();

      await userEvent.tab();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(handleOpenChange.mock.calls).toEqual([[false, 'focus-out']]);
    });

    it('sends the focus to previousFocusableElement and to nextFocusableElement', async () => {
      const previous = shallowRef<HTMLElement | null>(null);
      const next = shallowRef<HTMLElement | null>(null);
      await render(() => (
        <div>
          <input data-testid="previous" ref={previous} />
          <input data-testid="next" ref={next} />
          <Popup
            portal
            manager={{
              modal: false,
              previousFocusableElement: previous,
              nextFocusableElement: () => next.value,
            }}
          >
            {{ default: () => <input data-testid="one" /> }}
          </Popup>
        </div>
      ));
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('previous')).toHaveFocus();

      screen.getByTestId('one').focus();
      await userEvent.tab();
      expect(screen.getByTestId('next')).toHaveFocus();
    });

    describe('VUE-33: a ref or a getter that gives no element', () => {
      it('sends Shift+Tab to the guard of the portal for previousFocusableElement', async () => {
        const handleOpenChange = await renderPortalPopup({
          previousFocusableElement: shallowRef(),
        });

        await userEvent.tab({ shift: true });

        expect(screen.getByTestId('reference')).toHaveFocus();
        expect(handleOpenChange).not.toHaveBeenCalled();
      });

      it('sends Tab to the guard of the portal for nextFocusableElement', async () => {
        const handleOpenChange = await renderPortalPopup({ nextFocusableElement: () => null });
        screen.getByTestId('two').focus();

        await userEvent.tab();

        expect(screen.getByTestId('after')).toHaveFocus();
        expect(handleOpenChange.mock.calls).toEqual([[false, 'focus-out']]);
      });
    });

    it('writes the first guard to beforeContentFocusGuardRef, and clears it at the unmount', async () => {
      const guardRef: ShallowRef<HTMLSpanElement | null> = shallowRef(null);
      await renderPortalPopup({ beforeContentFocusGuardRef: guardRef });

      expect(guardRef.value).toBe(getInsideGuards()[0]);

      await fireEvent.click(screen.getByTestId('reference'));
      expect(guardRef.value).toBe(null);
    });
  });

  describe('two focus managers in one portal', () => {
    it('keeps the guards of a focus manager that mounted later when an earlier one unmounts', async () => {
      let portalContext: PortalContextValue | undefined;
      const Probe = defineComponent({
        setup() {
          portalContext = usePortalContext();
          return () => null;
        },
      });
      const guardRef: ShallowRef<HTMLSpanElement | null> = shallowRef(null);
      const Manager = defineComponent({
        setup() {
          const store = useFloatingRootStore({ open: true });
          return () => (
            <FloatingFocusManager store={store} modal={false} beforeContentFocusGuardRef={guardRef}>
              <input />
            </FloatingFocusManager>
          );
        },
      });
      const hasFirst = shallowRef(true);
      const hasSecond = shallowRef(false);
      await render(() => (
        <FloatingPortal>
          <Probe />
          {hasFirst.value ? <Manager key="first" /> : null}
          {hasSecond.value ? <Manager key="second" /> : null}
        </FloatingPortal>
      ));

      // The second manager writes its guards in an update before the first manager unmounts. When
      // one update replaces the first manager, the first manager clears its refs before the second
      // manager writes them.
      hasSecond.value = true;
      await nextTick();
      const [secondBefore, secondAfter] = getInsideGuards().slice(2);
      expect(guardRef.value).toBe(secondBefore);
      expect(portalContext!.beforeInsideRef.value).toBe(secondBefore);
      expect(portalContext!.afterInsideRef.value).toBe(secondAfter);

      hasFirst.value = false;
      await nextTick();

      expect(getInsideGuards()).toHaveLength(2);
      expect(guardRef.value).toBe(secondBefore);
      expect(portalContext!.beforeInsideRef.value).toBe(secondBefore);
      expect(portalContext!.afterInsideRef.value).toBe(secondAfter);
    });
  });

  describe('tabindex of the popup', () => {
    it.each<{
      name: string;
      props: Record<string, unknown>;
      empty: boolean;
      expected: (string | null)[];
    }>([
      {
        name: 'a dialog with no tabbable element',
        props: { role: 'dialog' },
        empty: true,
        expected: ['0', '0'],
      },
      {
        name: 'a dialog with a tabbable element',
        props: { role: 'dialog' },
        empty: false,
        expected: ['-1', '-1'],
      },
      {
        name: 'a popup with another role',
        props: { role: 'listbox' },
        empty: true,
        expected: [null, null],
      },
      {
        name: 'a dialog with a tabindex of its own',
        props: { role: 'dialog', popupTabindex: '-1' },
        empty: true,
        expected: ['-1', null],
      },
    ])('for $name', async ({ props, empty, expected }) => {
      await render(
        <Popup {...props} manager={{ initialFocus: false }}>
          {{ default: () => (empty ? <span>text</span> : <input />) }}
        </Popup>,
      );

      await openPopup();

      const floating = screen.getByTestId('floating');
      expect([floating.getAttribute('tabindex'), floating.getAttribute('data-tabindex')]).toEqual(
        expected,
      );
    });
  });

  describe('text field of a popup that closes and stays mounted', () => {
    async function closeWithFocusInField() {
      await render(<Popup keepMounted />);
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('reference'));
    }

    it('loses the focus when the engine is WebKit', async () => {
      setWebKit(true);
      await closeWithFocusInField();

      expect(screen.getByTestId('one')).not.toHaveFocus();
    });

    it('keeps the focus when the engine is not WebKit', async () => {
      setWebKit(false);
      await closeWithFocusInField();

      expect(screen.getByTestId('one')).toHaveFocus();
    });
  });

  it('releases its document listener while KeepAlive holds the popup, and takes it back', async () => {
    const added = vi.spyOn(document, 'addEventListener');
    const removed = vi.spyOn(document, 'removeEventListener');
    const countKeydown = () =>
      added.mock.calls.filter(([type]) => type === 'keydown').length -
      removed.mock.calls.filter(([type]) => type === 'keydown').length;
    const shown = shallowRef(true);
    const Page = defineComponent({
      setup: () => () => (
        <Popup portal role="dialog">
          {{ default: () => <input data-testid="one" /> }}
        </Popup>
      ),
    });
    await render(() => <KeepAlive>{shown.value ? <Page /> : null}</KeepAlive>);
    const before = countKeydown();
    await openPopup();
    await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
    const guards = getInsideGuards();
    expect(countKeydown() - before).toBe(1);

    shown.value = false;
    await nextTick();
    expect(countKeydown() - before).toBe(0);
    expect(screen.queryByTestId('floating')).toBe(null);

    shown.value = true;
    await nextTick();
    expect(countKeydown() - before).toBe(1);
    expect(getInsideGuards().map((guard, index) => guard === guards[index])).toEqual([true, true]);
    await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
  });

  it('manages the focus of a popup in a shadow root', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    onTestFinished(() => host.remove());
    const root = host.attachShadow({ mode: 'open' });
    await render(
      <Teleport to={root as unknown as HTMLElement}>
        <Popup>
          {{ default: () => [<input data-testid="one" />, <input data-testid="two" />] }}
        </Popup>
      </Teleport>,
    );
    const query = (id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);

    await openPopup(root);
    await waitFor(() => expect(root.activeElement).toBe(query('one')));

    await userEvent.tab();
    await userEvent.tab();
    expect(root.activeElement).toBe(query('one'));
  });

  it('manages the focus of a popup in the document of a frame', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    onTestFinished(() => frame.remove());
    const frameDocument = frame.contentDocument!;
    const added = vi.spyOn(frameDocument, 'addEventListener');
    await render(
      <Teleport to={frameDocument.body}>
        <Popup role="dialog" />
      </Teleport>,
    );

    await openPopup(frameDocument);

    await waitFor(() =>
      expect(frameDocument.activeElement).toBe(frameDocument.querySelector('[data-testid="one"]')),
    );
    expect(added.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
  });
});
