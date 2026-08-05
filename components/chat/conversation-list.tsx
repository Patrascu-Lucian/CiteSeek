import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ChatSummary } from "@/lib/chats/queries";
import { MAX_TITLE_LENGTH } from "@/lib/chats/titles";
import { cn } from "@/lib/utils";

/**
 * Past conversations, as links — routes rather than client state, so one can be
 * linked, bookmarked and reached with the back button.
 *
 * No `"use client"`: reached only through `WorkspaceSections`, which owns the
 * boundary. A directive here would make Next treat this as a client *entry*,
 * whose function props must be Server Actions — `onChanged` is not one.
 *
 * Signed-in only; guest conversations are never written down (ADR 013).
 */
export function ConversationList({
  workspaceId,
  chats,
  activeChatId,
  onChanged,
}: {
  workspaceId: string;
  chats: readonly ChatSummary[];
  activeChatId: string | null;
  /** Called after a rename or delete, so the server data can be refetched. */
  onChanged: () => void;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(chatId: string, init: RequestInit) {
    setBusyId(chatId);
    setError(null);
    try {
      const response = await fetch(
        `/api/w/${workspaceId}/chats/${chatId}`,
        init,
      );
      if (!response.ok) throw new Error("Request failed.");
      return true;
    } catch {
      setError("That didn't work. Try again.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function rename(chatId: string, title: string) {
    const ok = await send(chatId, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (ok) {
      setRenaming(null);
      onChanged();
    }
  }

  async function remove(chatId: string) {
    const ok = await send(chatId, { method: "DELETE" });
    if (!ok) return;

    /*
      If the conversation being deleted is the one on screen, its URL is now a
      404. Leaving the reader there would turn a successful delete into a broken
      page, so send them to the workspace root, which opens whatever is most
      recent.
    */
    if (chatId === activeChatId) {
      router.push(`/w/${workspaceId}`);
    }
    onChanged();
  }

  if (chats.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Conversations you have here will be listed, so you can come back to
        them.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <ul className="space-y-1">
        {chats.map((chat) => {
          const isActive = chat.id === activeChatId;
          const label = chat.title ?? "Untitled conversation";

          return (
            <li key={chat.id}>
              {renaming === chat.id ? (
                <RenameForm
                  initialTitle={chat.title ?? ""}
                  busy={busyId === chat.id}
                  onCancel={() => setRenaming(null)}
                  onSubmit={(title) => void rename(chat.id, title)}
                />
              ) : (
                <div className="group/row flex items-center gap-1">
                  <Link
                    href={`/w/${workspaceId}/c/${chat.id}`}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <MessageSquare
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    <span className="truncate">{label}</span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                      {chat.messageCount}
                    </span>
                  </Link>

                  {/*
                    Named for the conversation they act on. "Rename" alone,
                    repeated down a list, gives a screen-reader user a column of
                    identical controls with no way to tell them apart.
                  */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Rename ${label}`}
                    disabled={busyId === chat.id}
                    onClick={() => setRenaming(chat.id)}
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                  </Button>
                  <DeleteConversation
                    label={label}
                    messageCount={chat.messageCount}
                    busy={busyId === chat.id}
                    onConfirm={() => void remove(chat.id)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Lighter than the account dialog's typed word: what is lost is one conversation,
 * and a typed confirmation on every row trains the reader to type through it.
 * Naming the conversation is the job — a misclick got *which one* wrong.
 *
 * The documents list has the same control and no confirmation; filed in
 * `docs/backlog.md` rather than bolted on here.
 */
function DeleteConversation({
  label,
  messageCount,
  busy,
  onConfirm,
}: {
  label: string;
  messageCount: number;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost-destructive"
          size="sm"
          aria-label={`Delete ${label}`}
          disabled={busy}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          {/* The name is in the title because identifying the right
              conversation is the entire job of this dialog. */}
          <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {messageCount === 1
              ? "Its message will be permanently deleted."
              : `Its ${messageCount} messages will be permanently deleted.`}{" "}
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          {/* `AlertDialogAction` closes the dialog on click, which is right
              here: a failure is reported by the list's own alert above, not
              inside a dialog that would have to stay open to show it. */}
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete conversation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RenameForm({
  initialTitle,
  busy,
  onCancel,
  onSubmit,
}: {
  initialTitle: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (title: string) => void;
}) {
  const [value, setValue] = useState(initialTitle);

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <input
        // The field replaces the control just activated, so focus must follow or
        // a keyboard user is left on a button that no longer exists. The case
        // autofocus is legitimate for.
        autoFocus
        aria-label="Conversation name"
        maxLength={MAX_TITLE_LENGTH}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        className="border-input focus-visible:ring-ring min-w-0 flex-1 rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />
      <Button type="submit" size="sm" disabled={busy}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
