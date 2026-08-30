import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PhoneShell } from "@/components/PhoneShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authed/messages/$threadType/$threadId")({
  head: () => ({
    meta: [{ title: "Messages — Commute Mate" }],
  }),
  component: MessagesScreen,
});

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function MessagesScreen() {
  const { threadType, threadId } = Route.useParams();
  const isBus = threadType === "bus";
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const threadColumn = isBus ? "bus_trip_request_id" : "match_id";
  const messagesQueryKey = ["messages", threadType, threadId];
  const participantsQueryKey = ["thread-participants", threadType, threadId];

  const participants = useQuery({
    queryKey: participantsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("thread_participants", {
        p_thread_type: threadType,
        p_thread_id: threadId,
      });
      if (error) throw error;
      return data;
    },
  });

  const messages = useQuery({
    queryKey: messagesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq(threadColumn, threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    supabase
      .rpc("mark_thread_notifications_read", {
        p_thread_type: threadType,
        p_thread_id: threadId,
      })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadType, threadId]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${threadType}-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `${threadColumn}=eq.${threadId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: messagesQueryKey });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadType, threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user || !draft.trim()) return;
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        body: draft.trim(),
        ...(isBus ? { bus_trip_request_id: threadId } : { match_id: threadId }),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  const nameFor = (senderId: string) => {
    if (senderId === user?.id) return "You";
    return participants.data?.find((p) => p.user_id === senderId)?.display_name ?? "Unknown";
  };

  const title = isBus
    ? "Group Chat"
    : ((participants.data ?? []).find((p) => p.user_id !== user?.id)?.display_name ?? "Message");

  // Bus threads have more than one other person, so — unlike the 1:1
  // match title above — there's no single name to put in the header.
  // Shown as soon as the thread loads (same "With: ..." phrasing as the
  // Journey tab), not just once someone else has sent a message.
  const otherParticipantNames = (participants.data ?? [])
    .filter((p) => p.user_id !== user?.id)
    .map((p) => p.display_name);

  return (
    <PhoneShell>
      <header className="flex items-center gap-3 p-6 pb-4">
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Back"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="mr-16 min-w-0 flex-1">
          <h1 className="truncate text-balance font-serif text-2xl font-medium leading-tight text-forest">
            {title}
          </h1>
          {isBus && otherParticipantNames.length > 0 ? (
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              With: {otherParticipantNames.join(", ")}
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-6 pb-4">
        {messages.isLoading ? (
          <p className="p-4 text-center text-xs text-zinc-400">Loading messages…</p>
        ) : messages.data && messages.data.length > 0 ? (
          messages.data.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    mine
                      ? "max-w-[75%] rounded-[14px] rounded-br-sm bg-forest px-3 py-2 text-sand"
                      : "max-w-[75%] rounded-[14px] rounded-bl-sm bg-zinc-100 px-3 py-2 text-zinc-900"
                  }
                >
                  {isBus && !mine ? (
                    <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                      {nameFor(m.sender_id)}
                    </p>
                  ) : null}
                  <p className="text-sm">{m.body}</p>
                  <p
                    className={
                      mine ? "mt-1 text-[9px] text-sand/60" : "mt-1 text-[9px] text-zinc-400"
                    }
                  >
                    {formatTimestamp(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="p-4 text-center text-xs text-zinc-400">
            No messages yet — say hi to coordinate your ride.
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
        className="flex items-center gap-2 border-t border-zinc-950/5 bg-sand p-4"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="w-full rounded-[12px] bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200"
        />
        <button
          type="submit"
          disabled={send.isPending || !draft.trim()}
          aria-label="Send"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest text-sand disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </PhoneShell>
  );
}
