import { describe, expect, it, vi } from 'vitest';
import FloatingPortal from '../utils/popups/portal/FloatingPortal.vue';
import FloatingPortalLite from '../utils/popups/portal/FloatingPortalLite.vue';
import { withoutPropsOf } from './withoutPropsOf';

describe('withoutPropsOf', () => {
  it.each([
    { name: 'inPlace' },
    { name: 'in-place' },
    { name: 'portalOwnerRole' },
    { name: 'portal-owner-role' },
  ])('drops the declared prop $name', ({ name }) => {
    expect(withoutPropsOf({ [name]: '' }, FloatingPortal)).toEqual({});
  });

  it('keeps the values of attributes that the portal does not declare', () => {
    const attributes = {
      class: 'popup',
      style: 'color: red',
      id: 'content',
      'data-testid': 'portal',
      'aria-label': 'Details',
      onClick: vi.fn(),
    };
    expect(withoutPropsOf({ ...attributes, inPlace: true }, FloatingPortal)).toEqual(attributes);
    expect(withoutPropsOf({ 'in-place': '' }, FloatingPortalLite)).toEqual({ 'in-place': '' });
  });

  it('copies all attributes for a component with no props option', () => {
    const attributes = { id: 'content' };
    const result = withoutPropsOf(attributes, {});
    expect(result).toEqual(attributes);
    expect(result).not.toBe(attributes);
  });
});
