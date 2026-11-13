import { expect, vi, describe, it } from 'vitest';
import { defineComponent, KeepAlive, onScopeDispose } from 'vue';
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
import { useTabsListContext } from './TabsListContext';

// An indicator of a later part registers its listener in this way.
const IndicatorListener = defineComponent(
  (props: { listener: () => void }) => {
    onScopeDispose(useTabsListContext().registerIndicatorUpdateListener(props.listener));
    return () => null;
  },
  { props: ['listener'] },
);

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
    it('calls the listeners when a tab or the list changes its size', async () => {
      const listener = vi.fn();
      const TestComponent = defineComponent(
        (props: { showSecondTab: boolean }) => () => (
          <Tabs.Root value={0}>
            <Tabs.List data-testid="list" style={{ width: '200px' }}>
              <Tabs.Tab value={0} style={{ width: '50px' }} />
              {props.showSecondTab && <Tabs.Tab value={1} style={{ width: '50px' }} />}
              <IndicatorListener listener={listener} />
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['showSecondTab'] },
      );
      const { setProps } = await render(<TestComponent showSecondTab={false} />);

      async function expectListenerCall(action: () => void | Promise<void>) {
        const callCount = listener.mock.calls.length;
        await action();
        await waitFor(() => expect(listener.mock.calls.length).toBeGreaterThan(callCount));
      }

      // The observer reports each element one time when it starts.
      await waitFor(() => expect(listener).toHaveBeenCalled());
      await expectListenerCall(() => {
        screen.getAllByRole('tab')[0].style.width = '60px';
      });
      await expectListenerCall(() => {
        screen.getByTestId('list').style.width = '220px';
      });
      await expectListenerCall(() => setProps({ showSecondTab: true }));
      await expectListenerCall(() => {
        screen.getAllByRole('tab')[1].style.width = '60px';
      });
    });
  });

  describe('KeepAlive', () => {
    it('stops the size observer while the list is deactivated and starts it again', async () => {
      const listener = vi.fn();
      const Inner = defineComponent(() => () => (
        <Tabs.Root value={0}>
          <Tabs.List style={{ width: '200px' }}>
            <Tabs.Tab value={0} style={{ width: '50px' }} />
            <IndicatorListener listener={listener} />
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
      await waitFor(() => expect(listener).toHaveBeenCalled());
      const tab = screen.getByRole('tab');

      await setProps({ visible: false });
      listener.mockClear();
      // An observer that still runs reports the element that left the document in a frame.
      await waitSingleFrame();
      await waitSingleFrame();

      expect(listener).not.toHaveBeenCalled();

      await setProps({ visible: true });
      listener.mockClear();
      tab.style.width = '60px';

      await waitFor(() => expect(listener).toHaveBeenCalled());
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
});
