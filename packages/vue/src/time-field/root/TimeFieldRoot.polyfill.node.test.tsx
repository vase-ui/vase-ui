import { expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { TimeField } from '@vase-ui/vue/time-field';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';
import TimeFieldRootHydration from './TimeFieldRootHydration.test.vue';

const nativeTemporal = globalThis.Temporal;

const SERVER_CASES: Record<string, Record<string, unknown>> = {
  'a time in en-US': { defaultValue: '15:04:33', locale: 'en-US', name: 'alarm' },
  'a time in ar-EG': { defaultValue: '15:04:33', locale: 'ar-EG', granularity: 'second' },
  'a time in de-DE with limits': {
    defaultValue: '15:04',
    locale: 'de-DE',
    minTime: '09:00',
    maxTime: '17:30',
    step: 900,
  },
  'a date and time': { defaultValue: '2026-11-14T15:04', locale: 'en-US' },
  'a date and time in a zone': { defaultValue: '2026-11-14T15:04[Asia/Tokyo]', locale: 'en-US' },
  'an empty time': { locale: 'en-US', required: true },
  'a label and a description': { label: 'before', description: true, locale: 'en-US' },
};

async function renderServerCases() {
  const html: Record<string, string> = {};
  for (const [name, props] of Object.entries(SERVER_CASES)) {
    html[name] = await renderToString(<TimeFieldRootHydration {...props} />);
  }
  return html;
}

// The native HTML comes before the polyfill.
const nativeHtml = await renderServerCases();

useTemporalPolyfill();

it('runs the cases on the polyfill and not on the native Temporal', () => {
  expect(Temporal).not.toBe(nativeTemporal);
  expect(Temporal.PlainTime.from('15:04')).not.toBeInstanceOf(nativeTemporal.PlainTime);
});

it('renders the same server HTML as the native Temporal', async () => {
  const polyfillHtml = await renderServerCases();

  expect(Object.keys(nativeHtml)).toEqual(Object.keys(SERVER_CASES));
  expect(polyfillHtml).toEqual(nativeHtml);
});

it('renders the parts for a time of the polyfill', async () => {
  const html = await renderToString(
    <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')} locale="en-US" name="alarm">
      <TimeField.Input />
    </TimeField.Root>,
  );

  expect(html).toContain('value="15:04"');
  expect(html).toContain('role="group"');
});
