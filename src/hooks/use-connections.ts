"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  ConnectInput,
  Connection,
  ConnectionType,
  ImportResult,
  StageMapping,
  StageMappingInput,
} from "@/lib/connections/schemas";
import { connectionsOptions } from "@/lib/queries/connections";

/*
 * Every client call for Connections lives here (ADR-0001). Nothing here knows
 * the data is sample data (ADR-0006).
 */

export function useConnections(enabled = true) {
  return useQuery({
    ...connectionsOptions,
    enabled,
    // A role that is refused will not be allowed on a second try.
    retry: false,
  });
}

/**
 * One write. `apply` puts the answer into the cached list; a refused or failed
 * write reads the list again, because the Connection may have changed elsewhere.
 */
function useConnectionWrite<TInput, TResult>(
  request: (input: TInput) => [path: string, init: RequestInit],
  apply?: (connections: Connection[], result: TResult) => Connection[],
) {
  const queryClient = useQueryClient();
  const { queryKey } = connectionsOptions;
  return useMutation({
    mutationFn: (input: TInput) => apiFetch<TResult>(...request(input)),
    // Nothing a write was given outlives the control that sent it: the connect
    // form's key leaves the mutation cache as soon as that form is gone.
    gcTime: 0,
    onSuccess: (result) => {
      if (!apply) return;
      queryClient.setQueryData(
        queryKey,
        (connections) => connections && apply(connections, result),
      );
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** Writes that answer with the Connection as it now is. */
const replace = (connections: Connection[], updated: Connection) =>
  connections.map((connection) =>
    connection.type === updated.type ? updated : connection,
  );

const path = (type: ConnectionType, rest = "") =>
  `/api/connections/${type}${rest}`;

export const useConnect = () =>
  useConnectionWrite<{ type: ConnectionType; input: ConnectInput }, Connection>(
    ({ type, input }) => [
      path(type),
      { method: "POST", body: JSON.stringify(input) },
    ],
    replace,
  );

export const useDisconnect = () =>
  useConnectionWrite<ConnectionType, Connection>(
    (type) => [path(type), { method: "DELETE" }],
    replace,
  );

export const useSyncNow = () =>
  useConnectionWrite<"crm", Connection>(
    (type) => [path(type, "/sync"), { method: "POST" }],
    replace,
  );

/** Answers with the counts; the Connections themselves do not change. */
export const useImportLeads = () =>
  useConnectionWrite<void, ImportResult>(() => [
    path("crm", "/import"),
    { method: "POST" },
  ]);

export const useSaveStageMapping = () =>
  useConnectionWrite<StageMappingInput, StageMapping>(
    (input) => [
      path("crm", "/stage-mapping"),
      { method: "PUT", body: JSON.stringify(input) },
    ],
    (connections, stageMapping) =>
      connections.map((connection) =>
        connection.type === "crm"
          ? { ...connection, stageMapping }
          : connection,
      ),
  );
