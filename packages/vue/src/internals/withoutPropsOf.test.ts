import { describe, expect, it, vi } from 'vitest';
import DrawerRoot from '../drawer/root/DrawerRoot.vue';
import PopupPortal from '../utils/popups/portal/PopupPortal.vue';
import { withoutPropsOf } from './withoutPropsOf';

describe('withoutPropsOf', () => {
  it.each([
    { name: 'guards' },
    { name: 'disabled' },
    { name: 'portalOwnerRole' },
    { name: 'portal-owner-role' },
  ])('drops the declared prop $name', ({ name }) => {
    expect(withoutPropsOf({ [name]: '' }, PopupPortal)).toEqual({});
  });

  it('drops handle and trigger-id from the attributes of a generic part', () => {
    expect(withoutPropsOf({ handle: {}, 'trigger-id': 'open', id: 'picker' }, DrawerRoot)).toEqual({
      id: 'picker',
    });
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
    expect(withoutPropsOf({ ...attributes, guards: true }, PopupPortal)).toEqual(attributes);
  });

  it('copies all attributes for a component with no props option', () => {
    const attributes = { id: 'content' };
    const result = withoutPropsOf(attributes, {});
    expect(result).toEqual(attributes);
    expect(result).not.toBe(attributes);
  });
});
