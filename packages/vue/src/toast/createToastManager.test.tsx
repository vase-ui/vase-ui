import { describe, expect, it } from 'vitest';
import * as Toast from './index.parts';

describe('createToastManager', () => {
  describe('add', () => {
    it('returns a toast id', () => {
      const toastManager = Toast.createToastManager();

      const toastId = toastManager.add({
        title: 'title',
      });

      expect(toastId).toBeTypeOf('string');
    });
  });
});
