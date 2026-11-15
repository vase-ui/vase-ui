import { describe, expect, it } from 'vitest';
import { DateField } from '@vase-ui/vue/date-field';
import { createRenderer, describeConformance, screen } from '#test-utils';

const SEPARATOR = { type: 'literal', index: 1, editable: false, text: '/' } as const;

describe('<DateField.Literal />', () => {
  const { render } = createRenderer();

  describeConformance(<DateField.Literal segment={SEPARATOR} />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(<DateField.Root locale="en-US">{node}</DateField.Root>);
    },
  }));

  // A separator is only a visual divider. An era and a zone name change the meaning of the date.
  it.each([
    { name: 'a separator', segment: SEPARATOR, isHidden: true },
    { name: 'an era', segment: { type: 'era', index: 0, editable: false, text: 'BC' }, isHidden: false },
    {
      name: 'a time zone name',
      segment: { type: 'timeZoneName', index: 5, editable: false, text: 'GMT+9' },
      isHidden: false,
    },
  ] as const)('shows the text of $name, and hides a separator only', async ({ segment, isHidden }) => {
    await render(
      <DateField.Root locale="en-US">
        <DateField.Literal segment={segment} data-testid="literal" />
      </DateField.Root>,
    );
    const literal = screen.getByTestId('literal');

    expect(literal).toHaveTextContent(segment.text);
    expect(literal).toHaveAttribute('data-type', segment.type);
    if (isHidden) {
      expect(literal).toHaveAttribute('aria-hidden', 'true');
    } else {
      expect(literal).not.toHaveAttribute('aria-hidden');
    }
  });
});
