import { apiClient, request } from "@/lib/api-client";
import { buildQuery, toPaginated } from "@/lib/api-utils";
import type { Paginated } from "@/types/ticket";
import type { User } from "@/types/auth";
import type { UpdateUserRequest, UserListParams } from "@/types/notifications";

/**
 * Users service (admin). Endpoints (FastAPI):
 *   GET   /users              (admin — list/search/role filter)
 *   GET   /users/{id}         (admin)
 *   PATCH /users/{id}         (admin — role / is_active)
 */

export async function listUsers(
  params: UserListParams = {}
): Promise<Paginated<User>> {
  const res = await request(() =>
    apiClient.get("/users", {
      params: buildQuery({
        page: params.page,
        page_size: params.page_size,
        search: params.search,
        role: params.role,
      }),
    })
  );
  return toPaginated<User>(res);
}

export async function getUser(id: string): Promise<User> {
  return request(() => apiClient.get(`/users/${id}`));
}

export async function updateUser(
  id: string,
  payload: UpdateUserRequest
): Promise<User> {
  return request(() => apiClient.patch(`/users/${id}`, payload));
}
