import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { TimeField } from '@vase-ui/vue/time-field';
import { formatter } from '../../internals/date-time/format';
import { takeReportedMessages } from '../../../test/reportedMessages';
import TimeFieldRootHydration from './TimeFieldRootHydration.test.vue';

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? '';
}

function attribute(element: string, name: string) {
  return new RegExp(` ${name}="([^"]*)"`).exec(element)?.[1];
}

function hasAttribute(element: string, name: string) {
  return new RegExp(` ${name}[ =>]`).test(element);
}

const GROUP = /<div[^>]*role="group"[^>]*>/;
const INPUT = /<div[^>]*data-testid="input"[^>]*>/;
const HIDDEN_INPUT = /<input[^>]*aria-hidden="true"[^>]*>/;
const segmentTags = (html: string) => html.match(/<input[^>]* data-type="\w+"[^>]*>/g) ?? [];
// A server writes an empty `value` as a bare attribute.
const segments = (html: string) =>
  segmentTags(html).map((element) => [
    attribute(element, 'data-type'),
    /\svalue(?:="([^"]*)")?[\s>]/.exec(element)?.[1] ?? '',
  ]);

describe('<TimeField.Root /> on a server', () => {
  it('has no DOM, and renders the segments of the layout with the numbers of the value', async () => {
    expect(typeof document).toBe('undefined');

    const html = await renderToString(
      <TimeField.Root
        defaultValue={Temporal.PlainTime.from('15:04:33')}
        locale="de-DE"
        granularity="second"
      >
        <TimeField.Input />
      </TimeField.Root>,
    );

    expect(segments(html)).toEqual([
      ['hour', '15'],
      ['minute', '04'],
      ['second', '33'],
    ]);
  });

  it('writes the hour cycle, the day period and the literals of the locale', async () => {
    const html = await renderToString(
      <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')} locale="en-US">
        <TimeField.Input />
      </TimeField.Root>,
    );
    const [format, epoch] = formatter(
      Temporal.PlainTime.from('15:04'),
      { hour: 'numeric', minute: '2-digit' },
      'en-US',
    );
    const period = format.formatToParts(epoch).find(({ type }) => type === 'dayPeriod')?.value;

    expect(segments(html)).toEqual([
      ['hour', '3'],
      ['minute', '04'],
      ['dayPeriod', period],
    ]);
    expect(html).toContain('aria-valuemax="12"');
    expect(html).toContain('>:</span>');
  });

  it('renders the group and the hidden input with the attributes of the form', async () => {
    const html = await renderToString(
      <TimeField.Root
        defaultValue={Temporal.PlainTime.from('15:04')}
        name="alarm"
        form="clock"
        required
        autoComplete="off"
        minTime={Temporal.PlainTime.from('09:00')}
        maxTime={Temporal.PlainTime.from('17:30')}
        step={900}
      >
        <TimeField.Input />
      </TimeField.Root>,
    );
    const group = tag(html, GROUP);
    const input = tag(html, HIDDEN_INPUT);

    expect(hasAttribute(group, 'data-complete')).toBe(true);
    expect(hasAttribute(group, 'data-empty')).toBe(false);
    expect(hasAttribute(group, 'data-required')).toBe(true);
    expect(attribute(input, 'type')).toBe('time');
    expect(attribute(input, 'value')).toBe('15:04');
    expect(attribute(input, 'name')).toBe('alarm');
    expect(attribute(input, 'form')).toBe('clock');
    expect(attribute(input, 'autocomplete')).toBe('off');
    expect(attribute(input, 'min')).toBe('09:00');
    expect(attribute(input, 'max')).toBe('17:30');
    expect(attribute(input, 'step')).toBe('900');
    expect(attribute(input, 'tabindex')).toBe('-1');
    expect(hasAttribute(input, 'required')).toBe(true);
  });

  it.each([
    { name: 'a time', value: '15:04:33', type: 'time', text: '15:04:33' },
    {
      name: 'a date and time',
      value: '2026-11-14T15:04:33',
      type: 'datetime-local',
      text: '2026-11-14T15:04:33',
    },
    {
      name: 'a date and time in a zone',
      value: '2026-11-14T15:04:33[Asia/Tokyo]',
      type: 'text',
      text: '2026-11-14T15:04:33+09:00[Asia/Tokyo]',
    },
  ])('gives the hidden input the type and the text of $name', async ({ value, type, text }) => {
    const html = await renderToString(
      <TimeFieldRootHydration name="alarm" defaultValue={value} granularity="second" />,
    );
    const input = tag(html, HIDDEN_INPUT);

    expect(attribute(input, 'type')).toBe(type);
    expect(attribute(input, 'value')).toBe(text);
    expect(attribute(input, 'step')).toBe(type === 'text' ? undefined : '1');
  });

  it('renders an empty field with placeholders, and no value in the hidden input', async () => {
    const html = await renderToString(
      <TimeField.Root locale="en-US">
        <TimeField.Input />
      </TimeField.Root>,
    );

    expect(segments(html).map(([type]) => type)).toEqual(['hour', 'minute', 'dayPeriod']);
    expect(html).toContain('placeholder="hh"');
    expect(html).toContain('aria-valuetext="Empty"');
    expect(hasAttribute(tag(html, GROUP), 'data-empty')).toBe(true);
    expect(attribute(tag(html, HIDDEN_INPUT), 'value')).toBeUndefined();
  });

  it('marks what the browser can change while it hydrates, and writes the text of a literal', async () => {
    const html = await renderToString(
      <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')} locale="de-DE">
        <TimeField.Input data-testid="input" />
      </TimeField.Root>,
    );

    expect(attribute(tag(html, INPUT), 'data-allow-mismatch')).toBe('children');
    expect(
      html.match(/<input[^>]* data-type="\w+"[^>]* data-allow-mismatch="attribute"/g),
    ).toHaveLength(2);
    expect(html).toMatch(
      /<span(?=[^>]* data-type="literal")(?=[^>]* data-allow-mismatch="text")[^>]*>:<\/span>/,
    );
  });

  it.each([
    { name: 'before the field', label: 'before' as const },
    { name: 'after the field', label: 'after' as const },
  ])(
    'names and describes the group with the label $name and the description',
    async ({ label }) => {
      const html = await renderToString(<TimeFieldRootHydration label={label} description />);
      const labelTag = tag(html, /<label[^>]*data-testid="label"[^>]*>/);
      const labelId = attribute(labelTag, 'id');
      const descriptionId = attribute(tag(html, /<p[^>]*data-testid="description"[^>]*>/), 'id');

      expect(labelId).toBeTruthy();
      expect(attribute(tag(html, GROUP), 'aria-labelledby')).toBe(labelId);
      expect(attribute(tag(html, GROUP), 'aria-describedby')).toBe(descriptionId);
    },
  );

  it('gives each segment the style field-sizing: content in the server HTML', async () => {
    const html = await renderToString(
      <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')} locale="en-US">
        <TimeField.Input />
      </TimeField.Root>,
    );
    const tags = segmentTags(html);

    expect(tags).toHaveLength(3);
    for (const element of tags) {
      expect(attribute(element, 'style')).toContain('field-sizing:content');
    }
  });

  it('writes no style attribute when the style of the consumer unsets field-sizing', async () => {
    const html = await renderToString(
      <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')} locale="en-US">
        <TimeField.Input>
          {{
            segment: ({ segment }: { segment: TimeField.Input.Segment }) =>
              segment.editable ? (
                <TimeField.Segment segment={segment} style={{ fieldSizing: undefined }} />
              ) : (
                <TimeField.Literal segment={segment} />
              ),
          }}
        </TimeField.Input>
      </TimeField.Root>,
    );
    const tags = segmentTags(html);

    expect(tags).toHaveLength(3);
    for (const element of tags) {
      expect(hasAttribute(element, 'style')).toBe(false);
    }
  });
});

describe('the modules of the time field with no Temporal', () => {
  // A case that throws in `setup` is the last of its file.
  it('loads with no Temporal, and the first render throws a message that names it', async () => {
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    vi.resetModules();

    const { TimeField: TimeFieldWithoutTemporal } = await import('@vase-ui/vue/time-field');

    await expect(renderToString(<TimeFieldWithoutTemporal.Root />)).rejects.toThrow(
      'Vase UI: <TimeField.Root> needs the global `Temporal`, and this JavaScript engine does not have it.',
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
