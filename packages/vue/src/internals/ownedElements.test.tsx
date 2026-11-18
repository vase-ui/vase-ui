import { describe, expect, it } from 'vitest';
import { KeepAlive, shallowRef, Teleport } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Menu } from '@vase-ui/vue/menu';
import { Slider } from '@vase-ui/vue/slider';
import { TimeClock } from '@vase-ui/vue/time-clock';
import { TimePicker } from '@vase-ui/vue/time-picker';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  isVaporApp,
  screen,
  waitFor,
  waitForLaterMillisecond,
  within,
} from '#test-utils';
import VaporConsumer from '../../test/conformanceTests/VaporConsumer.vue';
import FloatingPortalLite from '../utils/popups/portal/FloatingPortalLite.vue';
import { getNestedPortals, isPortalOfPart } from '../utils/popups/portal/portalElements';
import CompositeItem from '../../test/fixtures/CompositeItemPart.vue';
import CompositeRoot from '../../test/fixtures/CompositeRootPart.vue';
import SliderInputPortal from '../../test/fixtures/SliderInputPortal.vue';

describe('owned parts', () => {
  const { render } = createRenderer();

  it('keeps one tab stop when the active item moves and another item takes its index', async () => {
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

  it('focuses the thumb input across a portal and releases it while the thumb is held', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const shown = shallowRef(true);
    try {
      const { user, unmount } = await render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Label>Volume</Slider.Label>
          <Slider.Control data-testid="track">
            <input type="range" aria-label="Other" />
            <KeepAlive>{shown.value ? <SliderInputPortal target={target} /> : null}</KeepAlive>
          </Slider.Control>
          <button>Outside</button>
        </Slider.Root>
      ));
      try {
        const input = within(target).getByRole('slider');
        const outside = screen.getByRole('button', { name: 'Outside' });
        const label = screen.getByText('Volume');
        within(target).getByText('Before input').focus();
        await user.tab();
        expect(input).toHaveFocus();
        await user.tab();
        expect(within(target).getByText('After input')).toHaveFocus();
        await fireEvent.click(label);
        expect(input).toHaveFocus();
        outside.focus();
        await fireEvent.pointerDown(screen.getByTestId('track'), {
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
          buttons: 1,
          clientX: 10,
        });
        await waitFor(() => expect(input).toHaveFocus());
        await fireEvent.pointerUp(screen.getByTestId('track'), { pointerId: 1 });

        shown.value = false;
        await flushMicrotasks();
        outside.focus();
        await fireEvent.click(label);
        expect(outside).toHaveFocus();
        shown.value = true;
        await flushMicrotasks();
        await fireEvent.click(label);
        expect(input).toHaveFocus();
      } finally {
        unmount();
      }
    } finally {
      target.remove();
    }
  });

  it.runIf(isVaporApp)(
    'focuses a thumb that a Vapor consumer renders in another portal',
    async () => {
      const { user } = await render(
        <Slider.Root defaultValue={50}>
          <Slider.Label>Volume</Slider.Label>
          <Slider.Control>
            <input type="range" aria-label="Other" />
            <Teleport to="body">
              <VaporConsumer
                part={Slider.Thumb}
                tag="span"
                form="render"
                partProps={{}}
                onPart={() => undefined}
              />
            </Teleport>
          </Slider.Control>
        </Slider.Root>,
      );
      await user.click(screen.getByText('Volume'));
      expect(screen.getByRole('slider', { name: 'Volume' })).toHaveFocus();
    },
  );

  it('finds the nearest portal after a part moves through a shadow root', async () => {
    const innerTarget = shallowRef<ShadowRoot | null>(null);
    await render(() => (
      <>
        <FloatingPortalLite data-testid="outer">
          <div data-testid="host" />
        </FloatingPortalLite>
        <FloatingPortalLite container={innerTarget.value} data-testid="inner">
          <button>Content</button>
        </FloatingPortalLite>
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
    await waitFor(() => expect(popup).not.toBeInTheDocument());
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

  it('returns the submenu key to its trigger across documents', async () => {
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
                      <Menu.Portal container={frameBody}>
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
