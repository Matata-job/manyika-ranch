/** Normalize GET /api/animals response (paginated object or legacy array). */
export function parseAnimalsList<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { animals?: unknown }).animals)
  ) {
    return (data as { animals: T[] }).animals;
  }
  return [];
}

export type AnimalsListResponse<T = unknown> = {
  animals: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export function parseAnimalsPage<T = unknown>(
  data: unknown
): AnimalsListResponse<T> {
  if (Array.isArray(data)) {
    return {
      animals: data as T[],
      total: data.length,
      limit: data.length,
      offset: 0,
      hasMore: false,
    };
  }
  const obj = data as Partial<AnimalsListResponse<T>> | null;
  const animals = Array.isArray(obj?.animals) ? obj!.animals : [];
  return {
    animals,
    total: typeof obj?.total === "number" ? obj.total : animals.length,
    limit: typeof obj?.limit === "number" ? obj.limit : animals.length,
    offset: typeof obj?.offset === "number" ? obj.offset : 0,
    hasMore: Boolean(obj?.hasMore),
  };
}
