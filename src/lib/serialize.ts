export function toJSON<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc));
}
