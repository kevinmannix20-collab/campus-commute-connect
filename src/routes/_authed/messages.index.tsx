import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Bus, Car, MessageCircle, UserPlus } from "lucide-react";
import { useEffect } from "react";

import { PhoneShell } from "@/components/PhoneShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authed/messages/")({
  head: () => ({
    meta: [{ title: "Messages — Commute Mate" }],
  }),
  component: MessagesInboxScreen,
});

const notificationsQueryKey = ["my-notifications"];
const threadsQueryKey = ["my-message-threads"];

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function notificationText(n: {
  type: string;
  actor_display_name: string | null;
  preview: string | null;
}) {
  const who = n.actor_display_name ?? "Someone";
  if (n.type === "match") return `You matched with ${who}!`;
  if (n.type === "bus_join") return `${who} joined your bus group`;
  return `${who}: ${n.preview ?? ""}`;
}

function notificationLink(n: {
  type: string;
  match_id: string | null;
  bus_trip_request_id: string | null;
}) {
  if (n.match_id) return { threadType: "match" as const, threadId: n.match_id };
  if (n.bus_trip_request_id) return { threadType: "bus" as const, threadId: n.bus_trip_request_id };
  return null;
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "match") return <UserPlus className="size-4" />;
  if (type === "bus_join") return <Bus className="size-4" />;
  return <MessageCircle className="size-4" />;
}

function MessagesInboxScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_notifications");
      if (error) throw error;
      return data;
    },
  });

  const threads = useQuery({
    queryKey: threadsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_message_threads");
      if (error) throw error;
      return data;
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mark_all_notifications_read");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      queryClient.invalidateQueries({ queryKey: threadsQueryKey });
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
          queryClient.invalidateQueries({ queryKey: threadsQueryKey });
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: threadsQueryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  const unreadCount = (notifications.data ?? []).filter((n) => !n.read_at).length;

  return (
    <PhoneShell active="profile">
      <header className="flex items-center gap-3 p-6 pb-4">
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Back"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-balance font-serif text-2xl font-medium leading-tight text-forest">
          Messages
        </h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
        <section>
          <div className="mb-3 ml-1 flex items-center justify-between">
            <h2 className="text-[11px] font-medium tracking-wider text-zinc-500">Activity</h2>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="text-[10px] font-medium text-forest underline underline-offset-2"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {notifications.isLoading ? (
            <p className="p-4 text-center text-xs text-zinc-400">Loading activity…</p>
          ) : notifications.isError ? (
            <p className="p-4 text-center text-xs text-red-600">Couldn&apos;t load activity.</p>
          ) : (notifications.data ?? []).length > 0 ? (
            <div className="space-y-1.5">
              {(notifications.data ?? []).map((n) => {
                const link = notificationLink(n);
                const unread = !n.read_at;
                const content = (
                  <div
                    className={
                      unread
                        ? "flex items-center gap-3 rounded-[14px] bg-forest/5 p-3 ring-1 ring-forest/10"
                        : "flex items-center gap-3 rounded-[14px] p-3"
                    }
                  >
                    <div
                      className={
                        unread
                          ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-forest text-sand"
                          : "flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
                      }
                    >
                      <NotificationIcon type={n.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          unread
                            ? "truncate text-xs font-semibold text-zinc-900"
                            : "truncate text-xs text-zinc-600"
                        }
                      >
                        {notificationText(n)}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>
                    {unread ? <span className="size-1.5 shrink-0 rounded-full bg-forest" /> : null}
                  </div>
                );
                return link ? (
                  <Link
                    key={n.id}
                    to="/messages/$threadType/$threadId"
                    params={link}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })}
            </div>
          ) : (
            <p className="p-4 text-center text-xs text-zinc-400">
              No activity yet — matches and messages will show up here.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 ml-1 text-[11px] font-medium tracking-wider text-zinc-500">
            Conversations
          </h2>

          {threads.isLoading ? (
            <p className="p-4 text-center text-xs text-zinc-400">Loading conversations…</p>
          ) : threads.isError ? (
            <p className="p-4 text-center text-xs text-red-600">
              Couldn&apos;t load conversations.
            </p>
          ) : (threads.data ?? []).length > 0 ? (
            <div className="space-y-2">
              {(threads.data ?? []).map((t) => (
                <Link
                  key={`${t.thread_type}-${t.thread_id}`}
                  to="/messages/$threadType/$threadId"
                  params={{ threadType: t.thread_type as "match" | "bus", threadId: t.thread_id }}
                  className="flex items-center gap-3 rounded-[16px] bg-zinc-50 p-3.5 ring-1 ring-zinc-950/5"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-forest/10 text-forest">
                    {t.thread_type === "bus" ? (
                      <Bus className="size-4" />
                    ) : (
                      <Car className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-zinc-900">{t.title}</p>
                      {t.last_message_at ? (
                        <span className="shrink-0 text-[10px] text-zinc-400">
                          {formatRelativeTime(t.last_message_at)}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-zinc-500">
                      {t.last_message_body ?? "No messages yet — say hi"}
                    </p>
                  </div>
                  {t.unread_count > 0 ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-forest text-[10px] font-bold text-sand">
                      {t.unread_count > 9 ? "9+" : t.unread_count}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <p className="p-4 text-center text-xs text-zinc-400">
              No conversations yet — get matched or join a bus group to start chatting.
            </p>
          )}
        </section>
      </div>
    </PhoneShell>
  );
}
