/** What `UploadDropzone` does with a file once it has passed validation. Local
 * mode supplies its own, which never leaves the browser (ADR 029). */
export type SendFile = (
  file: File,
) => Promise<{ ok: true } | { ok: false; message: string }>;

/** Posts to the workspace's ingestion route. The cap refusals answer 409 with a
 * message naming what to delete, so the body is read on failure. */
export function uploadToWorkspace(workspaceId: string): SendFile {
  return async (file) => {
    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(`/api/w/${workspaceId}/documents`, {
        method: "POST",
        body,
      });

      if (response.ok) return { ok: true };

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      return { ok: false, message: payload?.error ?? "Upload failed." };
    } catch {
      return {
        ok: false,
        message: "Upload failed. Check your connection and try again.",
      };
    }
  };
}
