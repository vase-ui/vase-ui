import { expect, describe, it } from 'vitest';
import {
  popupStateMapping,
  pressableTriggerOpenStateMapping,
  triggerOpenStateMapping,
} from './popupStateMapping';

// Each popup family emits these attributes. No other test checks `data-anchor-hidden`, so without
// this file a rename of it causes no failure.
describe('popupStateMapping', () => {
  it('emits the open and closed data attributes', () => {
    expect(popupStateMapping.open(true)).toEqual({ 'data-open': '' });
    expect(popupStateMapping.open(false)).toEqual({ 'data-closed': '' });
  });

  it('emits the anchor-hidden data attribute only when the anchor is hidden', () => {
    expect(popupStateMapping.anchorHidden(true)).toEqual({ 'data-anchor-hidden': '' });
    expect(popupStateMapping.anchorHidden(false)).toBe(null);
  });

  it('emits the trigger data attributes only while open', () => {
    expect(triggerOpenStateMapping.open(true)).toEqual({ 'data-popup-open': '' });
    expect(triggerOpenStateMapping.open(false)).toBe(null);
  });

  it('emits the pressed data attribute on pressable triggers only while open', () => {
    expect(pressableTriggerOpenStateMapping.open(true)).toEqual({
      'data-popup-open': '',
      'data-pressed': '',
    });
    expect(pressableTriggerOpenStateMapping.open(false)).toBe(null);
  });
});
