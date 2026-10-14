import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { AccessError, enforceRoute } from "@/lib/data/users";
import { listValidationLog } from "@/lib/data/validation-log";
import { validationLogOptions } from "@/lib/queries/validation-log";
import { getQueryClient } from "@/lib/query-client";

import { ValidationLogScreen } from "../_components/validation-log-screen";
import { VALIDATION_LOG_HREF } from "../navigation";

export const metadata: Metadata = {
  title: "Validation log · Authority Solutions",
};

export default async function ValidationLogPage() {
  await enforceRoute(VALIDATION_LOG_HREF);

  const queryClient = getQueryClient();
  let notAllowed = false;
  try {
    await queryClient.fetchQuery({
      ...validationLogOptions,
      queryFn: listValidationLog,
    });
  } catch (error) {
    if (error instanceof AccessError && error.code === "forbidden") {
      notAllowed = true;
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ValidationLogScreen notAllowed={notAllowed} />
    </HydrationBoundary>
  );
}
