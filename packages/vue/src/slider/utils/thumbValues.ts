import { clamp } from '../../common/clamp';

export function asc(a: number, b: number) {
  return a - b;
}

export function getMidpoint(element: HTMLElement, vertical: boolean): number {
  const rect = element.getBoundingClientRect();
  return vertical ? (rect.top + rect.bottom) / 2 : (rect.left + rect.right) / 2;
}

export function getSliderValue(
  valueInput: number,
  index: number,
  min: number,
  max: number,
  range: boolean,
  values: readonly number[],
) {
  const clamped = clamp(valueInput, min, max);

  if (!range) {
    return clamped;
  }

  const output = values.slice();
  // Bound the new value to the thumb's neighbours.
  output[index] = clamp(clamped, values[index - 1] ?? -Infinity, values[index + 1] ?? Infinity);
  return output.sort(asc);
}

export function getDecimalPrecision(num: number) {
  if (num === 0) {
    return 0;
  }

  // This handles the case when num is very small (0.00000001), js will turn this into 1e-8.
  // When num is bigger than 1 or less than -1 it won't get converted to this notation so it's fine.
  if (Math.abs(num) < 1) {
    /* eslint-disable @typescript-eslint/no-non-null-assertion -- A number below 1 has an exponent that starts with `e-`, so the split has two parts. */
    const parts = num.toExponential().split('e-');
    const matissaDecimalPart = parts[0]!.split('.')[1];
    return (matissaDecimalPart ? matissaDecimalPart.length : 0) + parseInt(parts[1]!, 10);
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
  }

  const decimalPart = num.toString().split('.')[1];
  return decimalPart ? decimalPart.length : 0;
}

export function roundValueToStep(value: number, step: number, min: number) {
  const nearest = Math.round((value - min) / step) * step + min;
  return Number(nearest.toFixed(Math.max(getDecimalPrecision(step), getDecimalPrecision(min))));
}

export function validateMinimumDistance(
  values: number | readonly number[],
  step: number,
  minStepsBetweenValues: number,
) {
  if (!Array.isArray(values)) {
    return true;
  }

  const minDistance = step * minStepsBetweenValues;
  for (let i = 0; i < values.length - 1; i += 1) {
    if (!(Math.abs(values[i] - values[i + 1]) >= minDistance)) {
      return false;
    }
  }
  return true;
}

export function getPushedThumbValues(
  values: readonly number[],
  index: number,
  nextValue: number,
  min: number,
  max: number,
  step: number,
  minStepsBetweenValues: number,
  initialValues?: readonly number[],
): number[] {
  const nextValues = values.slice();
  const minValueDifference = step * minStepsBetweenValues;
  const lastIndex = nextValues.length - 1;
  const baseInitialValues = initialValues ?? values;

  const indexMin = min + index * minValueDifference;
  const indexMax = max - (lastIndex - index) * minValueDifference;
  nextValues[index] = clamp(nextValue, indexMin, indexMax);

  /* eslint-disable @typescript-eslint/no-non-null-assertion -- Each index is between 0 and `lastIndex`, and `initialValues` has a value for each thumb. */
  for (let i = index + 1; i <= lastIndex; i += 1) {
    const minAllowed = nextValues[i - 1]! + minValueDifference;
    const maxAllowed = max - (lastIndex - i) * minValueDifference;
    const initialValue = baseInitialValues[i]!;
    let candidate = Math.max(nextValues[i]!, minAllowed);

    if (initialValue < candidate) {
      candidate = Math.max(initialValue, minAllowed);
    }

    nextValues[i] = clamp(candidate, minAllowed, maxAllowed);
  }

  for (let i = index - 1; i >= 0; i -= 1) {
    const maxAllowed = nextValues[i + 1]! - minValueDifference;
    const minAllowed = min + i * minValueDifference;
    const initialValue = baseInitialValues[i]!;
    let candidate = Math.min(nextValues[i]!, maxAllowed);

    if (initialValue > candidate) {
      candidate = Math.min(initialValue, maxAllowed);
    }

    nextValues[i] = clamp(candidate, minAllowed, maxAllowed);
  }

  for (let i = 0; i <= lastIndex; i += 1) {
    nextValues[i] = Number(nextValues[i]!.toFixed(12));
  }
  /* eslint-enable @typescript-eslint/no-non-null-assertion */

  return nextValues;
}

