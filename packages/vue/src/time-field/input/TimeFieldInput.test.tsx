import { describe, expect, it } from 'vitest';
import { TimeField } from '@vase-ui/vue/time-field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  hydrate,
  renderOnServer,
  screen,
} from '#test-utils';
import { formatter } from '../../internals/date-time/format';
import TimeFieldRootHydration from '../root/TimeFieldRootHydration.test.vue';

const FIXTURE = 'src/time-field/root/TimeFieldRootHydration.test.vue';

const typesOf = (container: Element) =>
  Array.from(container.querySelectorAll('[data-type]'), (element) =>
    element.getAttribute('data-type'),
  );
const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;

// The order of the items of a layout, as `Intl` gives it. Two texts in a row are one text.
function layoutOf(locale: string, options: Intl.DateTimeFormatOptions) {
  const [format, epoch] = formatter(Temporal.PlainTime.from('15:04:33'), options, locale);
  const types: string[] = [];
  for (const { type } of format.formatToParts(epoch)) {
    const item = /^(hour|minute|second|dayPeriod)$/.test(type) ? type : 'literal';
    if (item !== 'literal' || types.at(-1) !== 'literal') {
      types.push(item);
    }
  }
  return types;
}

describe('<TimeField.Input />', () => {
  const { render } = createRenderer();

  describeConformance(<TimeField.Input />, () => ({
    refInstanceof: window.HTMLDivElement,
    childrenSelector: 'input[data-type]',
    render: (node) => render(<TimeField.Root>{node}</TimeField.Root>),
  }));

  describe('items', () => {
    it.each([
      { name: 'en-US', locale: 'en-US' },
      { name: 'ko-KR', locale: 'ko-KR' },
      { name: 'fr-CA', locale: 'fr-CA' },
    ])(
      'renders a segment or a literal for each item of the layout of $name',
      async ({ locale }) => {
        const { container } = await render(
          <TimeField.Root locale={locale} granularity="second">
            <TimeField.Input />
          </TimeField.Root>,
        );

        const layout = layoutOf(locale, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

        expect(typesOf(container)).toEqual(layout);
        expect(container.querySelectorAll('input[data-type]')).toHaveLength(
          layout.filter((type) => type !== 'literal').length,
        );
      },
    );

    it('gives each item and its index to the segment slot', async () => {
      const { container } = await render(
        <TimeField.Root locale="en-US" defaultValue={Temporal.PlainTime.from('15:04')}>
          <TimeField.Input>
            {{
              segment: ({
                segment,
                index,
              }: {
                segment: TimeField.Input.Segment;
                index: number;
              }) => (
                <b data-testid="item" data-kind={segment.type} data-index={index}>
                  {segment.editable ? 'segment' : segment.text}
                </b>
              ),
            }}
          </TimeField.Input>
        </TimeField.Root>,
      );
      const items = screen.getAllByTestId('item');

      expect(items.map((item) => item.dataset.kind)).toEqual(
        layoutOf('en-US', { hour: 'numeric', minute: '2-digit' }),
      );
      expect(items.map((item) => item.dataset.index)).toEqual(items.map((_, index) => `${index}`));
      expect(items[0]).toHaveTextContent('segment');
      expect(container.querySelector('input[data-type]')).toBe(null);
    });

    it('renders the default items in the element of the render slot, and gives the segment slot to children', async () => {
      const { container } = await render(
        <TimeField.Root locale="en-US" defaultValue={Temporal.PlainTime.from('15:04')}>
          <TimeField.Input>
            {{
              render: ({ props, children: Children }: any) => (
                <fieldset {...props} data-testid="own">
                  <Children>
                    {{
                      segment: ({ segment }: { segment: TimeField.Input.Segment }) => (
                        <i data-testid="item">{segment.type}</i>
                      ),
                    }}
                  </Children>
                </fieldset>
              ),
            }}
          </TimeField.Input>
        </TimeField.Root>,
      );

      expect(screen.getByTestId('own').tagName).toBe('FIELDSET');
      expect(screen.getAllByTestId('item').map((item) => item.textContent)).toEqual(
        layoutOf('en-US', { hour: 'numeric', minute: '2-digit' }),
      );
      expect(container.querySelector('input[data-type]')).toBe(null);
    });

    it('makes the segments again when the locale changes the layout', async () => {
      const { container, rerender } = await render(
        <TimeField.Root locale="en-US" hourCycle={12}>
          <TimeField.Input />
        </TimeField.Root>,
      );
      expect(typesOf(container)).toContain('dayPeriod');

      await rerender(
        <TimeField.Root locale="en-US" hourCycle={24}>
          <TimeField.Input />
        </TimeField.Root>,
      );

      expect(typesOf(container)).not.toContain('dayPeriod');
      expect(typesOf(container)).toEqual(['hour', 'literal', 'minute']);
    });
  });

  describe('press', () => {
    it('gives the focus to the first segment for a press outside a segment', async () => {
      const { container } = await render(
        <TimeField.Root locale="en-US" defaultValue={Temporal.PlainTime.from('15:04')}>
          <TimeField.Input data-testid="input" />
        </TimeField.Root>,
      );

      await fireEvent.mouseDown(screen.getByTestId('input'));

      expect(segmentOf(container, 'hour')).toHaveFocus();
    });
  });

  describe('server layout that differs from the layout of the browser', () => {
    it.each([
      { name: 'a 24-hour layout in a 12-hour one', server: 'de-DE', client: 'en-US' },
      { name: 'a 12-hour layout in a 24-hour one', server: 'en-US', client: 'de-DE' },
      { name: 'the day period first in a layout', server: 'ko-KR', client: 'en-US' },
      { name: 'another text between segments', server: 'fr-CA', client: 'de-DE' },
      { name: 'a layout of another locale', server: 'is-IS', client: 'is-IS' },
    ])('hydrates $name with no warning', async ({ server, client }) => {
      const base = { defaultValue: '15:04:33', granularity: 'second', clear: true };
      const serverHtml = await renderOnServer(FIXTURE, { ...base, locale: server });

      const { container } = await hydrate(TimeFieldRootHydration, {
        serverHtml,
        props: { ...base, locale: client },
      });

      expect(typesOf(container)).toEqual(
        layoutOf(client, { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
      );
    });

    it('leaves no element of the server layout in the field', async () => {
      const base = { defaultValue: '15:04', clear: true };
      const serverHtml = await renderOnServer(FIXTURE, { ...base, locale: 'en-US' });

      const { container } = await hydrate(TimeFieldRootHydration, {
        serverHtml,
        props: { ...base, locale: 'de-DE' },
      });

      expect(typesOf(container)).toEqual(['hour', 'literal', 'minute']);
      expect(container.querySelector('[data-type="dayPeriod"]')).toBe(null);
      expect(screen.queryByText('PM')).toBe(null);
    });
  });
});
