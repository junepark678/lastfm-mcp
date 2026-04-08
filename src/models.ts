export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationConfig {
  defaultPageSize: number;
  maxPageSize: number;
}

export function resolvePagination(
  input: PaginationInput,
  config: PaginationConfig,
): { page: number; limit: number } {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const requestedLimit = Math.max(1, Math.floor(input.limit ?? config.defaultPageSize));
  const limit = Math.min(requestedLimit, config.maxPageSize);

  return { page, limit };
}
