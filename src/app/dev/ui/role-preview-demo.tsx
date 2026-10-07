"use client";

import { useState } from "react";

import { RolePreview } from "@/components/ui/role-preview";
import { ROLE_LABEL, ROLE_SEES, ROLES } from "@/lib/roles";

/** The role preview with a choice that only lives on this page. */
export function RolePreviewDemo() {
  const [role, setRole] = useState<string>("owner");
  return (
    <RolePreview
      value={role}
      onChange={setRole}
      options={ROLES.map((value) => ({
        value,
        label: ROLE_LABEL[value],
        sees: ROLE_SEES[value],
      }))}
      detail={
        role === "staff" ? "Staff is shown one sample rep's leads." : undefined
      }
    />
  );
}
