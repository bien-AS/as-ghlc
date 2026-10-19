"use client";

import { useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list-row";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import {
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/hooks/use-notifications";
import { notificationText, UNREAD_META } from "@/lib/notifications/rules";
import type { Notification } from "@/lib/notifications/schemas";
import { cn } from "@/lib/utils";

import { leadHref } from "../navigation";

/** Notifications (spec 08): what needs the user, newest first, each opening its lead. */
export function NotificationsScreen() {
  return (
    <>
      <PageHeader
        title="Notifications"
        description="What needs you, newest first. Selecting one opens its lead."
      />
      <NotificationList />
      <p className="max-w-[65ch] text-pretty text-muted-foreground">
        Sample data: these are examples drawn from the sample leads, and new
        ones do not arrive live. The list catches up when you return to this
        window.
      </p>
    </>
  );
}

function NotificationList() {
  const notifications = useNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();

  if (notifications.isPending) return <NotificationListSkeleton />;

  if (notifications.isError && !notifications.data) {
    return (
      <ErrorState
        title="Your notifications could not be loaded"
        description="Nothing was changed. Check your connection and try again."
        retrying={notifications.isFetching}
        onRetry={() => notifications.refetch()}
      />
    );
  }

  const items = notifications.data.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing needs you right now"
        description="Suspects to review, signed proposals and invoice drafts for your leads appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Read out when it changes, so marking one read is confirmed in words. */}
      <p aria-live="polite" className="min-h-6 text-muted-foreground">
        {unread === undefined
          ? null
          : unread === 0
            ? "All read"
            : `${unread} unread`}
      </p>

      <ul className="divide-y divide-border overflow-hidden rounded-panel bg-card ring-1 ring-border">
        {items.map((notification) => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            onRead={() => markRead.mutate(notification.id)}
          />
        ))}
      </ul>

      {(notifications.hasNextPage || notifications.isFetchNextPageError) && (
        <div className="flex min-h-9 items-center justify-center">
          {notifications.isFetchNextPageError ? (
            <p role="alert" className="flex flex-wrap items-center gap-2">
              More notifications could not be loaded.
              <Button size="sm" onClick={() => notifications.fetchNextPage()}>
                Try again
              </Button>
            </p>
          ) : (
            <Button
              loading={notifications.isFetchingNextPage}
              onClick={() => notifications.fetchNextPage()}
              className="max-nav:min-h-11 pointer-coarse:min-h-11"
            >
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: () => void;
}) {
  const { lead, read } = notification;
  const link = useRef<HTMLAnchorElement>(null);

  return (
    // The row's hover tone reaches under the control beside it, so the row reads as one.
    <li className="flex items-stretch has-[[data-slot=list-row]:focus-visible]:bg-secondary has-[[data-slot=list-row]:hover]:bg-secondary">
      <ListRow
        ref={link}
        href={leadHref(lead.id)}
        // Opening a notification marks it read (spec 08).
        onClick={() => {
          if (!read) onRead();
        }}
        className="flex min-w-0 flex-1 flex-col gap-1 nav:flex-row nav:items-center nav:gap-4"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* Unread is a word and a weight, never a colour alone. */}
            <span className={cn("text-pretty", !read && "font-semibold")}>
              {notificationText(notification.type, lead)}
            </span>
            {!read && (
              <Badge variant={UNREAD_META.tone}>{UNREAD_META.label}</Badge>
            )}
          </span>
          <span
            title={lead.company ?? undefined}
            className="truncate text-muted-foreground"
          >
            {lead.company ?? "No company given"}
          </span>
        </span>
        <LocalTime
          value={notification.createdAt}
          className="shrink-0 text-muted-foreground tabular-nums"
        />
      </ListRow>

      {/* A sibling of the link, not inside it: it does not open the lead. */}
      <span className="flex shrink-0 items-center justify-end pr-4 nav:w-28">
        {read ? (
          <span className="hidden text-muted-foreground nav:block">Read</span>
        ) : (
          <Button
            size="sm"
            aria-label={`Mark read: ${notificationText(notification.type, lead)}`}
            onClick={() => {
              // This control is about to leave the row; focus stays on the row.
              link.current?.focus();
              onRead();
            }}
            className="max-nav:min-h-11 pointer-coarse:min-h-11"
          >
            Mark read
          </Button>
        )}
      </span>
    </li>
  );
}

function NotificationListSkeleton() {
  return (
    <output
      aria-label="Loading notifications"
      className="mt-8 divide-y divide-border overflow-hidden rounded-panel bg-card ring-1 ring-border"
    >
      {["a", "b", "c", "d", "e", "f"].map((row) => (
        <div
          key={row}
          className="flex flex-col gap-2 px-4 py-3 nav:flex-row nav:items-center nav:gap-4"
        >
          <span className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-3.5 w-32" />
          </span>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="hidden h-7 w-24 nav:block" />
        </div>
      ))}
    </output>
  );
}
