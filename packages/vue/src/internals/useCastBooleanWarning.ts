import { warn } from '../common/warn';
import {
  getCallerInstance,
  hasBooleanType,
  hasUnboundSlot,
  isCastToFalseWhenAbsent,
  readComponentName,
  readDeclaredProps,
  readGivenProp,
  readGivenProps,
  readOwner,
  readPropValue,
} from './callerProps';
import type { CallerInstance } from './callerProps';

const checkedParts = new WeakSet<CallerInstance>();

function findCastingWrapper(part: CallerInstance, prop: string): CallerInstance | null {
  for (let owner = readOwner(part); owner; owner = readOwner(owner)) {
    // An unbound slot gives its vnodes the owner that calls it, even when the caller wrote them.
    if (checkedParts.has(owner) || hasUnboundSlot(owner)) {
      return null;
    }
    const given = readGivenProp(owner, prop);
    if (!given.isSet) {
      return isCastToFalseWhenAbsent(readDeclaredProps(owner)[prop]) &&
        readPropValue(owner, prop) === false
        ? owner
        : null;
    }
    if (given.value !== false) {
      return null;
    }
  }
  return null;
}

/**
 * Warns when a wrapper casts an absent Boolean prop that replaces a default or parent value.
 * Call it in `setup`, inside `if (process.env.NODE_ENV !== 'production')`.
 */
export function useCastBooleanWarning(partName: string): void {
  const part = getCallerInstance();
  if (!part) {
    return;
  }
  checkedParts.add(part);
  const declared = readDeclaredProps(part);
  for (const [prop, value] of readGivenProps(part)) {
    const option = declared[prop];
    if (
      value !== false ||
      !option ||
      !hasBooleanType(option) ||
      !Object.hasOwn(option, 'default') ||
      option.default === false
    ) {
      continue;
    }
    const wrapper = findCastingWrapper(part, prop);
    if (wrapper) {
      const wrapperName = readComponentName(wrapper);
      warn(
        `${wrapperName} gives \`${prop}: false\` to <${partName}>, but its caller did not set \`${prop}\`.`,
        `Vue sets an absent Boolean prop to \`false\`, so the part cannot use its default or the value of its parent.`,
        `Give \`${prop}\` the default \`undefined\` in ${wrapperName}, or forward the props with \`useForwardProps\`.`,
      );
    }
  }
}
