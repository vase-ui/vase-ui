import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Drawer, type DrawerSnapPoint } from '@vase-ui/vue/drawer';
import DialogWithDrawer from '../../test/fixtures/DialogWithDrawer.vue';
import DrawerPartAlone from '../../test/fixtures/DrawerPartAlone.vue';
import DrawerParts from '../../test/fixtures/DrawerParts.vue';
import DrawerWithKeyboard from '../../test/fixtures/DrawerWithKeyboard.vue';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

const platform = vi.hoisted(() => ({ android: false }));

vi.mock('../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../common/platform')>('../common/platform');
  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: {
        ...actual.platform.os,
        get android() {
          return platform.android;
        },
      },
    },
  };
});

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const get = (id: string) => byTestId(id)!;

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onOpenChange: (open: boolean, details: { reason: string }) =>
      log.push(`openChange ${open} ${details.reason}`),
    'onUpdate:open': (open: boolean) => log.push(`update:open ${open}`),
    onSnapPointChange: (point: DrawerSnapPoint | null, details: { reason: string }) =>
      log.push(`snapPointChange ${point} ${details.reason}`),
    'onUpdate:snapPoint': (point: DrawerSnapPoint | null) => log.push(`update:snapPoint ${point}`),
  });
}

async function mountDrawer(setup: Props = {}) {
  const result = mount(DrawerParts, setup);
  await nextTick();
  await nextTick();
  return result;
}

async function opened(prefix = '') {
  await waitFor(() => expect(byTestId(`${prefix}popup`)).not.toBe(null));
  return get(`${prefix}popup`);
}

async function closed(prefix = '') {
  await waitFor(() => expect(byTestId(`${prefix}popup`)).toBe(null));
}

