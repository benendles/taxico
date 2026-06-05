"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { session } from "./api";
import type { User } from "./types";

/**
 * Client-side route guard. Returns the current user, or redirects to /login
 * (with role enforcement) when access is not permitted.
 */
export function useRequireAuth(role?: User["role"]) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const current = session.user();
    if (!current || !session.token()) {
      router.replace(`/login${role ? `?role=${role}` : ""}`);
      return;
    }
    if (role && current.role !== role) {
      router.replace(`/${current.role}`);
      return;
    }
    setUser(current);
    setChecked(true);
  }, [role, router]);

  return { user, checked };
}
