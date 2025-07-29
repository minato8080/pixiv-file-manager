export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasProp<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): key is K & keyof T {
  return key in obj;
}

export function getStringValue(
  opt: Record<string, unknown>,
  keyProp: string
): string | undefined {
  const value = opt[keyProp];
  return typeof value === "string" ? value : undefined;
}
