import { describe, expect, it } from 'vitest';
import type { DateTimeFieldSegmentView } from './DateTimeFieldContext';
import { getSegmentAttributes } from './segmentAttributes';

const view: DateTimeFieldSegmentView = {
  number: 11,
  text: '11',
  placeholder: 'mm',
  min: 1,
  max: 12,
  valueText: 'November',
  label: 'month',
  size: 2,
  id: 'month-id',
};

describe('getSegmentAttributes', () => {
  it('gives the attributes of a numeric segment from its view', () => {
    expect(getSegmentAttributes('month', view)).toEqual({
      inputmode: 'numeric',
      size: 2,
      placeholder: 'mm',
      'aria-label': 'month',
      'aria-valuenow': 11,
      'aria-valuemin': 1,
      'aria-valuemax': 12,
      'aria-valuetext': 'November',
    });
  });

  it('gives the day period a text input mode, and gives an empty segment no number', () => {
    const attributes = getSegmentAttributes('dayPeriod', {
      ...view,
      number: undefined,
      valueText: 'Empty',
    });

    expect(attributes.inputmode).toBe('text');
    expect(attributes['aria-valuenow']).toBe(undefined);
    expect(attributes['aria-valuetext']).toBe('Empty');
  });
});
