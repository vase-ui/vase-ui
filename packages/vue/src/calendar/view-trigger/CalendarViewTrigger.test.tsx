import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarViewAncestors from '../root/CalendarViewAncestors.test.vue';

describe('<Calendar.ViewTrigger />', () => {
  const { render } = createRenderer();

  function renderTrigger(props: Record<string, unknown> = {}, slots = {}) {
    return render(
      <CalendarViewAncestors view="month" level="root">
        <Calendar.ViewTrigger {...props} data-testid="trigger" v-slots={slots} />
      </CalendarViewAncestors>,
    );
  }

  describeConformance(<Calendar.ViewTrigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    testRenderPropWith: 'button',
    render: (node) =>
      render(
        <CalendarViewAncestors view="month" level="root">
          {node}
        </CalendarViewAncestors>,
      ),
  }));

  it('renders a button that has the name of the year of the months', async () => {
    await renderTrigger();

    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveTextContent('2026');
    expect(trigger).toHaveAccessibleName('2026, choose the year');
    expect(trigger).toHaveAttribute('aria-live', 'polite');
    expect(trigger).toHaveAttribute('data-view', 'year');
    expect(trigger).not.toHaveAttribute('data-active');
  });

  it('names the button that shows the months, and marks it active in that view', async () => {
    await renderTrigger({ view: 'month' });

    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAccessibleName('2026, choose the month');
    expect(trigger).toHaveAttribute('data-active');
  });

  it('gives the text and the state to the default slot', async () => {
    await renderTrigger(
      {},
      {
        default: ({ text, state }: { text: string; state: { view: string; active: boolean } }) =>
          `[${text} ${state.view} ${state.active}]`,
      },
    );

    expect(screen.getByTestId('trigger')).toHaveTextContent('[2026 year false]');
  });

  it('gives the text to the slot render', async () => {
    await renderTrigger(
      {},
      {
        render: ({ props, text }: { props: Record<string, unknown>; text: string }) => (
          <button {...props} data-testid="render">{`(${text})`}</button>
        ),
      },
    );

    expect(screen.getByTestId('render')).toHaveTextContent('(2026)');
  });

  it('is disabled with its own prop', async () => {
    await renderTrigger({ disabled: true });

    expect(screen.getByTestId('trigger')).toBeDisabled();
  });
});
