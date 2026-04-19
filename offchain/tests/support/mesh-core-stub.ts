/**
 * Vitest-only stub for `@meshsdk/core` entrypoints used by `src/types.ts`.
 * The published SDK pulls optional sodium binaries that are not always
 * present in minimal installs; serialiser tests only need these shapes.
 */
export function conStr0(fields: unknown[]) {
  return { constructor: 0, fields };
}

export function conStr1(fields: unknown[]) {
  return { constructor: 1, fields };
}

export function byteString(bytes: string) {
  return { bytes };
}

export function integer(n: bigint | number) {
  return n;
}
