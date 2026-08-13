import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string;
  username: string | null;
  first_name: string;
  last_name: string;
  national_id: string | null;
  phone: string | null;
  birth_date: string | null;
  city: string | null;
  network_name: string | null;
  credit: number;
  created_at: string;
};

export type SessionState = {
  user: User | null;
  profile: Profile | null;
  roles: string[];
  isStaff: boolean;
  isAdmin: boolean;
};

export const sessionQueryKey = ["session"] as const;

export async function loadSession(): Promise<SessionState> {
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;
  if (!user) return { user: null, profile: null, roles: [], isStaff: false, isAdmin: false };

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role as string);
  return {
    user,
    profile: (profile as Profile | null) ?? null,
    roles,
    isStaff: roles.includes("admin") || roles.includes("support"),
    isAdmin: roles.includes("admin"),
  };
}

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: loadSession,
    staleTime: 30_000,
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  };
}
