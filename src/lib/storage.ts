import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Business cards and voice recordings live in a PRIVATE bucket. We store the
 * object path (e.g. "{userId}/123_card.jpg") in the database and turn it into
 * a short-lived signed URL when displaying it.
 *
 * Older rows hold full public URLs from when the bucket was public; those are
 * converted back to paths so they keep working.
 */
export const FILES_BUCKET = "meeting-transcripts";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadUserFile(userId: string, fileName: string, body: Blob | File): Promise<string> {
  const safeName = fileName.replace(/[^\w.-]+/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, body);
  if (error) throw error;
  return path;
}

/** Returns the object path for a stored value, or null if it isn't one of ours. */
export function toStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value;
  const match = value.match(new RegExp(`/storage/v1/object/(?:public|sign)/${FILES_BUCKET}/([^?]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getSignedFileUrl(value: string | null | undefined): Promise<string | null> {
  const path = toStoragePath(value);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

export function useSignedFileUrl(value: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-file-url", value],
    queryFn: () => getSignedFileUrl(value),
    enabled: !!value,
    // Refresh well before the signed URL expires.
    staleTime: (SIGNED_URL_TTL_SECONDS - 300) * 1000,
  });
}