export type ThumbCollisionBehavior = 'push' | 'swap' | 'none';

export interface ResolveThumbCollisionResult {
  value: number | number[];
  thumbIndex: number;
  didSwap: boolean;
}

export function resolveThumbCollision(
  behavior: ThumbCollisionBehavior,
  values: readonly number[],
  currentValues: readonly number[] | null | undefined,
  initialValues: readonly number[] | null | undefined,
  pressedIndex: number,
  nextValue: number,
  min: number,
  max: number,
  step: number,
  minStepsBetweenValues: number,
): ResolveThumbCollisionResult {
  const activeValues = currentValues ?? values;
  const baselineValues = initialValues ?? values;
  if (activeValues.length <= 1) {
    return {
      value: nextValue,
      thumbIndex: 0,
      didSwap: false,
    };
  }

  const minValueDifference = step * minStepsBetweenValues;

  if (behavior === 'push') {
    return {
      value: getPushedThumbValues(
        activeValues,
        pressedIndex,
        nextValue,
        min,
        max,
        step,
        minStepsBetweenValues,
      ),
      thumbIndex: pressedIndex,
      didSwap: false,
    };
  }

  const candidateValues = activeValues.slice();
  const previousNeighbor = candidateValues[pressedIndex - 1];
  const nextNeighbor = candidateValues[pressedIndex + 1];
  const lowerBound = previousNeighbor != null ? previousNeighbor + minValueDifference : min;
  const upperBound = nextNeighbor != null ? nextNeighbor - minValueDifference : max;
  const pressedValueAfterClamp = Number(clamp(nextValue, lowerBound, upperBound).toFixed(12));
  candidateValues[pressedIndex] = pressedValueAfterClamp;

  if (behavior !== 'swap') {
    return { value: candidateValues, thumbIndex: pressedIndex, didSwap: false };
  }

  /* eslint-disable @typescript-eslint/no-non-null-assertion -- Each index is the index of a thumb. A swap needs a neighbor, so `targetIndex` is in range. */
  const pressedInitialValue = activeValues[pressedIndex]!;
  const epsilon = 1e-7;

  const movingForward = nextValue > pressedInitialValue;
  const movingBackward = nextValue < pressedInitialValue;

  const shouldSwapForward =
    movingForward && nextNeighbor != null && nextValue >= nextNeighbor - epsilon;
  const shouldSwapBackward =
    movingBackward && previousNeighbor != null && nextValue <= previousNeighbor + epsilon;

  if (!shouldSwapForward && !shouldSwapBackward) {
    return {
      value: candidateValues,
      thumbIndex: pressedIndex,
      didSwap: false,
    };
  }

  const targetIndex = shouldSwapForward ? pressedIndex + 1 : pressedIndex - 1;

  const initialValuesForPush = candidateValues.map((_, index) => {
    if (index === pressedIndex) {
      return pressedValueAfterClamp;
    }

    const baseline = baselineValues[index];
    if (baseline != null) {
      return baseline;
    }

    return activeValues[index]!;
  });

  const nextValueForTarget = shouldSwapForward
    ? Math.max(nextValue, candidateValues[targetIndex]!)
    : Math.min(nextValue, candidateValues[targetIndex]!);
  /* eslint-enable @typescript-eslint/no-non-null-assertion */

  const adjustedValues = getPushedThumbValues(
    candidateValues,
    targetIndex,
    nextValueForTarget,
    min,
    max,
    step,
    minStepsBetweenValues,
    initialValuesForPush,
  );

  const previousValue = adjustedValues[pressedIndex - 1];
  const nextValueAfter = adjustedValues[pressedIndex + 1];

  let neighborLowerBound = previousValue != null ? previousValue + minValueDifference : min;
  neighborLowerBound = Math.max(neighborLowerBound, min + pressedIndex * minValueDifference);

  let neighborUpperBound = nextValueAfter != null ? nextValueAfter - minValueDifference : max;
  neighborUpperBound = Math.min(
    neighborUpperBound,
    max - (adjustedValues.length - 1 - pressedIndex) * minValueDifference,
  );

  const restoredValue = clamp(pressedValueAfterClamp, neighborLowerBound, neighborUpperBound);
  adjustedValues[pressedIndex] = Number(restoredValue.toFixed(12));

  return {
    value: adjustedValues,
    thumbIndex: targetIndex,
    didSwap: true,
  };
}
