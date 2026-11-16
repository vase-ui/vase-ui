import { describe, expect, it } from 'vitest';
import { DateField } from '@vase-ui/vue/date-field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  hydrate,
  renderOnServer,
  screen,
} from '#test-utils';
import { formatter } from '../../internals/date-time/format';
import DateFieldRootHydration from '../root/DateFieldRootHydration.test.vue';

const HYDRATION_FILE = 'src/date-field/root/DateFieldRootHydration.test.vue';

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;

describe('<DateField.Input />', () => {
  const { render } = createRenderer();

  describeConformance(<DateField.Input />, () => ({
    refInstanceof: window.HTMLDivElement,
    childrenSelector: 'input[data-type]',
    render(node) {
      return render(
        <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')}>
          {node}
        </DateField.Root>,
      );
    },
  }));

  it('shows the segments and the separators in the layout of the locale', async () => {
    const value = Temporal.PlainDate.from('2026-11-14');
    const { container } = await render(
      <DateField.Root defaultValue={value} locale="de-DE">
        <DateField.Input data-testid="input" />
      </DateField.Root>,
    );
    const [format, epoch] = formatter(
      value,
      { year: 'numeric', month: 'numeric', day: 'numeric' },
      'de-DE',
    );
    const shown = Array.from(container.querySelectorAll<HTMLElement>('[data-type]'), (element) =>
      element instanceof HTMLInputElement ? element.value : element.textContent,
    ).join('');

    expect(shown).toBe(format.format(epoch));
  });

  // `Intl` of WebKit gives the year of these layouts as a part of the type `unknown`.
  it.each([
    {
      name: 'a year and month in sc-IT',
      locale: 'sc-IT',
      value: () => Temporal.PlainYearMonth.from('2026-11'),
      year: 2026,
    },
    {
      name: 'a year and month in ksh',
      locale: 'ksh',
      value: () => Temporal.PlainYearMonth.from('2026-11'),
      year: 2026,
    },
    {
      name: 'a Buddhist date in my-MM',
      locale: 'my-MM',
      value: () => Temporal.PlainDate.from('2026-11-14').withCalendar('buddhist'),
      year: 2569,
    },
    {
      name: 'a Japanese date in my-MM',
      locale: 'my-MM',
      value: () => Temporal.PlainDate.from('2026-11-14').withCalendar('japanese'),
      year: 8,
    },
  ])('shows a year segment for $name', async ({ locale, value, year }) => {
    const { container } = await render(
      <DateField.Root defaultValue={value()} locale={locale}>
        <DateField.Input />
      </DateField.Root>,
    );

    expect(
      Array.from(
        container.querySelectorAll<HTMLInputElement>('input[data-type="year"]'),
        (input) => input.value,
      ),
    ).toEqual([new Intl.NumberFormat(locale, { useGrouping: false }).format(year)]);
  });

  describe('slot: segment', () => {
    it('gives each part of the layout to the slot, and shows what the slot renders', async () => {
      const gives = new Set<string>();
      const { container } = await render(
        <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')} locale="en-US">
          <DateField.Input
            v-slots={{
              segment: ({
                segment,
                index,
              }: {
                segment: DateField.Input.Segment;
                index: number;
              }) => {
                gives.add(`${index} ${segment.type}`);
                return segment.editable ? (
                  <DateField.Segment segment={segment} class="own-segment" />
                ) : (
                  <DateField.Literal segment={segment} class="own-literal" />
                );
              },
            }}
          />
        </DateField.Root>,
      );

      expect([...gives]).toEqual(['0 month', '1 literal', '2 day', '3 literal', '4 year']);
      expect(container.querySelectorAll('input.own-segment')).toHaveLength(3);
      expect(container.querySelectorAll('span.own-literal')).toHaveLength(2);
    });
  });

  describe('press outside a segment', () => {
    it('gives the focus to the first empty segment', async () => {
      const { container, user } = await render(
        <DateField.Root locale="en-US">
          <DateField.Input data-testid="input" />
        </DateField.Root>,
      );

      segmentOf(container, 'month').focus();
      // Two digits fill the month, and the focus goes to the day.
      await user.keyboard('11');
      segmentOf(container, 'day').blur();
      await fireEvent.mouseDown(screen.getByTestId('input'));

      expect(segmentOf(container, 'day')).toHaveFocus();
    });

    it('gives the focus to the first segment when no segment is empty', async () => {
      const { container } = await render(
        <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')} locale="en-US">
          <DateField.Input data-testid="input" />
        </DateField.Root>,
      );

      await fireEvent.mouseDown(screen.getByTestId('input'));

      expect(segmentOf(container, 'month')).toHaveFocus();
    });
  });

  describe('hydration', () => {
    // A server and a browser can have other `Intl` data for a locale, so the layout of the server
    // can differ from the first layout of the browser, also in its number of parts.
    it.each([
      {
        name: 'the same layout',
        server: { locale: 'en-US', defaultValue: '2026-11-14' },
        client: { locale: 'en-US', defaultValue: '2026-11-14' },
      },
      {
        name: 'separators with other text',
        server: { locale: 'de-DE', defaultValue: '2026-11-14' },
        client: { locale: 'en-US', defaultValue: '2026-11-14' },
      },
      {
        name: 'a layout in another order',
        server: { locale: 'ja-JP', defaultValue: '2026-11-14' },
        client: { locale: 'en-US', defaultValue: '2026-11-14' },
      },
      {
        name: 'a layout with more parts',
        server: { locale: 'en-US', defaultValue: '2026-11-14T15:04', granularity: 'day' },
        client: { locale: 'en-US', defaultValue: '2026-11-14T15:04', hourCycle: 24 },
      },
      {
        name: 'a layout with fewer parts',
        server: { locale: 'en-US', defaultValue: '2026-11-14T15:04', hourCycle: 24 },
        client: { locale: 'en-US', defaultValue: '2026-11-14T15:04', granularity: 'day' },
      },
      {
        name: 'the children component of a #render slot',
        server: { locale: 'en-US', defaultValue: '2026-11-14', useRenderSlot: true },
        client: { locale: 'en-US', defaultValue: '2026-11-14', useRenderSlot: true },
      },
      {
        name: 'more parts in a #render slot',
        server: {
          locale: 'en-US',
          defaultValue: '2026-11-14T15:04',
          granularity: 'day',
          useRenderSlot: true,
        },
        client: {
          locale: 'en-US',
          defaultValue: '2026-11-14T15:04',
          hourCycle: 24,
          useRenderSlot: true,
        },
      },
      {
        name: 'fewer parts in a #render slot',
        server: {
          locale: 'en-US',
          defaultValue: '2026-11-14T15:04',
          hourCycle: 24,
          useRenderSlot: true,
        },
        client: {
          locale: 'en-US',
          defaultValue: '2026-11-14T15:04',
          granularity: 'day',
          useRenderSlot: true,
        },
      },
      {
        name: 'a layout with fewer parts in a slot',
        server: { locale: 'en-US', defaultValue: '2026-11-14T15:04', useSegmentSlot: true },
        client: {
          locale: 'en-US',
          defaultValue: '2026-11-14T15:04',
          granularity: 'day',
          useSegmentSlot: true,
        },
      },
      {
        name: 'a year and month in sc-IT',
        server: { locale: 'sc-IT', defaultValue: '2026-11' },
        client: { locale: 'sc-IT', defaultValue: '2026-11' },
      },
      {
        name: 'a year and month in ksh',
        server: { locale: 'ksh', defaultValue: '2026-11' },
        client: { locale: 'ksh', defaultValue: '2026-11' },
      },
      {
        name: 'a Persian year and month in ksh',
        server: {
          locale: 'ksh',
          calendar: 'persian',
          defaultValue: '2026-11-14',
          granularity: 'month',
        },
        client: {
          locale: 'ksh',
          calendar: 'persian',
          defaultValue: '2026-11-14',
          granularity: 'month',
        },
      },
      {
        name: 'a Buddhist date in my-MM',
        server: { locale: 'my-MM', calendar: 'buddhist', defaultValue: '2026-11-14' },
        client: { locale: 'my-MM', calendar: 'buddhist', defaultValue: '2026-11-14' },
      },
      {
        name: 'a zoned Japanese value in my-MM',
        server: {
          locale: 'my-MM',
          calendar: 'japanese',
          defaultValue: '2026-11-14T15:04[Asia/Tokyo]',
        },
        client: {
          locale: 'my-MM',
          calendar: 'japanese',
          defaultValue: '2026-11-14T15:04[Asia/Tokyo]',
        },
      },
    ])('hydrates $name with no message', async ({ server, client }) => {
      const serverHtml = await renderOnServer(HYDRATION_FILE, server);

      await hydrate(DateFieldRootHydration, { serverHtml, props: client });
    });

    // An engine with other `Intl` data can put the time zone name in the place of a separator. Each
    // segment keeps its place, so only the two spans differ. The case swaps them in the server HTML.
    it('hydrates a server layout with the time zone name in the place of a separator', async () => {
      const props = {
        locale: 'en-US',
        defaultValue: '2026-11-14T15:04[Asia/Tokyo]',
        hourCycle: 24,
      };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      const [separator, zoneName] = Array.from(
        serverHtml.matchAll(/<span[^>]*>[^<]*<\/span>/g),
      ).slice(-2);

      expect(separator?.[0]).toContain('data-type="literal"');
      expect(zoneName?.[0]).toContain('data-type="timeZoneName"');

      const separatorEnd = separator!.index + separator![0].length;
      const swappedHtml =
        serverHtml.slice(0, separator!.index) +
        zoneName![0] +
        serverHtml.slice(separatorEnd, zoneName!.index) +
        separator![0] +
        serverHtml.slice(zoneName!.index + zoneName![0].length);

      await hydrate(DateFieldRootHydration, { serverHtml: swappedHtml, props });
    });
  });
});
