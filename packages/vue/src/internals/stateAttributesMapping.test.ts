import { expect, describe, it } from 'vitest';
import { transitionStatusMapping } from './stateAttributesMapping';

// Every animated component emits these attributes, so pin the names against literals: comparing
// against the constants the mapping already reads would pass through any rename.
describe('shared state-attribute mappings', () => {
  describe('transitionStatusMapping', () => {
    it('emits the transition data attributes', () => {
      expect(transitionStatusMapping.transitionStatus('starting')).toEqual({
        'data-starting-style': '',
      });
      expect(transitionStatusMapping.transitionStatus('ending')).toEqual({
        'data-ending-style': '',
      });
    });

    it('emits nothing outside a transition', () => {
      expect(transitionStatusMapping.transitionStatus('idle')).toBe(null);
      expect(transitionStatusMapping.transitionStatus(undefined)).toBe(null);
    });
  });
});
