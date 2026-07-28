"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Irreversible account deletion, behind a typed confirmation.
 *
 * A plain "are you sure?" is dismissed reflexively — the muscle memory of
 * clicking through dialogs is exactly what an unrecoverable action must defeat.
 * Requiring the word "delete" to be typed forces a deliberate act, and it is the
 * standard pattern for this severity precisely because people recognize it.
 *
 * The dialog says specifically what is destroyed. "Delete your account" tells
 * the user nothing about their documents.
 */

const CONFIRMATION_WORD = "delete";

export function DeleteAccountDialog() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete =
    confirmation.trim().toLowerCase() === CONFIRMATION_WORD && !isDeleting;

  async function deleteAccount() {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/account", { method: "DELETE" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Could not delete your account.");
        return;
      }

      // The session is already gone server-side; a full navigation clears any
      // cached client state along with it.
      window.location.assign("/");
    } catch {
      setError("Could not reach the server. Your account was not deleted.");
    } finally {
      setIsDeleting(false);
      router.refresh();
    }
  }

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          setConfirmation("");
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Delete account
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your account, your workspaces, every
            document you have uploaded, and all extracted text and indexed
            passages. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label htmlFor="confirm-delete" className="text-sm font-medium">
            Type <span className="font-mono">{CONFIRMATION_WORD}</span> to
            confirm
          </label>
          <input
            id="confirm-delete"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="border-input focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {/* Not AlertDialogAction: that closes the dialog on click, which would
              hide an error the user needs to see. */}
          <Button
            type="button"
            variant="destructive"
            disabled={!canDelete}
            onClick={() => void deleteAccount()}
          >
            {isDeleting ? "Deleting…" : "Delete my account"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
