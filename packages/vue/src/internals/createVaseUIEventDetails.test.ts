import { describe, expect, it } from 'vitest';
import { createChangeEventDetails, createGenericEventDetails } from './createVaseUIEventDetails';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from './createVaseUIEventDetails';
import { REASONS } from './reasons';

describe('VUE-123: event detail inference', () => {
  it('keeps change details consistent with their arguments', () => {
    type Details = VaseUIChangeEventDetails<typeof REASONS.none>;
    const acceptDetails = (details: Details) => details;

    // @ts-expect-error The expected type cannot replace the reason.
    const wrongReason: Details = createChangeEventDetails(REASONS.keyboard);
    // @ts-expect-error An inline call must keep its reason.
    const inline = acceptDetails(createChangeEventDetails(REASONS.keyboard));
    // @ts-expect-error The expected type cannot supply absent custom properties.
    const missingProperty: VaseUIChangeEventDetails<typeof REASONS.none, { value: number }> =
      createChangeEventDetails(REASONS.none);

    expect(wrongReason.reason).toBe(REASONS.keyboard);
    expect(inline.reason).toBe(REASONS.keyboard);
    expect('value' in missingProperty).toBe(false);
  });

  it('keeps generic details consistent with their arguments', () => {
    type Details = VaseUIGenericEventDetails<typeof REASONS.none>;
    const acceptDetails = (details: Details) => details;

    // @ts-expect-error The expected type cannot replace the reason.
    const wrongReason: Details = createGenericEventDetails(REASONS.keyboard);
    // @ts-expect-error An inline call must keep its reason.
    const inline = acceptDetails(createGenericEventDetails(REASONS.keyboard));
    // @ts-expect-error The expected type cannot supply absent custom properties.
    const missingProperty: VaseUIGenericEventDetails<typeof REASONS.none, { value: number }> =
      createGenericEventDetails(REASONS.none);

    expect(wrongReason.reason).toBe(REASONS.keyboard);
    expect(inline.reason).toBe(REASONS.keyboard);
    expect('value' in missingProperty).toBe(false);
  });
});
