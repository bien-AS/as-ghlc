"use client";

import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-auth";

/** Signs out first, then goes to /login, where Google always shows its account chooser. */
export function DifferentAccountButton() {
  const signOut = useSignOut();
  // Stays in progress after success: the page is being replaced.
  const leaving = signOut.isPending || signOut.isSuccess;

  return (
    <Button
      variant="primary"
      size="lg"
      className="w-full"
      loading={leaving}
      onClick={() => {
        if (!leaving) signOut.mutate();
      }}
    >
      Use a different account
    </Button>
  );
}
