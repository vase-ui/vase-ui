// https://github.com/mui/mui-x/blob/master/packages/x-internals/src/fastArrayCompare/fastArrayCompare.ts
type ItemComparer<Item> = (a: Item, b: Item) => boolean;

export function areArraysEqual<Item>(
  array1: readonly Item[],
  array2: readonly Item[],
  itemComparer: ItemComparer<Item> = Object.is,
): boolean {
  const { length } = array1;

  if (length !== array2.length) {
    return false;
  }

  for (let i = 0; i < length; i += 1) {
    if (!itemComparer(array1[i], array2[i])) {
      return false;
    }
  }

  return true;
}
