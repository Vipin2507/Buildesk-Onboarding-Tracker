import { useQuery, useQueryClient } from "@tanstack/react-query";

import { authMe, authLogout } from "@/lib/api";
import type { User } from "@/types";

export const sessionKeys = {
  me: ["auth", "me"] as const,
};

export function useSession() {
  return useQuery({
    queryKey: sessionKeys.me,
    queryFn: async () => {
      const res = await authMe();
      return res.user as User | null;
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useCurrentUser() {
  const { data: user, isLoading, isFetching, error } = useSession();
  return { user: user ?? undefined, isLoading: isLoading || isFetching, error };
}

export async function logoutAndClear(queryClient: ReturnType<typeof useQueryClient>) {
  await authLogout();
  await queryClient.invalidateQueries({ queryKey: sessionKeys.me });
  queryClient.clear();
}
