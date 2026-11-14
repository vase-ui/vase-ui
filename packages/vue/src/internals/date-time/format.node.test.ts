import { runInNewContext } from 'node:vm';
import { Temporal as BasicTemporal } from 'temporal-polyfill/implementation';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { displayCalendar } from './displayCalendar';
import { localeCalendar, weekInfo } from './format';

describe('with the polyfill that has no calendar but ISO and Gregorian', () => {
  function useBasicPolyfill() {
    vi.stubGlobal('Temporal', BasicTemporal);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
  }

  it.each([
    { locale: 'en-US', expected: 'gregory' },
    { locale: 'th-TH', expected: 'gregory' },
    { locale: 'fa-IR', expected: 'gregory' },
    { locale: 'en-US-u-ca-hebrew', expected: 'gregory' },
    { locale: 'en-US-u-ca-iso8601', expected: 'iso8601' },
  ])('gives $expected for the locale $locale', ({ locale, expected }) => {
    useBasicPolyfill();
    expect(localeCalendar(locale)).toBe(expected);
  });

  it('shows an ISO date in Gregorian for a locale of another calendar', () => {
    useBasicPolyfill();
    expect(displayCalendar(undefined, BasicTemporal.PlainDate.from('2026-11-14'), 'th-TH')).toBe(
      'gregory',
    );
  });
});

describe('weekInfo', () => {
  it('reads a locale that another realm made', () => {
    const foreign: Intl.Locale = runInNewContext("new Intl.Locale('en-GB')");
    expect(foreign instanceof Intl.Locale).toBe(false);
    expect(weekInfo(foreign)).toEqual({ firstDay: 1, weekend: [6, 7] });
    expect(weekInfo([foreign, 'en-US']).firstDay).toBe(1);
  });
});
