import { describe, expect, it } from 'vitest';
import { DateField } from '@vase-ui/vue/date-field';
import {
  createRenderer,
  describeConformance,
  hydrateAfter,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import { formatter } from '../../internals/date-time/format';
import DateFieldRootHydration from '../root/DateFieldRootHydration.test.vue';

const HYDRATION_FILE = 'src/date-field/root/DateFieldRootHydration.test.vue';

const MONTH = { type: 'month', index: 0, editable: true } as const;

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;

describe('<DateField.Segment />', () => {
  const { render } = createRenderer();

  describeConformance(<DateField.Segment segment={MONTH} />, () => ({
    refInstanceof: window.HTMLInputElement,
    testRenderPropWith: 'input',
    render(node) {
      return render(
        <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')} locale="en-US">
          {node}
        </DateField.Root>,
      );
    },
  }));

  it('is a spinbutton with the name, the number and the range of its segment', async () => {
    const value = Temporal.PlainDate.from('2026-11-14');
    const [format, epoch] = formatter(value, { month: 'long' }, 'en-US');
    await render(
      <DateField.Root defaultValue={value} locale="en-US">
        <DateField.Segment segment={MONTH} />
      </DateField.Root>,
    );
    const segment = screen.getByRole('spinbutton');

    expect(segment).toHaveAttribute(
      'aria-label',
      new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of('month'),
    );
    expect(segment).toHaveAttribute('aria-valuenow', '11');
    expect(segment).toHaveAttribute('aria-valuemin', '1');
    expect(segment).toHaveAttribute('aria-valuemax', '12');
    expect(segment).toHaveAttribute('aria-valuetext', format.format(epoch));
    expect(segment).toHaveAttribute('data-type', 'month');
    expect(segment).not.toHaveAttribute('data-placeholder');
  });

  it('shows its placeholder while it has no number', async () => {
    await render(
      <DateField.Root locale="en-US">
        <DateField.Segment segment={MONTH} />
      </DateField.Root>,
    );
    const segment = screen.getByRole('spinbutton');

    expect(segment).toHaveAttribute('data-placeholder');
    expect(segment).toHaveAttribute('placeholder', 'mm');
    expect(segment).toHaveAttribute('aria-valuetext', 'Empty');
    expect(segment).not.toHaveAttribute('aria-valuenow');
  });

  it('keeps the aria-label of the consumer in place of its own name', async () => {
    await render(
      <DateField.Root locale="en-US">
        <DateField.Segment segment={MONTH} aria-label="Birth month" />
      </DateField.Root>,
    );

    expect(screen.getByRole('spinbutton', { name: 'Birth month' })).toBeInTheDocument();
  });

  describe('text before the hydration', () => {
    // Vue writes the `value` of an input when it hydrates the input, over the text that the user
    // typed before the scripts of the page ran.
    it('keeps the text that the user typed, and the field takes its numbers', async () => {
      const props = { locale: 'en-US', name: 'when' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      const { container } = await hydrateAfter(DateFieldRootHydration, {
        serverHtml,
        props,
        before(serverContainer) {
          segmentOf(serverContainer, 'month').value = '1';
          segmentOf(serverContainer, 'day').value = '14';
          segmentOf(serverContainer, 'year').value = '2026';
          segmentOf(serverContainer, 'month').focus();
        },
      });
      const hiddenInput = container.querySelector<HTMLInputElement>('input[name="when"]')!;

      await waitFor(() => {
        expect(hiddenInput).toHaveValue('2026-01-14');
      });
      expect(['month', 'day', 'year'].map((type) => segmentOf(container, type).value)).toEqual([
        '1',
        '14',
        '2026',
      ]);
      // A full day and a full year that the user left do not take the focus from the month.
      expect(segmentOf(container, 'month')).toHaveFocus();
    });
  });
});
