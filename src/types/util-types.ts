export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];
