import { apiClient, request } from "@/lib/api-client";
import { buildQuery, toPaginated } from "@/lib/api-utils";
import type { Category, Paginated } from "@/types/ticket";

/**
 * Categories service. Endpoints (FastAPI):
 *   GET    /categories            (active categories; admin may pass include_inactive=1)
 *   POST   /categories            (admin)
 *   PATCH  /categories/{id}       (admin — rename/description/activate/deactivate)
 */

export interface CategoryListParams {
  include_inactive?: boolean;
  page?: number;
  page_size?: number;
}

export interface CategoryInput {
  name: string;
  description?: string;
  is_active?: boolean;
}

export async function listCategories(
  params: CategoryListParams = {}
): Promise<Paginated<Category>> {
  const res = await request(() =>
    apiClient.get("/categories", {
      params: buildQuery({
        include_inactive: params.include_inactive ? "1" : undefined,
        page: params.page,
        page_size: params.page_size ?? 100,
      }),
    })
  );
  return toPaginated<Category>(res);
}

/** Active categories only — used by ticket create/edit forms. */
export async function listActiveCategories(): Promise<Category[]> {
  const page = await listCategories({ include_inactive: false });
  return page.items.filter((c) => c.is_active !== false);
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  return request(() => apiClient.post("/categories", input));
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>
): Promise<Category> {
  return request(() => apiClient.patch(`/categories/${id}`, input));
}
