import { describe, expect, it } from 'vitest';
import { shallowRef, Teleport } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Menu } from '@vase-ui/vue/menu';
import { TimeClock } from '@vase-ui/vue/time-clock';
import { TimePicker } from '@vase-ui/vue/time-picker';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
  waitForLaterMillisecond,
  within,
} from '#test-utils';
import { TestElement } from '../../test/testElement';
import PopupPortal from '../utils/popups/portal/PopupPortal.vue';
import { getNestedPortals, isPortalOfPart } from '../utils/popups/portal/portalElements';
import CompositeItem from '../../test/fixtures/CompositeItemPart.vue';
import CompositeRoot from '../../test/fixtures/CompositeRootPart.vue';
import { useElementRegistration } from './useElementRegistration';

describe('owned parts', () => {
  const { render } = createRenderer();

  it('updates the element registry in the same task as the ref', async () => {
    const registry = new WeakMap<Element, () => string>();
    const first = document.createElement('button');
    const second = document.createElement('button');
    const target = shallowRef<Element | null>(first);
    const setupElement = () => {
      useElementRegistration(
        registry,
        () => target.value,
        () => 'owner',
      );
    };
    const { unmount } = await render(<TestElement setupElement={setupElement} />);

    expect(registry.get(first)?.()).toBe('owner');
    target.value = null;
    expect(registry.has(first)).toBe(false);
    target.value = second;
    expect(registry.get(second)?.()).toBe('owner');
    unmount();
    expect(registry.has(second)).toBe(false);
  });

  it('keeps the current owner when an earlier getter returns the same element', async () => {
    const registry = new WeakMap<Element, () => string>();
    const node = document.createElement('button');
    const first = shallowRef<{ element: Element | null }>({ element: node });
    const second = shallowRef<Element | null>(null);
    const setupElement = () => {
      useElementRegistration(
        registry,
        () => first.value.element,
        () => 'first',
      );
      useElementRegistration(registry, second, () => 'second');
    };
    const { unmount } = await render(<TestElement setupElement={setupElement} />);
    expect(registry.get(node)?.()).toBe('first');
    second.value = node;
    expect(registry.get(node)?.()).toBe('second');

    first.value = { element: node };
    expect(registry.get(node)?.()).toBe('second');
    first.value = { element: null };
    expect(registry.get(node)?.()).toBe('second');
    unmount();
    expect(registry.has(node)).toBe(false);
  });

  it('VUE-54: keeps one tab stop when the active item moves and another item takes its index', async () => {
    const names = shallowRef(['First', 'Active', 'Last']);
    const active = shallowRef('Active');
    const { user } = await render(() => (
      <>
        <button>Before</button>
        <CompositeRoot>
          {names.value.map((name, index) => (
            <CompositeItem key={name} as="button" index={index} active={active.value === name}>
              {name}
            </CompositeItem>
          ))}
        </CompositeRoot>
        <button>After</button>
      </>
    ));
    const button = (name: string) => screen.getByRole('button', { name });
    const original = button('Active');
    expect(original.tabIndex).toBe(0);
    names.value = ['First', 'Last', 'Active'];
    await flushMicrotasks();
    expect(original.tabIndex).toBe(0);

    names.value = ['First', 'Last', 'Replacement'];
    active.value = 'Replacement';
    await flushMicrotasks();
    expect(original.isConnected).toBe(false);
    button('Before').focus();
    await user.tab();
    expect(button('Replacement')).toHaveFocus();
    await user.tab();
    expect(button('After')).toHaveFocus();
  });

  it('VUE-113: moves the tab stop when a fieldset disables a native item outside its first legend', async () => {
    const disabled = shallowRef(false);
    await render(() => (
      <CompositeRoot>
        <fieldset disabled={disabled.value}>
          <legend>
            <CompositeItem as="button">First</CompositeItem>
          </legend>
          <legend data-testid="second">
            <CompositeItem as="button" active>
              Active
            </CompositeItem>
          </legend>
        </fieldset>
      </CompositeRoot>
    ));
    const first = screen.getByRole('button', { name: 'First' });
    const active = screen.getByRole('button', { name: 'Active' });
    expect(active.tabIndex).toBe(0);
    disabled.value = true;
    await flushMicrotasks();
    expect([first.tabIndex, active.tabIndex]).toEqual([0, -1]);
    screen.getByRole('group').prepend(screen.getByTestId('second'));
    await flushMicrotasks();
    expect([first.tabIndex, active.tabIndex]).toEqual([-1, 0]);
  });

  it('VUE-54: keeps the tab stop on the focused item in an iframe until focus leaves it', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const body = frame.contentDocument?.body;
      if (!body) {
        throw new Error('The iframe has no document.');
      }
      const active = shallowRef(false);
      const { unmount } = await render(() => (
        <CompositeRoot>
          <CompositeItem as="button" index={0} active={active.value}>
            First
          </CompositeItem>
          <Teleport to={body}>
            <CompositeItem as="button" index={1}>
              Second
            </CompositeItem>
          </Teleport>
        </CompositeRoot>
      ));
      try {
        const first = screen.getByRole('button', { name: 'First' });
        const second = within(body).getByRole('button', { name: 'Second' });
        second.focus();
        await flushMicrotasks();
        expect(body.ownerDocument.activeElement).toBe(second);
        active.value = true;
        await flushMicrotasks();
        expect([first.tabIndex, second.tabIndex]).toEqual([-1, 0]);
        second.blur();
        await flushMicrotasks();
        expect([first.tabIndex, second.tabIndex]).toEqual([0, -1]);
        second.focus();
        await flushMicrotasks();
        await fireEvent.keyDown(second, { key: 'ArrowLeft' });
        await flushMicrotasks();
        expect(first).toHaveFocus();
      } finally {
        unmount();
      }
    } finally {
      frame.remove();
    }
  });

  it('VUE-113: follows the native fieldset after a registered item moves', async () => {
    await render(
      <CompositeRoot>
        <CompositeItem as="button">First</CompositeItem>
        <div data-testid="wrapper">
          <CompositeItem as="button" active>
            Active
          </CompositeItem>
        </div>
        <fieldset disabled />
      </CompositeRoot>,
    );
    const first = screen.getByRole('button', { name: 'First' });
    const active = screen.getByRole('button', { name: 'Active' });
    expect([first.tabIndex, active.tabIndex]).toEqual([-1, 0]);
    const fieldset = screen.getByRole('group') as HTMLFieldSetElement;
    fieldset.append(screen.getByTestId('wrapper'));
    await flushMicrotasks();
    expect([first.tabIndex, active.tabIndex]).toEqual([0, -1]);
    fieldset.disabled = false;
    await flushMicrotasks();
    expect([first.tabIndex, active.tabIndex]).toEqual([-1, 0]);
  });

  it('VUE-138: finds the nearest portal after a part moves through a shadow root', async () => {
    const innerTarget = shallowRef<ShadowRoot | null>(null);
    await render(() => (
      <>
        <PopupPortal data-testid="outer">
          <div data-testid="host" />
        </PopupPortal>
        <PopupPortal to={innerTarget.value} data-testid="inner">
          <button>Content</button>
        </PopupPortal>
      </>
    ));
    const outer = screen.getByTestId('outer');
    const host = screen.getByTestId('host');
    const root = host.attachShadow({ mode: 'open' });
    innerTarget.value = root;
    await flushMicrotasks();
    const inner = root.querySelector<HTMLElement>('[data-testid="inner"]');
    if (!inner) {
      throw new Error('The inner portal did not mount.');
    }
    const content = within(inner).getByRole('button');
    expect(getNestedPortals(outer)).toEqual([inner]);
    expect(isPortalOfPart(inner, content)).toBe(true);
    expect(isPortalOfPart(outer, content)).toBe(false);
    host.append(content);
    root.append(document.createElement('slot'));
    expect(isPortalOfPart(outer, content)).toBe(true);
    expect(isPortalOfPart(inner, content)).toBe(false);
  });

  it('accepts a press only from a registered calendar cell', async () => {
    const selected = Temporal.PlainDate.from('2026-11-18');
    const { user } = await render(
      <DatePicker.Root defaultOpen defaultValue={selected}>
        <DatePicker.Trigger>Date</DatePicker.Trigger>
        <DatePicker.Portal>
          <DatePicker.Positioner>
            <DatePicker.Popup>
              <DatePicker.Calendar>
                <div role="gridcell" aria-selected="true">
                  <button tabindex={0}>Other</button>
                </div>
                <Calendar.Months
                  v-slots={{
                    month: ({ month }: { month: Calendar.Month.Props['month'] }) => (
                      <Calendar.Month month={month}>
                        <Calendar.Day as="div" day={selected}>
                          <Calendar.DayButton data-testid="selected" />
                        </Calendar.Day>
                      </Calendar.Month>
                    ),
                  }}
                />
              </DatePicker.Calendar>
            </DatePicker.Popup>
          </DatePicker.Positioner>
        </DatePicker.Portal>
      </DatePicker.Root>,
    );
    await waitFor(() => expect(screen.getByTestId('selected')).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Other' }));
    const popup = screen.getByRole('dialog');
    expect(popup).toBeInTheDocument();
    await user.click(screen.getByTestId('selected'));
    await waitFor(() => expect(popup.isConnected).toBe(false));
  });

  it('focuses the clock face when another range precedes it in the picker', async () => {
    await render(
      <TimePicker.Root defaultOpen>
        <TimePicker.Trigger>Time</TimePicker.Trigger>
        <TimePicker.Portal>
          <TimePicker.Positioner>
            <TimePicker.Popup>
              <TimePicker.Clock>
                <input type="range" aria-label="Other" />
                <TimeClock.Face data-testid="face" />
              </TimePicker.Clock>
            </TimePicker.Popup>
          </TimePicker.Positioner>
        </TimePicker.Portal>
      </TimePicker.Root>,
    );
    await waitFor(() =>
      expect(within(screen.getByTestId('face')).getByRole('slider')).toHaveFocus(),
    );
  });

  it('VUE-46: returns the submenu key to its trigger across documents', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameBody = frame.contentDocument?.body;
      if (!frameBody) {
        throw new Error('The iframe has no document.');
      }
      const { user, unmount } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen orientation="horizontal">
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter" />
                  <Menu.List>
                    <Menu.Item>First</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                      <Menu.Portal to={frameBody}>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Item>Child</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                    <Menu.Item>Last</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );
      try {
        const input = screen.getByRole('searchbox');
        await waitFor(() => expect(input).toHaveFocus());
        await user.keyboard('[ArrowRight][ArrowRight]');
        const trigger = screen.getByRole('menuitem', { name: 'More' });
        expect(input).toHaveAttribute('aria-activedescendant', trigger.id);
        const child = await waitForLaterMillisecond(async () => {
          await user.keyboard('[ArrowDown]');
          return within(frameBody).findByRole('menuitem', { name: 'Child' });
        });
        await waitFor(() => expect(frameBody.ownerDocument.activeElement).toBe(child));
        // A consumer can supply another ID in the trigger slot.
        trigger.setAttribute('aria-controls', 'custom');
        await fireEvent.keyDown(child, { key: 'ArrowLeft' });
        await waitFor(() => expect(input).toHaveFocus());
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'First' }).id,
        );
        expect(child.isConnected).toBe(false);
      } finally {
        unmount();
      }
    } finally {
      frame.remove();
    }
  });
});
