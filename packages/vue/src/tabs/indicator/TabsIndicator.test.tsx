import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import type { CSSProperties } from 'vue';
import { Tabs } from '@vase-ui/vue/tabs';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { getCssDimensions } from '../../utils/getCssDimensions';
import { script as generatedPrehydrationScript } from './prehydrationScript.min';
import TabsIndicatorHydration from './TabsIndicatorHydration.test.vue';

type RenderSlotProps = { props: Record<string, unknown> };

const HYDRATION_FIXTURE = 'src/tabs/indicator/TabsIndicatorHydration.test.vue';

describe('<Tabs.Indicator />', () => {
  const { render } = createRenderer();

  describeConformance(<Tabs.Indicator />, () => ({
    render: (node) => {
      return render(
        <Tabs.Root defaultValue={1}>
          <Tabs.List>
            <Tabs.Tab value={1} />
            {node}
          </Tabs.List>
        </Tabs.Root>,
      );
    },
    refInstanceof: window.HTMLSpanElement,
    testRenderPropWith: 'div',
  }));

  it('exposes null active tab state when the selected value has no matching tab', async () => {
    const indicatorStates: Tabs.Indicator.State[] = [];

    await render(
      <Tabs.Root value="missing">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Indicator
            v-slots={{
              render: ({ props, state }: RenderSlotProps & { state: Tabs.Indicator.State }) => {
                indicatorStates.push(state);
                return <span data-testid="bubble" {...props} />;
              },
            }}
          />
        </Tabs.List>
      </Tabs.Root>,
    );

    // Wait for Tabs.List to register its element; before that no tab can be measured.
    await flushMicrotasks();

    const state = indicatorStates.at(-1)!;
    expect(state.activeTabPosition).toBe(null);
    expect(state.activeTabSize).toBe(null);
    expect(screen.getByTestId('bubble')).toHaveAttribute('hidden');
  });

  describe.skipIf(isJSDOM)('rendering', () => {
    it('should not render when no tab is active', async () => {
      await render(
        <Tabs.Root value={null}>
          <Tabs.List>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.queryByTestId('bubble')).toBe(null);
    });

    function expectSize(actual: string, expected: number) {
      const actualNumber = parseFloat(actual);
      expect(Math.abs(actualNumber - expected)).toBeLessThanOrEqual(0.01);
    }

    function expectBubblePositionVariables(
      bubble: HTMLElement,
      tabList: HTMLElement,
      activeTab: HTMLElement,
    ) {
      const tabRect = activeTab.getBoundingClientRect();
      const tabListRect = tabList.getBoundingClientRect();
      const { width: tabWidth, height: tabHeight } = getCssDimensions(activeTab);
      const { width: tabListWidth, height: tabListHeight } = getCssDimensions(tabList);
      const scaleX = tabListWidth > 0 ? tabListRect.width / tabListWidth : 1;
      const scaleY = tabListHeight > 0 ? tabListRect.height / tabListHeight : 1;

      const relativeLeft =
        (tabRect.left - tabListRect.left) / scaleX + tabList.scrollLeft - tabList.clientLeft;
      const relativeTop =
        (tabRect.top - tabListRect.top) / scaleY + tabList.scrollTop - tabList.clientTop;
      const relativeRight = tabList.scrollWidth - relativeLeft - tabWidth;
      const relativeBottom = tabList.scrollHeight - relativeTop - tabHeight;

      const bubbleComputedStyle = window.getComputedStyle(bubble);
      const actualLeft = bubbleComputedStyle.getPropertyValue('--active-tab-left');
      const actualRight = bubbleComputedStyle.getPropertyValue('--active-tab-right');
      const actualTop = bubbleComputedStyle.getPropertyValue('--active-tab-top');
      const actualBottom = bubbleComputedStyle.getPropertyValue('--active-tab-bottom');
      const actualWidth = bubbleComputedStyle.getPropertyValue('--active-tab-width');
      const actualHeight = bubbleComputedStyle.getPropertyValue('--active-tab-height');

      expectSize(actualLeft, relativeLeft);
      expectSize(actualRight, relativeRight);
      expectSize(actualTop, relativeTop);
      expectSize(actualBottom, relativeBottom);
      expectSize(actualWidth, tabWidth);
      expectSize(actualHeight, tabHeight);
    }

    // Styles that turn the indicator into a box laid over the active tab using the CSS
    // variables it exposes — mirrors how consumers position it (see the demos).
    const STYLED_INDICATOR_CSS = `
      [data-testid="bubble"] {
        position: absolute;
        top: 0;
        left: 0;
        width: var(--active-tab-width);
        height: var(--active-tab-height);
        transform: translate(var(--active-tab-left), var(--active-tab-top));
      }
    `;

    // Activates the last tab on purpose: its offset is non-zero, so if the rect-based path
    // were (wrongly) used under rotation the indicator would land visibly off. The first
    // tab sits at (0, 0) and would be matched even by the buggy math.
    function renderTransformedTabs(
      wrapperStyle: CSSProperties,
      tabsListStyle: CSSProperties = { display: 'flex', position: 'relative' },
    ) {
      return render(
        <>
          <style>{STYLED_INDICATOR_CSS}</style>
          <div style={wrapperStyle}>
            <Tabs.Root value={3}>
              <Tabs.List style={tabsListStyle}>
                <Tabs.Tab value={1} style={{ width: '80px', height: '32px' }}>
                  One
                </Tabs.Tab>
                <Tabs.Tab value={2} style={{ width: '80px', height: '32px' }}>
                  Two
                </Tabs.Tab>
                <Tabs.Tab value={3} style={{ width: '80px', height: '32px' }}>
                  Three
                </Tabs.Tab>
                <Tabs.Indicator data-testid="bubble" />
              </Tabs.List>
            </Tabs.Root>
          </div>
        </>,
      );
    }

    function waitForEdgesToMatch(
      edge: 'left' | 'top' | 'right' | 'bottom',
      bubble: HTMLElement,
      activeTab: HTMLElement,
    ) {
      return waitFor(() => {
        const bubbleRect = bubble.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        expect(Math.abs(bubbleRect[edge] - tabRect[edge])).toBeLessThanOrEqual(1);
      });
    }

    // Waits until the rendered indicator's box coincides with the active tab's box.
    // Both share the ancestor transform, so when the indicator is positioned correctly
    // their on-screen rects coincide — regardless of the transform.
    async function waitForBubbleToOverlapActiveTab(bubble: HTMLElement, activeTab: HTMLElement) {
      await waitForEdgesToMatch('left', bubble, activeTab);
      await waitForEdgesToMatch('top', bubble, activeTab);
      await waitForEdgesToMatch('right', bubble, activeTab);
      await waitForEdgesToMatch('bottom', bubble, activeTab);
    }

    it('should set CSS variables corresponding to the active tab', async () => {
      await render(
        <Tabs.Root value={2}>
          <Tabs.List>
            <Tabs.Tab value={1}>One</Tabs.Tab>
            <Tabs.Tab value={2}>Two</Tabs.Tab>
            <Tabs.Tab value={3}>Three</Tabs.Tab>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );

      const bubble = screen.getByTestId('bubble');
      const tabs = screen.getAllByRole('tab');
      const activeTab = tabs[1];
      const tabList = screen.getByRole('tablist');

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('should update the position and movement variables when the active tab changes', async () => {
      const { setProps } = await render(
        <Tabs.Root value={2}>
          <Tabs.List>
            <Tabs.Tab value={1}>One</Tabs.Tab>
            <Tabs.Tab value={2}>Two</Tabs.Tab>
            <Tabs.Tab value={3}>Three</Tabs.Tab>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );

      await setProps({ value: 3 });

      const bubble = screen.getByTestId('bubble');
      const tabs = screen.getAllByRole('tab');
      let activeTab = tabs[2];
      const tabList = screen.getByRole('tablist');

      expectBubblePositionVariables(bubble, tabList, activeTab);

      await setProps({ value: 1 });
      activeTab = tabs[0];
      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('should update the position variables when the tab list is resized', async () => {
      const { setProps } = await render(
        <Tabs.Root value={1} style={{ width: '400px' }}>
          <Tabs.List style={{ display: 'flex' }}>
            <Tabs.Tab value={1} style={{ flex: '1 1 auto' }}>
              One
            </Tabs.Tab>
            <Tabs.Tab value={2} style={{ flex: '1 1 auto' }}>
              Two
            </Tabs.Tab>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );

      const bubble = screen.getByTestId('bubble');
      const tabs = screen.getAllByRole('tab');
      const activeTab = tabs[0];
      const tabList = screen.getByRole('tablist');

      expectBubblePositionVariables(bubble, tabList, activeTab);

      await setProps({
        style: { width: '800px' },
      });

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('should account for scroll and border when the tab list is transformed', async () => {
      await render(
        <div style={{ transform: 'scale(1.5)' }}>
          <Tabs.Root value={3}>
            <Tabs.List
              data-testid="tab-list"
              style={{
                width: '240px',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                border: '6px solid black',
                padding: '4px',
              }}
            >
              <Tabs.Tab value={1} style={{ flex: '0 0 120px' }}>
                One
              </Tabs.Tab>
              <Tabs.Tab value={2} style={{ flex: '0 0 120px' }}>
                Two
              </Tabs.Tab>
              <Tabs.Tab value={3} style={{ flex: '0 0 120px' }}>
                Three
              </Tabs.Tab>
              <Tabs.Tab value={4} style={{ flex: '0 0 120px' }}>
                Four
              </Tabs.Tab>
              <Tabs.Tab value={5} style={{ flex: '0 0 120px' }}>
                Five
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        </div>,
      );

      const bubble = screen.getByTestId('bubble');
      const tabList = screen.getByTestId('tab-list');
      const activeTab = screen.getAllByRole('tab')[2];

      tabList.scrollLeft = 80;

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('accounts for a scrolled container between the tab list and the active tab', async () => {
      await render(
        <>
          <style>{STYLED_INDICATOR_CSS}</style>
          <Tabs.Root value={3}>
            <Tabs.List style={{ display: 'flex', position: 'relative' }}>
              {/* 240px of tabs inside a 200px viewport, so the container scrolls by 40px. */}
              <div
                data-testid="scroller"
                style={{ display: 'flex', width: '200px', overflowX: 'auto' }}
              >
                <Tabs.Tab value={1} style={{ width: '80px', height: '32px', flexShrink: 0 }}>
                  One
                </Tabs.Tab>
                <Tabs.Tab value={2} style={{ width: '80px', height: '32px', flexShrink: 0 }}>
                  Two
                </Tabs.Tab>
                <Tabs.Tab value={3} style={{ width: '80px', height: '32px', flexShrink: 0 }}>
                  Three
                </Tabs.Tab>
              </div>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        </>,
      );

      const scroller = screen.getByTestId('scroller');
      const bubble = screen.getByTestId('bubble');
      const activeTab = screen.getAllByRole('tab')[2];

      scroller.scrollLeft = 40;
      // Scrolling on its own doesn't notify the indicator — only tab resizes do — so nudge the
      // active tab to flush the scrolled position through a recomputation.
      activeTab.style.width = '84px';

      await waitForBubbleToOverlapActiveTab(bubble, activeTab);
    });

    it('overlays the active tab when an ancestor has a 2D rotation', async () => {
      await renderTransformedTabs({ transform: 'rotate(40deg)' });

      const bubble = screen.getByTestId('bubble');
      const activeTab = screen.getAllByRole('tab')[2];

      await waitForBubbleToOverlapActiveTab(bubble, activeTab);
      expect(bubble).not.toHaveAttribute('hidden');
    });

    it('overlays the active tab when an ancestor has a size-preserving flip', async () => {
      await renderTransformedTabs({ transform: 'scaleX(-1)' });

      const bubble = screen.getByTestId('bubble');
      const activeTab = screen.getAllByRole('tab')[2];

      await waitForBubbleToOverlapActiveTab(bubble, activeTab);
      expect(bubble).not.toHaveAttribute('hidden');
    });

    it('sets transformed offsets relative to the tab list when the list is not the offset parent', async () => {
      await renderTransformedTabs(
        { position: 'relative', transform: 'rotate(40deg)' },
        { display: 'flex', marginLeft: '40px' },
      );

      const bubble = screen.getByTestId('bubble');

      await waitFor(() => {
        const bubbleComputedStyle = window.getComputedStyle(bubble);
        expectSize(bubbleComputedStyle.getPropertyValue('--active-tab-left'), 160);
      });
      await waitFor(() => {
        const bubbleComputedStyle = window.getComputedStyle(bubble);
        expectSize(bubbleComputedStyle.getPropertyValue('--active-tab-top'), 0);
      });
    });

    it('overlays the active tab when an ancestor uses the rotate longhand', async () => {
      await renderTransformedTabs({ rotate: '40deg' });

      const bubble = screen.getByTestId('bubble');
      const activeTab = screen.getAllByRole('tab')[2];

      await waitForBubbleToOverlapActiveTab(bubble, activeTab);
      expect(bubble).not.toHaveAttribute('hidden');
    });

    it('overlays the active tab when an ancestor uses a flipping scale longhand', async () => {
      await renderTransformedTabs({ scale: '-1 1' });

      const bubble = screen.getByTestId('bubble');
      const activeTab = screen.getAllByRole('tab')[2];

      await waitForBubbleToOverlapActiveTab(bubble, activeTab);
      expect(bubble).not.toHaveAttribute('hidden');
    });

    it('overlays the active tab when an ancestor has a 3D rotation (#4837)', async () => {
      await renderTransformedTabs({ transform: 'perspective(600px) rotateY(35deg)' });

      const bubble = screen.getByTestId('bubble');
      const activeTab = screen.getAllByRole('tab')[2];

      await waitForBubbleToOverlapActiveTab(bubble, activeTab);
      expect(bubble).not.toHaveAttribute('hidden');
    });

    it('follows the active tab when it has its own transform translation', async () => {
      await render(
        <>
          <style>{STYLED_INDICATOR_CSS}</style>
          <Tabs.Root value={3}>
            <Tabs.List style={{ display: 'flex', position: 'relative' }}>
              <Tabs.Tab value={1} style={{ width: '80px', height: '32px' }}>
                One
              </Tabs.Tab>
              <Tabs.Tab value={2} style={{ width: '80px', height: '32px' }}>
                Two
              </Tabs.Tab>
              <Tabs.Tab
                value={3}
                style={{
                  width: '80px',
                  height: '32px',
                  transform: 'translateX(12px) translateY(4px)',
                }}
              >
                Three
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        </>,
      );

      const bubble = screen.getByTestId('bubble');
      const activeTab = screen.getAllByRole('tab')[2];

      await waitForBubbleToOverlapActiveTab(bubble, activeTab);
    });

    it('follows the active tab when it uses the translate longhand', async () => {
      await render(
        <>
          <style>{STYLED_INDICATOR_CSS}</style>
          <Tabs.Root value={3}>
            <Tabs.List style={{ display: 'flex', position: 'relative' }}>
              <Tabs.Tab value={1} style={{ width: '80px', height: '32px' }}>
                One
              </Tabs.Tab>
              <Tabs.Tab value={2} style={{ width: '80px', height: '32px' }}>
                Two
              </Tabs.Tab>
              <Tabs.Tab value={3} style={{ width: '80px', height: '32px', translate: '12px 4px' }}>
                Three
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        </>,
      );

      const bubble = screen.getByTestId('bubble');
      const activeTab = screen.getAllByRole('tab')[2];

      await waitForBubbleToOverlapActiveTab(bubble, activeTab);
    });

    it('follows the active tab when the translate longhand uses percentages', async () => {
      await render(
        <>
          <style>{STYLED_INDICATOR_CSS}</style>
          <Tabs.Root value={3}>
            <Tabs.List style={{ display: 'flex', position: 'relative' }}>
              <Tabs.Tab value={1} style={{ width: '80px', height: '32px' }}>
                One
              </Tabs.Tab>
              <Tabs.Tab value={2} style={{ width: '80px', height: '32px' }}>
                Two
              </Tabs.Tab>
              {/* 50% of 80px = 40px across, 25% of 32px = 8px down. */}
              <Tabs.Tab value={3} style={{ width: '80px', height: '32px', translate: '50% 25%' }}>
                Three
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        </>,
      );

      const bubble = screen.getByTestId('bubble');
      const activeTab = screen.getAllByRole('tab')[2];

      await waitForBubbleToOverlapActiveTab(bubble, activeTab);
    });

    it('updates position when a different tab resizes', async () => {
      await render(
        <Tabs.Root value={2}>
          <Tabs.List
            data-testid="tab-list"
            style={{ width: '300px', display: 'flex', overflow: 'hidden' }}
          >
            <Tabs.Tab data-testid="first-tab" value={1} style={{ width: '100px', flexShrink: 0 }}>
              One
            </Tabs.Tab>
            <Tabs.Tab value={2} style={{ width: '100px', flexShrink: 0 }}>
              Two
            </Tabs.Tab>
            <Tabs.Tab value={3} style={{ width: '100px', flexShrink: 0 }}>
              Three
            </Tabs.Tab>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );

      const bubble = screen.getByTestId('bubble');
      const tabList = screen.getByTestId('tab-list');
      const firstTab = screen.getByTestId('first-tab');
      const activeTab = screen.getAllByRole('tab')[1];

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, activeTab);
      });

      firstTab.setAttribute('style', 'width: 140px; flex-shrink: 0;');

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('keeps observing a tab whose rendered element type changes', async () => {
      const anchorSlots = {
        render: ({ props }: RenderSlotProps) => (
          <a {...props} href="#one">
            One
          </a>
        ),
      };
      const textSlots = { default: () => 'One' };
      const TestTabs = defineComponent(
        (props: { asAnchor: boolean }) => () => (
          <Tabs.Root value={2}>
            <Tabs.List
              data-testid="tab-list"
              style={{ width: '300px', display: 'flex', overflow: 'hidden' }}
            >
              <Tabs.Tab
                data-testid="first-tab"
                value={1}
                nativeButton={!props.asAnchor}
                v-slots={props.asAnchor ? anchorSlots : textSlots}
                style={{ width: '100px', flexShrink: 0 }}
              />
              <Tabs.Tab value={2} style={{ width: '100px', flexShrink: 0 }}>
                Two
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['asAnchor'] },
      );

      const { setProps } = await render(<TestTabs asAnchor={false} />);

      const bubble = screen.getByTestId('bubble');
      const tabList = screen.getByTestId('tab-list');
      const activeTab = screen.getAllByRole('tab')[1];

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, activeTab);
      });

      await setProps({ asAnchor: true });

      const swappedTab = screen.getByTestId('first-tab');
      expect(swappedTab.tagName).toBe('A');

      // Drain the resize entries the swap itself produces (the replaced element
      // collapses to 0x0), so the assertion below can only be satisfied by the
      // observer having followed the tab to its new element.
      await waitSingleFrame();
      await waitSingleFrame();

      swappedTab.setAttribute('style', 'width: 160px; flex-shrink: 0;');

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('falls back to offset positions when the tab list is scaled to zero', async () => {
      await render(
        <div style={{ transform: 'scale(0)' }}>
          <Tabs.Root value={2}>
            <Tabs.List
              data-testid="tab-list"
              style={{
                position: 'relative',
                width: '300px',
                display: 'flex',
                overflow: 'hidden',
              }}
            >
              <Tabs.Tab value={1} style={{ width: '100px', flexShrink: 0 }}>
                One
              </Tabs.Tab>
              <Tabs.Tab value={2} style={{ width: '100px', flexShrink: 0 }}>
                Two
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        </div>,
      );

      const bubble = screen.getByTestId('bubble');
      const activeTab = screen.getAllByRole('tab')[1];

      // The collapsed bounding rects can't be divided by, so the indicator uses
      // the untransformed offsets instead of producing `NaN` positions.
      await waitFor(() => {
        const bubbleComputedStyle = window.getComputedStyle(bubble);
        expectSize(bubbleComputedStyle.getPropertyValue('--active-tab-left'), activeTab.offsetLeft);
      });

      const bubbleComputedStyle = window.getComputedStyle(bubble);
      expectSize(bubbleComputedStyle.getPropertyValue('--active-tab-top'), activeTab.offsetTop);
      expectSize(bubbleComputedStyle.getPropertyValue('--active-tab-width'), 100);
      expect(bubble).not.toHaveAttribute('hidden');
    });

    it('updates position when a new tab is inserted and then resized', async () => {
      const TestTabs = defineComponent(
        (props: { insertedTabWidth: number | null }) => () => (
          <Tabs.Root value={2}>
            <Tabs.List
              data-testid="tab-list"
              style={{ width: '320px', display: 'flex', overflow: 'hidden' }}
            >
              {props.insertedTabWidth != null && (
                <Tabs.Tab
                  data-testid="inserted-tab"
                  value={0}
                  style={{ width: `${props.insertedTabWidth}px`, flexShrink: 0 }}
                >
                  Inserted
                </Tabs.Tab>
              )}
              <Tabs.Tab value={1} style={{ width: '100px', flexShrink: 0 }}>
                One
              </Tabs.Tab>
              <Tabs.Tab value={2} style={{ width: '100px', flexShrink: 0 }}>
                Two
              </Tabs.Tab>
              <Tabs.Tab value={3} style={{ width: '100px', flexShrink: 0 }}>
                Three
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['insertedTabWidth'] },
      );

      const { setProps } = await render(<TestTabs insertedTabWidth={null} />);

      const bubble = screen.getByTestId('bubble');
      const tabList = screen.getByTestId('tab-list');

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, screen.getByRole('tab', { selected: true }));
      });

      await setProps({ insertedTabWidth: 60 });

      const insertedTab = screen.getByTestId('inserted-tab');

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, screen.getByRole('tab', { selected: true }));
      });

      insertedTab.setAttribute('style', 'width: 120px; flex-shrink: 0;');

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, screen.getByRole('tab', { selected: true }));
      });
    });

    it('updates all indicators when a different tab resizes', async () => {
      await render(
        <Tabs.Root value={2}>
          <Tabs.List
            data-testid="tab-list"
            style={{ width: '300px', display: 'flex', overflow: 'hidden' }}
          >
            <Tabs.Tab data-testid="first-tab" value={1} style={{ width: '100px', flexShrink: 0 }}>
              One
            </Tabs.Tab>
            <Tabs.Tab value={2} style={{ width: '100px', flexShrink: 0 }}>
              Two
            </Tabs.Tab>
            <Tabs.Tab value={3} style={{ width: '100px', flexShrink: 0 }}>
              Three
            </Tabs.Tab>
            <Tabs.Indicator data-testid="bubble-1" />
            <Tabs.Indicator data-testid="bubble-2" />
          </Tabs.List>
        </Tabs.Root>,
      );

      const bubble1 = screen.getByTestId('bubble-1');
      const bubble2 = screen.getByTestId('bubble-2');
      const tabList = screen.getByTestId('tab-list');
      const firstTab = screen.getByTestId('first-tab');
      const activeTab = screen.getAllByRole('tab')[1];

      await waitFor(() => {
        expectBubblePositionVariables(bubble1, tabList, activeTab);
      });
      await waitFor(() => {
        expectBubblePositionVariables(bubble2, tabList, activeTab);
      });

      firstTab.setAttribute('style', 'width: 140px; flex-shrink: 0;');

      await waitFor(() => {
        expectBubblePositionVariables(bubble1, tabList, activeTab);
      });
      await waitFor(() => {
        expectBubblePositionVariables(bubble2, tabList, activeTab);
      });
    });

    it('measures again when the orientation changes with no change of size', async () => {
      const TestTabs = defineComponent(
        (props: { orientation: Tabs.Root.Orientation }) => () => (
          <Tabs.Root value={1} orientation={props.orientation}>
            <Tabs.List
              style={{
                display: 'flex',
                flexDirection: props.orientation === 'vertical' ? 'column' : 'row',
                width: '200px',
                height: '200px',
              }}
            >
              <Tabs.Tab value={0} style={{ width: '50px', height: '40px', flexShrink: 0 }}>
                One
              </Tabs.Tab>
              <Tabs.Tab value={1} style={{ width: '50px', height: '40px', flexShrink: 0 }}>
                Two
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        ),
        { props: ['orientation'] },
      );
      const { setProps } = await render(<TestTabs orientation="horizontal" />);
      const bubble = screen.getByTestId('bubble');

      await waitFor(() => {
        expect(bubble.style.getPropertyValue('--active-tab-left')).toBe('50px');
      });
      expect(bubble.style.getPropertyValue('--active-tab-top')).toBe('0px');
      // The first notification of the observers has come after two frames. A change before it
      // would reach the indicator through that notification.
      await waitSingleFrame();
      await waitSingleFrame();

      // The tabs and the list keep their sizes, so no observer reports the change.
      await setProps({ orientation: 'vertical' });

      await waitFor(() => {
        expect(bubble.style.getPropertyValue('--active-tab-top')).toBe('40px');
      });
      expect(bubble.style.getPropertyValue('--active-tab-left')).toBe('0px');
    });

    it('perf: single tab resize does not fan out excessive indicator rerenders', async () => {
      const renderIndicatorSpy = vi.fn();

      // The part calls its `#render` slot in each render, so the calls count the renders.
      await render(
        <Tabs.Root value={50}>
          <Tabs.List
            data-testid="tab-list"
            style={{ width: '1200px', display: 'flex', overflow: 'hidden' }}
          >
            {Array.from({ length: 100 }, (_, i) => (
              <Tabs.Tab
                data-testid={`tab-${i + 1}`}
                key={i}
                value={i + 1}
                style={{ width: '120px', flexShrink: 0 }}
              >
                {i + 1}
              </Tabs.Tab>
            ))}
            <Tabs.Indicator
              data-testid="bubble"
              v-slots={{
                render: ({ props }: RenderSlotProps) => {
                  renderIndicatorSpy();
                  return <span {...props} />;
                },
              }}
            />
          </Tabs.List>
        </Tabs.Root>,
      );

      const bubble = screen.getByTestId('bubble');
      const tabList = screen.getByTestId('tab-list');

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, screen.getByRole('tab', { selected: true }));
      });

      const firstTab = screen.getByTestId('tab-1');
      const initialRenderCount = renderIndicatorSpy.mock.calls.length;
      firstTab.setAttribute('style', 'width: 180px; flex-shrink: 0;');

      await waitFor(() => {
        expectBubblePositionVariables(bubble, tabList, screen.getByRole('tab', { selected: true }));
      });

      expect(renderIndicatorSpy.mock.calls.length - initialRenderCount).toBeLessThan(5);
    });
  });

  describe('state attributes', () => {
    function readDataAttributes(element: Element) {
      return Object.fromEntries(
        element
          .getAttributeNames()
          .filter((name) => name.startsWith('data-'))
          .map((name) => [name, element.getAttribute(name)]),
      );
    }

    it('sets the orientation and the activation direction, and no attribute for the position or the size', async () => {
      const { setProps } = await render(
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} style={{ width: '80px' }}>
              One
            </Tabs.Tab>
            <Tabs.Tab value={1} style={{ width: '80px' }}>
              Two
            </Tabs.Tab>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );
      const bubble = screen.getByTestId('bubble');

      // The indicator has a position and a size now. Neither one is an attribute.
      expect(bubble.style.getPropertyValue('--active-tab-width')).toBe('80px');
      expect(readDataAttributes(bubble)).toEqual({
        'data-activation-direction': 'none',
        'data-orientation': 'horizontal',
        'data-testid': 'bubble',
      });

      await setProps({ value: 1 });

      expect(readDataAttributes(bubble)).toEqual({
        'data-activation-direction': 'right',
        'data-orientation': 'horizontal',
        'data-testid': 'bubble',
      });
    });
  });

  describe('pre-hydration rendering', () => {
    // The server render with no `hydrate()` runs in Node, in `TabsIndicator.node.test.tsx`.

    // The script element of the server HTML must stay while the part hydrates, and go once the part
    // is mounted. A part that renders no script element while it hydrates gives a hydration mismatch,
    // and `hydrate` fails on it.
    it('keeps the script during hydration and removes it afterwards', async () => {
      const props = { value: 'b', renderBeforeHydration: true };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(template.content.querySelector('script')).not.toBe(null);

      const { container } = await hydrate(TabsIndicatorHydration, { serverHtml, props });

      expect(container.querySelector('script')).toBe(null);
    });
  });

  describe('hydration', () => {
    // The tabs of the fixture are 100 by 40 pixels in a list of 300 pixels. The second tab is active.
    const ACTIVE_TAB_VARIABLES = {
      left: '100px',
      right: '100px',
      top: '0px',
      bottom: '0px',
      width: '100px',
      height: '40px',
    };

    function readVariables(indicator: HTMLElement) {
      return Object.fromEntries(
        Object.keys(ACTIVE_TAB_VARIABLES).map((name) => [
          name,
          indicator.style.getPropertyValue(`--active-tab-${name}`),
        ]),
      );
    }

    // `innerHTML` does not run an inline script. A fragment of a range does, as `hydrate` does.
    function insertServerHtml(html: string) {
      const container = document.createElement('div');
      document.body.append(container);
      onTestFinished(() => container.remove());
      const range = document.createRange();
      range.selectNodeContents(container);
      container.append(range.createContextualFragment(html));
      return container;
    }

    function getIndicator(container: Element) {
      return container.querySelector<HTMLElement>('[data-testid="indicator"]')!;
    }

    it('is positioned by the script of the server HTML before the app starts', async () => {
      const container = insertServerHtml(
        await renderOnServer(HYDRATION_FIXTURE, { renderBeforeHydration: true }),
      );
      const indicator = getIndicator(container);

      expect(readVariables(indicator)).toEqual(ACTIVE_TAB_VARIABLES);
      expect(indicator).not.toHaveAttribute('hidden');
    });

    it('hydrates the server HTML that the script changed, with no message and no script left', async () => {
      const props = { renderBeforeHydration: true };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const { container } = await hydrate(TabsIndicatorHydration, { serverHtml, props });
      const indicator = getIndicator(container);

      expect(readVariables(indicator)).toEqual(ACTIVE_TAB_VARIABLES);
      expect(indicator).not.toHaveAttribute('hidden');
      expect(indicator).not.toHaveAttribute('data-allow-mismatch');
    });

    it('hydrates a style of the consumer on the indicator that the script changed', async () => {
      const props = { renderBeforeHydration: true, styled: true };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const { container } = await hydrate(TabsIndicatorHydration, { serverHtml, props });
      const indicator = getIndicator(container);

      expect(indicator.style.height).toBe('3px');
      expect(readVariables(indicator)).toEqual(ACTIVE_TAB_VARIABLES);
    });

    it('hydrates with no script, and measures the active tab after the mount', async () => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(template.content.querySelector('script')).toBe(null);
      expect(
        template.content.querySelector('[data-testid="indicator"]')?.hasAttribute('hidden'),
      ).toBe(true);

      const { container } = await hydrate(TabsIndicatorHydration, { serverHtml });
      const indicator = getIndicator(container);

      expect(readVariables(indicator)).toEqual(ACTIVE_TAB_VARIABLES);
      expect(indicator).not.toHaveAttribute('hidden');
    });

    it('hydrates with no message when its list is mounted before it', async () => {
      const props = { late: true };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      // The `hydrate` helper waits two ticks. An indicator in `<Suspense>` hydrates later than
      // that, so the test hydrates by hand and waits for the variables.
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const indicator = getIndicator(container);
      expect(indicator).toHaveAttribute('hidden');

      const app = createSSRApp(TabsIndicatorHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      await waitFor(() => {
        expect(readVariables(indicator)).toEqual(ACTIVE_TAB_VARIABLES);
      });
      expect(indicator).not.toHaveAttribute('hidden');
      // A mismatch can make Vue discard the server nodes and render new nodes.
      expect(getIndicator(container)).toBe(indicator);
      expect(takeReportedMessages()).toEqual([]);
    });
  });

  describe.skipIf(isJSDOM)('pre-hydration script execution', () => {
    let host: HTMLDivElement;

    afterEach(() => {
      host?.remove();
    });

    // Builds the server-emitted markup by hand and executes the real generated
    // script against it, as the browser would before hydration.
    function renderServerMarkup({
      hidden = false,
      activeTabStyle = 'width: 100px; height: 40px;',
    } = {}) {
      host = document.createElement('div');
      if (hidden) {
        host.style.display = 'none';
      }
      host.innerHTML =
        '<div role="tablist" style="width: 300px; height: 40px; position: relative;">' +
        `<button data-active style="${activeTabStyle} padding: 0; border: 0;">One</button>` +
        '<button style="width: 100px; height: 40px; padding: 0; border: 0;">Two</button>' +
        '<span hidden></span>' +
        '</div>';
      document.body.appendChild(host);

      const tabsList = host.querySelector<HTMLElement>('[role="tablist"]')!;
      const activeTab = host.querySelector<HTMLElement>('[data-active]')!;
      const indicator = host.querySelector<HTMLElement>('span')!;

      const scriptElement = document.createElement('script');
      scriptElement.textContent = generatedPrehydrationScript;
      // Appending an inline script executes it synchronously with `document.currentScript` set.
      indicator.after(scriptElement);

      return { tabsList, activeTab, indicator };
    }

    it('positions the indicator once a hidden streamed segment becomes visible', async () => {
      const { activeTab, indicator } = renderServerMarkup({ hidden: true });

      expect(indicator).toHaveAttribute('hidden');
      host.style.display = '';

      await waitFor(() => {
        expect(indicator).not.toHaveAttribute('hidden');
      });
      expect(getComputedStyle(indicator).getPropertyValue('--active-tab-width')).toBe(
        `${activeTab.offsetWidth}px`,
      );
    });

    it('does not resurrect the indicator when the captured tab is no longer active', async () => {
      const { activeTab, indicator } = renderServerMarkup({ hidden: true });

      // Simulate hydration switching to a value with no matching tab.
      activeTab.removeAttribute('data-active');
      host.style.display = '';

      // Give the ResizeObserver a chance to deliver after the reveal.
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(indicator).toHaveAttribute('hidden');
    });

    it('stops once hydration has revealed the indicator', async () => {
      const { tabsList, indicator } = renderServerMarkup({ hidden: true });

      // Simulate hydration taking ownership before the observer delivers:
      // Vue reveals the indicator and writes its own position variables.
      indicator.removeAttribute('hidden');
      indicator.style.setProperty('--active-tab-width', '55px');
      host.style.display = '';

      // Give the ResizeObserver a chance to deliver after the reveal.
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(getComputedStyle(indicator).getPropertyValue('--active-tab-width')).toBe('55px');

      // The observer must have disconnected, so later resizes change nothing.
      tabsList.style.width = '500px';
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(getComputedStyle(indicator).getPropertyValue('--active-tab-width')).toBe('55px');
    });

    it('keeps observing until the active tab is fully measurable', async () => {
      // The tab has width but no height yet (e.g. styles or images still loading).
      const { activeTab, indicator } = renderServerMarkup({
        activeTabStyle: 'width: 100px; height: 0; overflow: hidden;',
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(indicator).toHaveAttribute('hidden');

      activeTab.style.height = '40px';

      await waitFor(() => {
        expect(indicator).not.toHaveAttribute('hidden');
      });
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Tabs.List>', async () => {
    await expect(
      render(
        <Tabs.Root value={1}>
          <Tabs.Indicator />
        </Tabs.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A tab or an indicator of Tabs must be inside <Tabs.List>. Without a list the part has no list element to read and no keyboard navigation. Put the part inside <Tabs.List>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
