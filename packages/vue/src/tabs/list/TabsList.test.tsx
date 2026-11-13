import { expect, vi, describe, it, onTestFinished } from 'vitest';
import { defineComponent, KeepAlive } from 'vue';
import { Tabs } from '@vase-ui/vue/tabs';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';

describe('<Tabs.List />', () => {
  const { render } = createRenderer();

  describeConformance(<Tabs.List />, () => ({
    render: (node) => render(<Tabs.Root>{node}</Tabs.Root>),
    refInstanceof: window.HTMLDivElement,
  }));

  describe('accessibility attributes', () => {
    it('sets the aria-selected attribute on the active tab', async () => {
      await render(
        <Tabs.Root defaultValue={1}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={3}>Tab 3</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      const tab1 = screen.getByText('Tab 1');
      const tab2 = screen.getByText('Tab 2');
      const tab3 = screen.getByText('Tab 3');

      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      expect(tab3).toHaveAttribute('aria-selected', 'false');

      tab2.click();
      await flushMicrotasks();

      expect(tab1).toHaveAttribute('aria-selected', 'false');
      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(tab3).toHaveAttribute('aria-selected', 'false');

      tab3.click();
      await flushMicrotasks();

      expect(tab1).toHaveAttribute('aria-selected', 'false');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      expect(tab3).toHaveAttribute('aria-selected', 'true');

      tab1.click();
      await flushMicrotasks();

      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      expect(tab3).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('prop: loopFocus', () => {
    it('does not wrap focus past the first tab when `loopFocus` is false', async () => {
      await render(
        <Tabs.Root value={0}>
          <Tabs.List loopFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab, , lastTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(firstTab, { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(firstTab).toHaveFocus();
      expect(lastTab).not.toHaveFocus();
    });

    it('does not wrap focus past the last tab when `loopFocus` is false', async () => {
      await render(
        <Tabs.Root value={2}>
          <Tabs.List loopFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab, , lastTab] = screen.getAllByRole('tab');
      lastTab.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(lastTab, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(lastTab).toHaveFocus();
      expect(firstTab).not.toHaveFocus();
    });
  });

  describe('keyboard navigation', () => {
    it('moves focus to a tab disabled with the `disabled` prop', async () => {
      await render(
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} disabled />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab, disabledTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(disabledTab).toHaveFocus();
    });

    it('skips a natively disabled tab in a single keypress', async () => {
      await render(
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab
              value={1}
              v-slots={{
                render: ({ props }: { props: Record<string, unknown> }) => (
                  <button {...props} type="button" disabled />
                ),
              }}
            />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab, , lastTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(lastTab).toHaveFocus();

      await fireEvent.keyDown(lastTab, { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(firstTab).toHaveFocus();
    });
  });

  describe('roving focus after tab removal', () => {
    it('moves the tab stop off a hidden successor when the highlighted tab is removed', async () => {
      const TestComponent = defineComponent(
        (props: { showMiddleTab: boolean }) => () => (
          <Tabs.Root defaultValue={0}>
            <Tabs.List>
              <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
              {props.showMiddleTab && <Tabs.Tab value={1}>Tab 1</Tabs.Tab>}
              <Tabs.Tab value={2} hidden>
                Tab 2
              </Tabs.Tab>
              <Tabs.Tab value={3}>Tab 3</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['showMiddleTab'] },
      );

      const { setProps } = await render(<TestComponent showMiddleTab />);

      const selectedTab = screen.getByText('Tab 0');
      selectedTab.focus();
      await flushMicrotasks();
      await fireEvent.keyDown(selectedTab, { key: 'ArrowRight' });
      await flushMicrotasks();

      await setProps({ showMiddleTab: false });

      const tabs = screen.getAllByRole('tab', { hidden: true });
      expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    });

    it('can fall back to a tab that is focusable when disabled', async () => {
      const TestComponent = defineComponent(
        (props: { showSelectedTab: boolean }) => () => (
          <Tabs.Root value={2}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
              {props.showSelectedTab && <Tabs.Tab value={2}>Tab 2</Tabs.Tab>}
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['showSelectedTab'] },
      );

      const { setProps } = await render(<TestComponent showSelectedTab />);

      await setProps({ showSelectedTab: false });

      expect(screen.getByText('Tab 0')).toHaveAttribute('tabindex', '0');
      expect(screen.getByText('Tab 1')).toHaveAttribute('tabindex', '-1');
    });

    it('keeps the tab stop on the selected tab when focus is inside the list', async () => {
      const TestComponent = defineComponent(
        (props: { showFirstTab: boolean }) => () => (
          <Tabs.Root value={2}>
            <Tabs.List>
              {props.showFirstTab && <Tabs.Tab value={0}>Tab 0</Tabs.Tab>}
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
              <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['showFirstTab'] },
      );

      const { setProps } = await render(<TestComponent showFirstTab />);

      const selectedTab = screen.getByText('Tab 2');
      selectedTab.focus();
      await flushMicrotasks();

      await setProps({ showFirstTab: false });

      const [unselectedTab] = screen.getAllByRole('tab');

      expect([unselectedTab.tabIndex, selectedTab.tabIndex]).toEqual([-1, 0]);
    });

    it('keeps tracking a successor through subsequent removals', async () => {
      const TestComponent = defineComponent(
        (props: { showFirstTab: boolean; showSelectedTab: boolean }) => () => (
          <Tabs.Root value={1}>
            <Tabs.List>
              {props.showFirstTab && <Tabs.Tab value={0}>Tab 0</Tabs.Tab>}
              {props.showSelectedTab && <Tabs.Tab value={1}>Tab 1</Tabs.Tab>}
              <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
              <Tabs.Tab value={3}>Tab 3</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['showFirstTab', 'showSelectedTab'] },
      );

      const { setProps } = await render(<TestComponent showFirstTab showSelectedTab />);

      await setProps({ showFirstTab: true, showSelectedTab: false });

      expect(screen.getByText('Tab 2')).toHaveAttribute('tabindex', '0');

      await setProps({ showFirstTab: false, showSelectedTab: false });

      expect(screen.getByText('Tab 2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByText('Tab 3')).toHaveAttribute('tabindex', '-1');
    });
  });

  it('can be named via `aria-label`', async () => {
    await render(
      <Tabs.Root defaultValue={0}>
        <Tabs.List aria-label="string label">
          <Tabs.Tab value={0} />
        </Tabs.List>
      </Tabs.Root>,
    );

    expect(screen.getByRole('tablist')).toHaveAccessibleName('string label');
  });

  it('can be named via `aria-labelledby`', async () => {
    await render(
      <>
        <h3 id="label-id">complex name</h3>
        <Tabs.Root defaultValue={0}>
          <Tabs.List aria-labelledby="label-id">
            <Tabs.Tab value={0} />
          </Tabs.List>
        </Tabs.Root>
      </>,
    );

    expect(screen.getByRole('tablist')).toHaveAccessibleName('complex name');
  });

  describe('size observer', () => {
    function readIndicatorVariable(name: string) {
      return screen.getByTestId('indicator').style.getPropertyValue(`--active-tab-${name}`);
    }

    // The observer calls the indicator in the microtask checkpoint of its own callback. A style
    // write in that checkpoint gives the loop error of the browser, so each step leaves the task.
    async function expectIndicatorVariable(name: string, expected: string) {
      await waitFor(() => expect(readIndicatorVariable(name)).toBe(expected));
      await flushMicrotasks();
    }

    it('makes the indicator measure again when a tab or the list changes its size', async () => {
      const TestComponent = defineComponent(
        (props: { listWidth: number; firstTabWidth: number; insertedTabWidth: number | null }) =>
          () => (
            <Tabs.Root value={1}>
              <Tabs.List style={{ width: `${props.listWidth}px` }}>
                {props.insertedTabWidth !== null && (
                  <Tabs.Tab value={2} style={{ width: `${props.insertedTabWidth}px` }} />
                )}
                <Tabs.Tab value={0} style={{ width: `${props.firstTabWidth}px` }} />
                <Tabs.Tab value={1} style={{ width: '50px' }} />
                <Tabs.Indicator data-testid="indicator" />
              </Tabs.List>
            </Tabs.Root>
          ),
        { props: ['listWidth', 'firstTabWidth', 'insertedTabWidth'] },
      );
      // Each step makes a new object. A change of the object of the first vnode is not a change.
      let sizes: { listWidth: number; firstTabWidth: number; insertedTabWidth: number | null } = {
        listWidth: 200,
        firstTabWidth: 50,
        insertedTabWidth: null,
      };
      const { setProps } = await render(<TestComponent {...sizes} />);

      // The active tab is the last tab. A write of a prop changes the layout and no value that the
      // indicator reads, so only the size observer can tell the indicator.
      await expectIndicatorVariable('left', '50px');
      // The first notification of the observer has come after two frames. A change before it would
      // reach the indicator through that notification, and the case would not test the observer.
      await waitSingleFrame();
      await waitSingleFrame();

      sizes = { ...sizes, firstTabWidth: 60 };
      await setProps(sizes);
      await expectIndicatorVariable('left', '60px');

      sizes = { ...sizes, listWidth: 220 };
      await setProps(sizes);
      await expectIndicatorVariable('right', '110px');

      sizes = { ...sizes, insertedTabWidth: 50 };
      await setProps(sizes);
      await expectIndicatorVariable('left', '110px');

      sizes = { ...sizes, insertedTabWidth: 70 };
      await setProps(sizes);
      await expectIndicatorVariable('left', '130px');
    });
  });

  describe('KeepAlive', () => {
    // A deactivated list has an empty map, so the indicator measures nothing and shows no trace of
    // a call. The case counts the observers instead.
    it('stops the size observer while the list is deactivated and starts it again', async () => {
      const NativeResizeObserver = window.ResizeObserver;
      const observers: { observed: Set<Element>; isDisconnected: boolean }[] = [];
      class RecordedResizeObserver extends NativeResizeObserver {
        record = { observed: new Set<Element>(), isDisconnected: false };

        constructor(callback: ResizeObserverCallback) {
          super(callback);
          observers.push(this.record);
        }

        observe(target: Element, options?: ResizeObserverOptions) {
          this.record.observed.add(target);
          super.observe(target, options);
        }

        disconnect() {
          this.record.isDisconnected = true;
          super.disconnect();
        }
      }
      vi.stubGlobal('ResizeObserver', RecordedResizeObserver);
      onTestFinished(() => {
        vi.unstubAllGlobals();
      });

      const Inner = defineComponent(() => () => (
        <Tabs.Root value={0}>
          <Tabs.List data-testid="list" style={{ width: '200px' }}>
            <Tabs.Tab value={0} style={{ width: '50px' }} />
            <Tabs.Indicator data-testid="indicator" />
          </Tabs.List>
        </Tabs.Root>
      ));
      const Other = defineComponent(() => () => <span />);
      const App = defineComponent(
        (props: { visible: boolean }) => () => (
          <KeepAlive>{props.visible ? <Inner /> : <Other />}</KeepAlive>
        ),
        { props: ['visible'] },
      );
      const { setProps } = await render(<App visible />);
      const list = screen.getByTestId('list');
      const tab = screen.getByRole('tab');
      const indicator = screen.getByTestId('indicator');
      const readRunning = () => observers.filter((observer) => !observer.isDisconnected);

      expect(readRunning().map((observer) => [...observer.observed])).toEqual([[list, tab]]);

      await setProps({ visible: false });

      expect(readRunning()).toEqual([]);

      await setProps({ visible: true });

      expect(readRunning().map((observer) => [...observer.observed])).toEqual([[list, tab]]);

      tab.style.width = '60px';

      await waitFor(() =>
        expect(indicator.style.getPropertyValue('--active-tab-width')).toBe('60px'),
      );
    });
  });

  describe('props that change', () => {
    it('follows a change of `activateOnFocus` and of `loopFocus`', async () => {
      const TestComponent = defineComponent(
        (props: { activateOnFocus: boolean; loopFocus: boolean }) => () => (
          <Tabs.Root defaultValue={0}>
            <Tabs.List activateOnFocus={props.activateOnFocus} loopFocus={props.loopFocus}>
              <Tabs.Tab value={0} />
              <Tabs.Tab value={1} />
              <Tabs.Tab value={2} />
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['activateOnFocus', 'loopFocus'] },
      );
      const { setProps } = await render(<TestComponent activateOnFocus={false} loopFocus />);
      const [firstTab, secondTab, thirdTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await fireEvent.keyDown(firstTab, { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(thirdTab).toHaveFocus();
      expect(thirdTab).toHaveAttribute('aria-selected', 'false');

      await setProps({ activateOnFocus: true, loopFocus: false });
      await fireEvent.keyDown(thirdTab, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(thirdTab).toHaveFocus();

      await fireEvent.keyDown(thirdTab, { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(secondTab).toHaveFocus();
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  // Last in the file: after a recursion error, Vue runs no post-flush job of a later case.
  describe('highlighted index', () => {
    it.each([
      {
        name: 'hidden',
        tabs: () => (
          <Tabs.Root value={0}>
            <Tabs.List>
              <Tabs.Tab value={0} hidden />
              <Tabs.Tab value={1} />
              <Tabs.Tab value={2} />
            </Tabs.List>
          </Tabs.Root>
        ),
        tabStops: [0, -1, -1],
      },
      {
        name: 'natively disabled',
        tabs: () => (
          <Tabs.Root value={0}>
            <Tabs.List>
              <Tabs.Tab
                value={0}
                v-slots={{
                  render: ({ props }: { props: Record<string, unknown> }) => (
                    <button {...props} type="button" disabled />
                  ),
                }}
              />
              <Tabs.Tab value={1} />
            </Tabs.List>
          </Tabs.Root>
        ),
        tabStops: [0, -1],
      },
      {
        name: 'hidden, selected by the root',
        tabs: () => (
          <Tabs.Root>
            <Tabs.List>
              <Tabs.Tab value="a" hidden />
              <Tabs.Tab value="b" />
            </Tabs.List>
          </Tabs.Root>
        ),
        tabStops: [0, -1],
      },
    ])(
      'mounts and keeps the tab stop on a selected tab that is $name',
      async ({ tabs, tabStops }) => {
        await render(tabs);

        const tabElements = screen.getAllByRole('tab', { hidden: true });
        expect(tabElements[0]).toHaveAttribute('aria-selected', 'true');
        expect(tabElements.map((tab) => tab.tabIndex)).toEqual(tabStops);
      },
    );
  });
});
