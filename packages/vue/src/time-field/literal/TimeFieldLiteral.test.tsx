import { describe, expect, it } from 'vitest';
import { TimeField } from '@vase-ui/vue/time-field';
import { createRenderer, describeConformance, screen } from '#test-utils';
import { formatter } from '../../internals/date-time/format';

describe('<TimeField.Literal />', () => {
  const { render } = createRenderer();

  describeConformance(
    <TimeField.Literal segment={{ type: 'literal', index: 1, editable: false, text: ':' }} />,
    () => ({
      refInstanceof: window.HTMLSpanElement,
      render: (node) => render(<TimeField.Root>{node}</TimeField.Root>),
    }),
  );

  it('shows the text of its item, and hides it from assistive technology', async () => {
    const { container } = await render(
      <TimeField.Root>
        <TimeField.Literal
          data-testid="literal"
          segment={{ type: 'literal', index: 1, editable: false, text: ' h ' }}
        />
      </TimeField.Root>,
    );
    const literal = screen.getByTestId('literal');

    expect(literal.textContent).toBe(' h ');
    expect(literal).toHaveAttribute('aria-hidden', 'true');
    expect(literal).toHaveAttribute('data-type', 'literal');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(1);
  });

  it('shows the name of the time zone to assistive technology', async () => {
    const value = Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]');
    const { container } = await render(
      <TimeField.Root defaultValue={value} locale="en-US">
        <TimeField.Input />
      </TimeField.Root>,
    );
    const zone = container.querySelector('[data-type="timeZoneName"]')!;
    const [format, epoch] = formatter(
      value,
      { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' },
      'en-US',
    );

    expect(zone.textContent).toBe(
      format.formatToParts(epoch).find(({ type }) => type === 'timeZoneName')?.value,
    );
    expect(zone).not.toHaveAttribute('aria-hidden');
  });

  it('gives its state to stateClass', async () => {
    await render(
      <TimeField.Root>
        <TimeField.Literal
          data-testid="literal"
          stateClass={(state) => `is-${state.type}`}
          segment={{ type: 'literal', index: 1, editable: false, text: ':' }}
        />
      </TimeField.Root>,
    );

    expect(screen.getByTestId('literal')).toHaveClass('is-literal');
  });
});
