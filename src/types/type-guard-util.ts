export type Object = Record<PropertyKey, unknown>;

export function isObject(value: unknown): value is Object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPropertyKey(value: unknown): value is PropertyKey {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "symbol"
  );
}

export function hasProp<O extends Object, K extends PropertyKey>(
  obj: O,
  key: K
): key is K & keyof O {
  return key in obj;
}

export function inferObjKey<T>(
  obj: unknown,
  key: unknown,
  callback?: (obj: Object, key: PropertyKey) => T | undefined
) {
  const inferResult =
    isObject(obj) && isPropertyKey(key) && hasProp(obj, key)
      ? ([obj, key] as [Object, keyof typeof obj])
      : undefined;

  let callbackResult: T | undefined;
  if (inferResult && callback) {
    const [obj, key] = inferResult;
    callbackResult = callback(obj, key);
  }

  return { inferResult, callbackResult };
}

export function inferVal<T extends Object, K extends keyof T>(
  obj: T,
  key: K,
  val: unknown
): val is T[K] {
  return (
    isObject(obj) && isPropertyKey(key) && hasProp(obj, key) && obj[key] === val
  );
}

export function getStringOnly(
  obj: Object,
  key: PropertyKey
): string | undefined {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}
