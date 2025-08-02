export type Object = Record<PropertyKey, unknown>;

export function isObject(value: unknown): value is Object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPropertyKey(obj: Object, key: unknown): key is PropertyKey {
  return typeof key === "string" ||
    typeof key === "number" ||
    typeof key === "symbol"
    ? key in obj
    : false;
}

export function inferObjKey<T>(
  obj: unknown,
  key: unknown,
  callback: (obj: Object, key: PropertyKey) => T | undefined
): T | undefined {
  return isObject(obj) && isPropertyKey(obj, key)
    ? callback(obj, key)
    : undefined;
}

export function inferVal<T extends Object, K extends keyof T>(
  obj: T,
  key: K,
  val: unknown
): val is T[K] {
  return isObject(obj) && isPropertyKey(obj, key) && obj[key] === val;
}

export function getString(obj: Object, key: PropertyKey): string | undefined {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}

export function getNumber(obj: Object, key: PropertyKey): number | undefined {
  const value = obj[key];
  return typeof value === "number" ? value : undefined;
}
