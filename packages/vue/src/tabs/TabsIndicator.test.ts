import { afterEach, describe, expect, onTestFinished, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import TabsIndicatorLayouts from '../../test/fixtures/TabsIndicatorLayouts.vue';
import TabsInTransition from '../../test/fixtures/TabsInTransition.vue';
import { screen } from '../../test/queries';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';
import { getCssDimensions } from '../utils/getCssDimensions';
import { script } from './prehydrationScript.min';

type LayoutTab = { value: unknown; style?: string; anchor?: boolean };

/** A log for a fixture, which adds each entry to `entries`. */
const recorder = (entries: string[]) => ({ add: (entry: string) => entries.push(entry) });

const fixedTabs = (style: string, count = 3): LayoutTab[] =>
  Array.from({ length: count }, (_, index) => ({ value: index + 1, style }));

async function mountLayout(props: Record<string, unknown>) {
  const result = mount(TabsIndicatorLayouts, props);
  await nextTick();
  return {
    ...result,
    list: screen.getByTestId('list'),
    indicator: (index = 1) => screen.getByTestId(`indicator-${index}`),
    activeTab: () => screen.getByRole('tab', { selected: true }),
  };
}

function variable(element: HTMLElement, name: string) {
  return element.style.getPropertyValue(`--active-tab-${name}`);
}

function expectSize(actual: string, expected: number) {
  expect(Math.abs(Number.parseFloat(actual) - expected)).toBeLessThanOrEqual(0.01);
}

// The values that the rectangles give, in the layout of the list.
function expectVariablesOfActiveTab(indicator: HTMLElement, list: HTMLElement, tab: HTMLElement) {
  const tabRect = tab.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const { width, height } = getCssDimensions(tab);
  const listSize = getCssDimensions(list);
  const scaleX = listSize.width > 0 ? listRect.width / listSize.width : 1;
  const scaleY = listSize.height > 0 ? listRect.height / listSize.height : 1;
  const left = (tabRect.left - listRect.left) / scaleX + list.scrollLeft - list.clientLeft;
  const top = (tabRect.top - listRect.top) / scaleY + list.scrollTop - list.clientTop;
  expectSize(variable(indicator, 'left'), left);
  expectSize(variable(indicator, 'right'), list.scrollWidth - left - width);
  expectSize(variable(indicator, 'top'), top);
  expectSize(variable(indicator, 'bottom'), list.scrollHeight - top - height);
  expectSize(variable(indicator, 'width'), width);
  expectSize(variable(indicator, 'height'), height);
}

// The indicator as a box over the active tab, as the demos place it.
let boxStyle: HTMLStyleElement | undefined;

function placeIndicatorOverActiveTab() {
  boxStyle = document.head.appendChild(document.createElement('style'));
  boxStyle.textContent = `[data-testid^="indicator"] {
    position: absolute; top: 0; left: 0;
    width: var(--active-tab-width); height: var(--active-tab-height);
    transform: translate(var(--active-tab-left), var(--active-tab-top));
  }`;
}

afterEach(() => {
  boxStyle?.remove();
  boxStyle = undefined;
});

async function waitForIndicatorOverActiveTab(indicator: HTMLElement, tab: HTMLElement) {
  for (const edge of ['left', 'top', 'right', 'bottom'] as const) {
    await waitFor(() => {
      const difference =
        indicator.getBoundingClientRect()[edge] - tab.getBoundingClientRect()[edge];
      expect(Math.abs(difference)).toBeLessThanOrEqual(1);
    });
  }
  expect(indicator).not.toHaveAttribute('hidden');
}

async function nextFrame() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe('<Tabs.Indicator />', () => {
  test('in a <Transition>, a value during the leave renders one indicator at each moment; the new indicator enters after the old one goes', async () => {
    const root = reactive<{ modelValue: string | null }>({ modelValue: 'a' });
    const { root: host } = mount(TabsInTransition, { root });
    await nextTick();
    const indicators = () => [...host.querySelectorAll('.Indicator')];
    const [old] = indicators();
    let most = 0;
    const observer = new MutationObserver(() => (most = Math.max(most, indicators().length)));
    observer.observe(host, { childList: true, subtree: true });
    root.modelValue = null;
    await nextTick();
    root.modelValue = 'b';
    await nextTick();
    expect(indicators()).toEqual([old]);
    await waitFor(() => {
      expect(indicators()).toHaveLength(1);
      expect(indicators()[0]).not.toBe(old);
      expect(indicators()[0]!.className).toBe('Indicator');
    });
    observer.disconnect();
    expect(most).toBe(1);
  });

  test('exposes null active tab state when the selected value has no matching tab', async () => {
    const root = reactive<Record<string, unknown>>({ modelValue: 'missing' });
    const renders: string[] = [];
    const { indicator } = await mountLayout({
      root,
      tabs: [{ value: 'one', style: 'width: 50px' }],
      slotted: true,
      renders: recorder(renders),
    });
    expect(indicator()).toHaveAttribute('hidden');
    expect(variable(indicator(), 'width')).toBe('');
    expect(renders.at(-1)).toBe('undefined undefined');
    root.modelValue = 'one';
    await waitFor(() => expect(indicator()).not.toHaveAttribute('hidden'));
    expect(renders.at(-1)).toBe('50 0');
    root.modelValue = 'missing';
    await nextTick();
    expect(indicator()).toHaveAttribute('hidden');
    expect(renders.at(-1)).toBe('undefined undefined');
  });

  test.each(['width', 'height'])(
    'is hidden with no variable while the active tab has no %s',
    async (side) => {
      const { indicator } = await mountLayout({
        root: { modelValue: 1 },
        tabs: [{ value: 1, style: `${side}: 0; padding: 0; border: 0` }],
      });
      await nextFrame();
      expect(indicator()).toHaveAttribute('hidden');
      expect(variable(indicator(), 'left')).toBe('');
    },
  );

  test('updates only the mounted indicator after another indicator unmounts', async () => {
    const scene = reactive({ indicators: 2 });
    const { indicator, activeTab } = await mountLayout({
      root: { modelValue: 1 },
      tabs: [{ value: 1, style: 'width: 50px' }],
      scene,
    });
    const [first, second] = [indicator(1), indicator(2)];
    expect(variable(first, 'width')).toBe('50px');
    scene.indicators = 1;
    await nextTick();
    expect(first.isConnected).toBe(true);
    expect(second.isConnected).toBe(false);
    activeTab().style.width = '75px';
    await waitFor(() => expect(variable(first, 'width')).toBe('75px'));
    expect(variable(second, 'width')).toBe('50px');
  });

  describe('rendering', () => {
    test('should not render when no tab is active', async () => {
      await mountLayout({ root: { modelValue: null }, tabs: fixedTabs('width: 50px') });
      expect(screen.queryByTestId('indicator-1')).toBeNull();
    });

    test('should set CSS variables corresponding to the active tab', async () => {
      const { indicator, list, activeTab } = await mountLayout({
        root: { modelValue: 2 },
        tabs: fixedTabs(''),
      });
      expectVariablesOfActiveTab(indicator(), list, activeTab());
    });

    test('should update the position and movement variables when the active tab changes', async () => {
      const root = reactive<Record<string, unknown>>({ modelValue: 2 });
      const { indicator, list, activeTab } = await mountLayout({ root, tabs: fixedTabs('') });
      root.modelValue = 3;
      await nextTick();
      expectVariablesOfActiveTab(indicator(), list, activeTab());
      root.modelValue = 1;
      await nextTick();
      expectVariablesOfActiveTab(indicator(), list, activeTab());
    });

    test('should update the position variables when the tab list is resized', async () => {
      const { indicator, list, activeTab } = await mountLayout({
        wrapperStyle: 'width: 400px',
        root: { modelValue: 1 },
        tabs: fixedTabs('flex: 1 1 auto', 2),
      });
      expectVariablesOfActiveTab(indicator(), list, activeTab());
      const width = variable(indicator(), 'width');
      list.parentElement!.parentElement!.style.width = '800px';
      await waitFor(() => expect(variable(indicator(), 'width')).not.toBe(width));
      expectVariablesOfActiveTab(indicator(), list, activeTab());
    });

    test('updates the right variable when only the list is resized', async () => {
      const { indicator, list } = await mountLayout({
        listStyle: 'display: flex; position: relative; width: 300px',
        root: { modelValue: 1 },
        tabs: fixedTabs('width: 100px; flex-shrink: 0', 2),
      });
      expect(variable(indicator(), 'right')).toBe('200px');
      // The first notification of the observers comes after two frames.
      await nextFrame();
      await nextFrame();
      list.style.width = '400px';
      await waitFor(() => expect(variable(indicator(), 'right')).toBe('300px'));
    });

    test('should account for scroll and border when the tab list is transformed', async () => {
      // The gap gives the tab a place with a fraction of a pixel, which only the rectangles give.
      const { indicator, list, activeTab } = await mountLayout({
        wrapperStyle: 'transform: scale(1.5)',
        listStyle:
          'width: 240px; display: flex; gap: 8.25px; overflow-x: auto; border: 6px solid black; padding: 4px',
        root: { modelValue: 3 },
        tabs: fixedTabs('flex: 0 0 120px', 5),
      });
      list.scrollLeft = 80;
      activeTab().style.width = '121px';
      await waitFor(() => expectVariablesOfActiveTab(indicator(), list, activeTab()));
    });

    test('accounts for a scrolled container between the tab list and the active tab', async () => {
      placeIndicatorOverActiveTab();
      const { indicator, activeTab } = await mountLayout({
        root: { modelValue: 3 },
        tabs: fixedTabs('width: 80px; height: 32px; flex-shrink: 0'),
        scroller: true,
      });
      screen.getByTestId('scroller').scrollLeft = 40;
      // A scroll alone starts no measure, so a resize of the tab does.
      activeTab().style.width = '84px';
      await waitForIndicatorOverActiveTab(indicator(), activeTab());
    });

    test.each<{ name: string; wrapperStyle: string; listStyle?: string }>([
      { name: 'an ancestor has a 2D rotation', wrapperStyle: 'transform: rotate(40deg)' },
      { name: 'an ancestor has a size-preserving flip', wrapperStyle: 'transform: scaleX(-1)' },
      { name: 'an ancestor uses the rotate longhand', wrapperStyle: 'rotate: 40deg' },
      { name: 'an ancestor uses a flipping scale longhand', wrapperStyle: 'scale: -1 1' },
      {
        name: 'an ancestor has a 3D rotation (#4837)',
        wrapperStyle: 'transform: perspective(600px) rotateY(35deg)',
      },
      {
        name: 'an ancestor has a 2D rotation and the list has a border',
        wrapperStyle: 'transform: rotate(40deg)',
        listStyle: 'display: flex; position: relative; border: 6px solid',
      },
    ])('overlays the active tab when $name', async ({ wrapperStyle, listStyle }) => {
      placeIndicatorOverActiveTab();
      const { indicator, activeTab } = await mountLayout({
        wrapperStyle,
        ...(listStyle && { listStyle }),
        root: { modelValue: 3 },
        tabs: fixedTabs('width: 80px; height: 32px'),
      });
      await waitForIndicatorOverActiveTab(indicator(), activeTab());
    });

    test('sets transformed offsets relative to the tab list when the list is not the offset parent', async () => {
      const { indicator } = await mountLayout({
        wrapperStyle: 'position: relative; transform: rotate(40deg)',
        listStyle: 'display: flex; margin-left: 40px',
        root: { modelValue: 3 },
        tabs: fixedTabs('width: 80px; height: 32px'),
      });
      expectSize(variable(indicator(), 'left'), 160);
      expectSize(variable(indicator(), 'top'), 0);
    });

    test.each([
      {
        name: 'it has its own transform translation',
        style: 'transform: translateX(12px) translateY(4px)',
      },
      { name: 'it uses the translate longhand', style: 'translate: 12px 4px' },
      // 50% of 80px is 40px across, and 25% of 32px is 8px down.
      { name: 'the translate longhand uses percentages', style: 'translate: 50% 25%' },
    ])('follows the active tab when $name', async ({ style }) => {
      placeIndicatorOverActiveTab();
      const tabs = fixedTabs('width: 80px; height: 32px');
      tabs[2] = { value: 3, style: `width: 80px; height: 32px; ${style}` };
      const { indicator, activeTab } = await mountLayout({ root: { modelValue: 3 }, tabs });
      await waitForIndicatorOverActiveTab(indicator(), activeTab());
    });

    test('updates position when a different tab resizes', async () => {
      const { indicator, list, activeTab } = await mountLayout({
        listStyle: 'width: 300px; display: flex; overflow: hidden',
        root: { modelValue: 2 },
        tabs: fixedTabs('width: 100px; flex-shrink: 0'),
      });
      screen.getAllByRole('tab')[0]!.style.width = '140px';
      await waitFor(() => expectSize(variable(indicator(), 'left'), 140));
      expectVariablesOfActiveTab(indicator(), list, activeTab());
    });

    test('updates all indicators when a different tab resizes', async () => {
      const { indicator, list, activeTab } = await mountLayout({
        listStyle: 'width: 300px; display: flex; overflow: hidden',
        root: { modelValue: 2 },
        tabs: fixedTabs('width: 100px; flex-shrink: 0'),
        scene: { indicators: 2 },
      });
      screen.getAllByRole('tab')[0]!.style.width = '140px';
      for (const index of [1, 2]) {
        await waitFor(() => expectSize(variable(indicator(index), 'left'), 140));
        expectVariablesOfActiveTab(indicator(index), list, activeTab());
      }
    });

    test('keeps observing a tab whose rendered element type changes', async () => {
      const tabs = reactive<LayoutTab[]>([
        { value: 1, style: 'width: 100px; flex-shrink: 0' },
        { value: 2, style: 'width: 100px; flex-shrink: 0' },
      ]);
      const { indicator } = await mountLayout({
        listStyle: 'width: 300px; display: flex; overflow: hidden',
        root: { modelValue: 2 },
        tabs,
      });
      tabs[0]!.anchor = true;
      await nextTick();
      const anchor = screen.getByRole('tab', { name: '1' });
      expect(anchor.tagName).toBe('A');
      // The swap itself gives resize entries. The case waits for them, so that only the observer
      // of the new element can give the next measure.
      await nextFrame();
      await nextFrame();
      anchor.style.width = '160px';
      await waitFor(() => expectSize(variable(indicator(), 'left'), 160));
    });

    test('falls back to offset positions when the tab list is scaled to zero', async () => {
      const { indicator, activeTab } = await mountLayout({
        wrapperStyle: 'transform: scale(0)',
        listStyle: 'position: relative; width: 300px; display: flex; overflow: hidden',
        root: { modelValue: 2 },
        tabs: fixedTabs('width: 100px; flex-shrink: 0', 2),
      });
      expectSize(variable(indicator(), 'left'), activeTab().offsetLeft);
      expectSize(variable(indicator(), 'top'), activeTab().offsetTop);
      expectSize(variable(indicator(), 'width'), 100);
      expect(indicator()).not.toHaveAttribute('hidden');
    });

    test('updates position when a new tab is inserted and then resized', async () => {
      const tabs = reactive<LayoutTab[]>(fixedTabs('width: 100px; flex-shrink: 0'));
      const { indicator, list, activeTab } = await mountLayout({
        listStyle: 'width: 320px; display: flex; overflow: hidden',
        root: { modelValue: 2 },
        tabs,
      });
      tabs.unshift({ value: 0, style: 'width: 60px; flex-shrink: 0' });
      await waitFor(() => expectSize(variable(indicator(), 'left'), 160));
      screen.getByRole('tab', { name: '0' }).style.width = '120px';
      await waitFor(() => expectSize(variable(indicator(), 'left'), 220));
      expectVariablesOfActiveTab(indicator(), list, activeTab());
    });

    test('follows the active tab when a keyed list moves it with no change of size', async () => {
      const tabs = reactive<LayoutTab[]>([
        { value: 'a', style: 'width: 50px' },
        { value: 'b', style: 'width: 50px' },
      ]);
      const { indicator } = await mountLayout({ root: { modelValue: 'b' }, tabs });
      expect(variable(indicator(), 'left')).toBe('50px');
      // The first notification of the observers comes after two frames.
      await nextFrame();
      await nextFrame();
      tabs.reverse();
      await waitFor(() => expect(variable(indicator(), 'left')).toBe('0px'));
    });

    test('measures again when the orientation changes with no change of size', async () => {
      const root = reactive({ modelValue: 2, orientation: 'horizontal' });
      const { indicator, list } = await mountLayout({
        root,
        listStyle: 'display: flex; width: 200px; height: 200px',
        tabs: fixedTabs('width: 50px; height: 40px; flex-shrink: 0', 2),
      });
      expect(variable(indicator(), 'left')).toBe('50px');
      // The first notification of the observers comes after two frames.
      await nextFrame();
      await nextFrame();
      // The list and the tabs keep their sizes, so no observer calls back.
      list.style.flexDirection = 'column';
      root.orientation = 'vertical';
      await waitFor(() => expect(variable(indicator(), 'top')).toBe('40px'));
      expect(variable(indicator(), 'left')).toBe('0px');
    });

    test('perf: single tab resize does not fan out excessive indicator rerenders', async () => {
      const renders: string[] = [];
      const { indicator, list, activeTab } = await mountLayout({
        listStyle: 'width: 1200px; display: flex; overflow: hidden',
        root: { modelValue: 50 },
        tabs: fixedTabs('width: 120px; flex-shrink: 0', 100),
        slotted: true,
        renders: recorder(renders),
      });
      await nextFrame();
      await nextFrame();
      const before = renders.length;
      screen.getAllByRole('tab')[0]!.style.width = '180px';
      await waitFor(() => expectVariablesOfActiveTab(indicator(), list, activeTab()));
      expect(renders.length - before).toBeLessThan(5);
    });
  });

  describe('pre-hydration script execution', () => {
    let host: HTMLDivElement;

    afterEach(() => host?.remove());

    // The markup of the server HTML, with the script after the indicator, as the `element` slot
    // gives it. Appending an inline script runs it with `document.currentScript` set.
    function renderServerMarkup({
      hidden = false,
      activeTabStyle = 'width: 100px; height: 40px;',
    }) {
      host = document.body.appendChild(document.createElement('div'));
      if (hidden) host.style.display = 'none';
      host.innerHTML =
        '<div role="tablist" style="width: 300px; height: 40px; position: relative;">' +
        `<button aria-selected="true" style="${activeTabStyle} padding: 0; border: 0;">One</button>` +
        '<button aria-selected="false" style="width: 100px; height: 40px; padding: 0; border: 0;">Two</button>' +
        '<span hidden></span>' +
        '</div>';
      const indicator = host.querySelector('span')!;
      const element = document.createElement('script');
      element.textContent = `${script}(document.currentScript.previousElementSibling)`;
      indicator.after(element);
      return {
        list: host.querySelector<HTMLElement>('[role="tablist"]')!,
        activeTab: host.querySelector<HTMLElement>('[aria-selected="true"]')!,
        indicator,
      };
    }

    function waitForTask(milliseconds = 100) {
      return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    test('positions the indicator once a hidden streamed segment becomes visible', async () => {
      const { activeTab, indicator } = renderServerMarkup({ hidden: true });
      expect(indicator).toHaveAttribute('hidden');
      host.style.display = '';
      await waitFor(() => expect(indicator).not.toHaveAttribute('hidden'));
      expect(variable(indicator, 'width')).toBe(`${activeTab.offsetWidth}px`);
    });

    test('does not resurrect the indicator when the captured tab is no longer active', async () => {
      const { activeTab, indicator } = renderServerMarkup({ hidden: true });
      activeTab.setAttribute('aria-selected', 'false');
      host.style.display = '';
      await waitForTask();
      expect(indicator).toHaveAttribute('hidden');
    });

    test('stops once hydration has revealed the indicator', async () => {
      const { list, indicator } = renderServerMarkup({ hidden: true });
      indicator.removeAttribute('hidden');
      indicator.style.setProperty('--active-tab-width', '55px');
      host.style.display = '';
      await waitForTask();
      expect(variable(indicator, 'width')).toBe('55px');
      list.style.width = '500px';
      await waitForTask();
      expect(variable(indicator, 'width')).toBe('55px');
    });

    test('keeps observing until the active tab is fully measurable', async () => {
      const { activeTab, indicator } = renderServerMarkup({
        activeTabStyle: 'width: 100px; height: 0; overflow: hidden;',
      });
      await waitForTask();
      expect(indicator).toHaveAttribute('hidden');
      activeTab.style.height = '40px';
      await waitFor(() => expect(indicator).not.toHaveAttribute('hidden'));
    });

    test('reads the indicator around it, the parent of the script', () => {
      host = document.body.appendChild(document.createElement('div'));
      host.innerHTML =
        '<div role="tablist" style="width: 300px; position: relative;">' +
        '<button aria-selected="true" style="width: 100px; height: 40px;">One</button>' +
        '<span hidden><i></i></span></div>';
      const indicator = host.querySelector('span')!;
      const element = document.createElement('script');
      element.textContent = `${script}(document.currentScript.parentElement)`;
      onTestFinished(() => element.remove());
      indicator.append(element);
      expect(indicator).not.toHaveAttribute('hidden');
      expect(variable(indicator, 'width')).toBe('100px');
    });
  });
});