describe('Drawer', () => {
  describe('a drawer is a dialog', () => {
    test('opens a modal popup that takes the focus itself, not its first field', async () => {
      await mountDrawer({ backdrop: {} });
      const trigger = get('trigger');
      await userEvent.click(trigger);
      const popup = await opened();
      await waitFor(() => expect(document.activeElement).toBe(popup));
      expect(popup.getAttribute('role')).toBe('dialog');
      expect(popup.getAttribute('aria-modal')).toBe('true');
      expect(popup.getAttribute('tabindex')).toBe('-1');
      expect(popup.dataset.swipeDirection).toBe('down');
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(trigger.getAttribute('aria-controls')).toBe(popup.id);
      expect(get('viewport').getAttribute('role')).toBe('presentation');
      expect(get('backdrop').getAttribute('role')).toBe('presentation');
    });

    test('gives the focus to `initialFocus`, and back to the trigger at an Escape', async () => {
      const log: string[] = [];
      await mountDrawer({
        root: rootEvents(log),
        popup: { initialFocus: () => byTestId('button') },
      });
      await userEvent.click(get('trigger'));
      await opened();
      await waitFor(() => expect(document.activeElement).toBe(get('button')));
      await userEvent.keyboard('{Escape}');
      await closed();
      await waitFor(() => expect(document.activeElement).toBe(get('trigger')));
      expect(log).toEqual([
        'openChange true trigger-press',
        'update:open true',
        'openChange false escape-key',
        'update:open false',
      ]);
    });

    test('closes at a press on the backdrop and at `Drawer.Close`', async () => {
      const log: string[] = [];
      await mountDrawer({ root: rootEvents(log, { defaultOpen: true }), backdrop: {}, close: {} });
      await opened();
      await userEvent.click(get('popup').querySelector('button:last-of-type')!);
      await closed();
      await userEvent.click(get('trigger'));
      await opened();
      await userEvent.click(document.body, { position: { x: 5, y: 5 } });
      await closed();
      expect(log.filter((entry) => entry.startsWith('openChange false'))).toEqual([
        'openChange false close-press',
        'openChange false outside-press',
      ]);
    });

    test('closes from the `close()` of its template ref and from a handle', async () => {
      const handle = Drawer.createHandle<string>();
      const log: string[] = [];
      const { exposed } = await mountDrawer({ root: rootEvents(log, { handle }) });
      handle.openWithPayload('payload');
      await opened();
      expect(handle.isOpen).toBe(true);
      exposed.root.close();
      await closed();
      handle.open(null);
      await opened();
      handle.close();
      await closed();
      expect(log.filter((entry) => entry.startsWith('openChange'))).toEqual([
        'openChange true imperative-action',
        'openChange false imperative-action',
        'openChange true imperative-action',
        'openChange false imperative-action',
      ]);
    });

    test('names the popup with the title and the description of Dialog', async () => {
      await mountDrawer({ root: { defaultOpen: true }, title: true });
      const popup = await opened();
      await waitFor(() => expect(popup.getAttribute('aria-labelledby')).toBe(get('title').id));
      expect(popup.getAttribute('aria-describedby')).toBe(get('description').id);
    });
  });

  describe('snap points', () => {
    const sizes = { viewport: { style: 'height: 600px' }, popup: { style: 'height: 400px' } };

    test('starts at the first snap point and moves the popup by its offset', async () => {
      await mountDrawer({ root: { defaultOpen: true, snapPoints: ['100px', 1] }, ...sizes });
      const popup = await opened();
      await waitFor(() =>
        expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('300px'),
      );
      expect(popup.hasAttribute('data-expanded')).toBe(false);
    });

    test('follows `v-model:snap-point`, with a negative offset for a drawer that closes up', async () => {
      const root = reactive<Props>({
        defaultOpen: true,
        snapPoints: ['100px', 1],
        snapPoint: 1,
        swipeDirection: 'up',
      });
      await mountDrawer({ root, ...sizes });
      const popup = await opened();
      await waitFor(() => expect(popup.hasAttribute('data-expanded')).toBe(true));
      expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('0px');
      root.snapPoint = '100px';
      await waitFor(() =>
        expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('-300px'),
      );
    });

    test('puts a controlled `null` at the open place, and a removed value at the nearest point', async () => {
      const root = reactive<Props>({
        defaultOpen: true,
        snapPoints: ['100px', '100.5px', 1],
        snapPoint: null,
      });
      await mountDrawer({ root, ...sizes });
      const popup = await opened();
      await nextTick();
      expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('0px');
      root.snapPoint = '100px';
      await waitFor(() =>
        expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('299.5px'),
      );
    });

    test('puts an uncontrolled value that the list does not have at the default', async () => {
      await mountDrawer({
        root: { defaultOpen: true, snapPoints: ['100px', 1], defaultSnapPoint: '50px' },
        ...sizes,
      });
      const popup = await opened();
      await waitFor(() =>
        expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('300px'),
      );
    });

    test('puts an uncontrolled value that a new list does not have at the default', async () => {
      const root = reactive<Props>({
        defaultOpen: true,
        snapPoints: ['100px', 1],
        defaultSnapPoint: '100px',
      });
      await mountDrawer({ root, ...sizes });
      const popup = await opened();
      await waitFor(() =>
        expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('300px'),
      );
      root.defaultSnapPoint = 1;
      root.snapPoints = ['150px', 1];
      await waitFor(() =>
        expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('0px'),
      );
    });

    test('goes back to the default point after the events of a close', async () => {
      const log: string[] = [];
      await mountDrawer({
        root: rootEvents(log, { defaultOpen: true, snapPoints: ['100px', 1], defaultSnapPoint: 1 }),
        ...sizes,
      });
      await opened();
      await userEvent.keyboard('{Escape}');
      await closed();
      expect(log).toEqual([
        'openChange false escape-key',
        'update:open false',
        'snapPointChange 1 escape-key',
        'update:snapPoint 1',
      ]);
    });

    test('emits no snap point event for a root with no snap points', async () => {
      const log: string[] = [];
      await mountDrawer({ root: rootEvents(log, { defaultOpen: true }) });
      await opened();
      await userEvent.keyboard('{Escape}');
      await closed();
      expect(log.some((entry) => entry.startsWith('snapPointChange'))).toBe(false);
    });
  });

  describe('nested drawers', () => {
    test('give the drawer above their count, their height and the leave of its backdrop', async () => {
      await mountDrawer({
        root: { defaultOpen: true },
        backdrop: {},
        nested: { root: { defaultOpen: true }, backdrop: {} },
      });
      const popup = await opened();
      const nested = await opened('nested-');
      await waitFor(() =>
        expect(popup.style.getPropertyValue('--drawer-frontmost-height')).toBe('300px'),
      );
      expect(popup.style.getPropertyValue('--drawer-height')).toBe('300px');
      expect(popup.style.getPropertyValue('--nested-drawers')).toBe('1');
      expect(popup.hasAttribute('data-nested-drawer-open')).toBe(true);
      expect(get('nested-viewport').hasAttribute('data-nested')).toBe(true);
      expect(byTestId('nested-backdrop')).toBe(null);
      expect(nested.getAttribute('aria-modal')).toBe('true');

      await userEvent.keyboard('{Escape}');
      await closed('nested-');
      await waitFor(() => expect(popup.hasAttribute('data-nested-drawer-open')).toBe(false));
      expect(popup.style.getPropertyValue('--nested-drawers')).toBe('0');
      expect(popup.style.getPropertyValue('--drawer-height')).toBe('');
    });

    test('keep the height of the drawer above while its CSS stretches it', async () => {
      const popup = reactive<Props>({ style: 'height: 300px' });
      await mountDrawer({
        root: { defaultOpen: true },
        popup,
        nested: { root: { defaultOpen: true } },
      });
      const parent = await opened();
      await opened('nested-');
      await waitFor(() => expect(parent.style.getPropertyValue('--drawer-height')).toBe('300px'));
      popup.style = 'height: 500px';
      await waitFor(() => expect(parent.offsetHeight).toBe(500));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await nextTick();
      expect(parent.style.getPropertyValue('--drawer-height')).toBe('300px');
    });

    test('count a dialog in a drawer as a layer above it', async () => {
      await mountDrawer({ root: { defaultOpen: true }, dialog: true });
      await opened();
      await userEvent.click(get('dialog-trigger'));
      await waitFor(() => expect(byTestId('dialog-popup')).not.toBe(null));
      expect(get('dialog-popup').hasAttribute('data-nested')).toBe(true);
      await waitFor(() => expect(get('popup').hasAttribute('data-nested-drawer-open')).toBe(false));
      expect(get('viewport').hasAttribute('data-nested')).toBe(false);
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(byTestId('dialog-popup')).toBe(null));
      expect(byTestId('popup')).not.toBe(null);
    });

    test('count as a layer above a dialog', async () => {
      mount(DialogWithDrawer);
      await waitFor(() => expect(byTestId('trigger')).not.toBe(null));
      await userEvent.click(get('trigger'));
      await opened();
      await waitFor(() =>
        expect(get('dialog-popup').style.getPropertyValue('--nested-dialogs')).toBe('1'),
      );
      expect(get('viewport').hasAttribute('data-nested')).toBe(true);
      expect(byTestId('backdrop')).toBe(null);
    });
  });

  describe('provider', () => {
    test('makes the indent active while a drawer is open', async () => {
      await mountDrawer({ provider: true });
      const indent = get('indent');
      expect(indent.hasAttribute('data-active')).toBe(false);
      expect(get('indent-background').hasAttribute('data-active')).toBe(false);
      await userEvent.click(get('trigger'));
      await opened();
      await waitFor(() => expect(indent.hasAttribute('data-active')).toBe(true));
      expect(get('indent-background').hasAttribute('data-active')).toBe(true);
      expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(indent.hasAttribute('data-active')).toBe(false));
    });
  });

  describe('virtual keyboard', () => {
    test('gives the viewport the inset of the keyboard while a field has the focus', async () => {
      // A software keyboard makes the visual viewport shorter than the layout viewport.
      const events = new EventTarget();
      vi.stubGlobal('visualViewport', {
        height: innerHeight - 300,
        offsetTop: 0,
        scale: 1,
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
      });
      onTestFinished(() => {
        vi.unstubAllGlobals();
      });
      mount(DrawerWithKeyboard);
      await opened();
      const viewport = get('viewport');
      get('field').focus();
      await waitFor(() =>
        expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px'),
      );
      get('field').blur();
      await waitFor(() =>
        expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe(''),
      );
    });
  });

  describe('back gesture', () => {
    class TestCloseWatcher extends EventTarget {
      static watchers: TestCloseWatcher[] = [];
      destroyed = false;
      constructor() {
        super();
        TestCloseWatcher.watchers.push(this);
      }
      destroy() {
        this.destroyed = true;
      }
      /** Sends the `cancel` event of a back gesture, and tells if a listener prevented it. */
      back(cancelable = true) {
        return !this.dispatchEvent(new Event('cancel', { cancelable }));
      }
    }

    function androidWithWatcher() {
      platform.android = true;
      TestCloseWatcher.watchers = [];
      vi.stubGlobal('CloseWatcher', TestCloseWatcher);
      onTestFinished(() => {
        platform.android = false;
        vi.unstubAllGlobals();
      });
      const active = () => TestCloseWatcher.watchers.filter((watcher) => !watcher.destroyed);
      return { active };
    }

    test('closes the top drawer on Android with the reason `close-watcher`', async () => {
      const { active } = androidWithWatcher();
      const log: string[] = [];
      await mountDrawer({
        root: rootEvents(log, { defaultOpen: true }),
        nested: { root: { defaultOpen: true } },
      });
      await opened('nested-');
      await waitFor(() => expect(active()).toHaveLength(1));
      expect(active()[0]!.back()).toBe(false);
      await closed('nested-');
      expect(byTestId('popup')).not.toBe(null);
      await waitFor(() => expect(active()).toHaveLength(1));
      active()[0]!.back();
      await closed();
      expect(log).toEqual(['openChange false close-watcher', 'update:open false']);
    });

    test('keeps a drawer open for a cancelled request, unless the browser does not let a page cancel', async () => {
      const { active } = androidWithWatcher();
      await mountDrawer({
        root: {
          defaultOpen: true,
          onOpenChange: (_: boolean, details: { cancel(): void }) => details.cancel(),
        },
      });
      await opened();
      await waitFor(() => expect(active()).toHaveLength(1));
      expect(active()[0]!.back()).toBe(true);
      await nextTick();
      expect(byTestId('popup')).not.toBe(null);
      active()[0]!.back(false);
      await closed();
    });

    test('holds no watcher on another system', async () => {
      vi.stubGlobal('CloseWatcher', TestCloseWatcher);
      onTestFinished(() => {
        vi.unstubAllGlobals();
      });
      TestCloseWatcher.watchers = [];
      await mountDrawer({ root: { defaultOpen: true } });
      await opened();
      await nextTick();
      expect(TestCloseWatcher.watchers).toEqual([]);
    });
  });

  describe('errors', () => {
    test('throws for a popup with no viewport, a viewport with no portal, and a part with no root', () => {
      expect(String(mountError(DrawerPartAlone, { noViewport: true }))).toContain(
        '<Drawer.Popup> must be inside <Drawer.Viewport>',
      );
      expect(String(mountError(DrawerPartAlone, { noPortal: true }))).toContain(
        '<Drawer.Viewport> must be inside <Drawer.Portal>',
      );
      expect(String(mountError(DrawerPartAlone, { noRoot: true }))).toContain(
        '<Drawer.Viewport> must be inside <Drawer.Root>',
      );
      // After the error, Vapor renders the part with no setup, and warns about each binding.
      takeReportedMessages();
    });
  });
});
