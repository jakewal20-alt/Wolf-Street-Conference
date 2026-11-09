import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * supabase.functions.invoke() reports every failed call as "Edge Function
 * returned a non-2xx status code", and every caller shows error.message in a
 * toast. Rewrite that message once, here, into something a person can act on:
 * the function's own short `error` text when it sent one, otherwise plain
 * wording by status. Callers keep working unchanged.
 */
const MAX_SERVER_MESSAGE = 200;

async function friendlyMessage(error: unknown): Promise<string | null> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response | undefined;
    const status = res?.status ?? 0;
    let serverMessage: string | null = null;
    try {
      const body = await res?.clone().json();
      const text = typeof body?.error === "string" ? body.error : typeof body?.message === "string" ? body.message : null;
      if (text && text.length <= MAX_SERVER_MESSAGE) serverMessage = text;
    } catch {
      // not JSON
    }
    if (status === 401) return "Your sign-in has ended. Sign in again and retry.";
    if (status === 403) return serverMessage ?? "You don't have access to that.";
    if (status >= 500) return serverMessage ?? "Something went wrong on Hallway's side. Try again in a minute.";
    return serverMessage ?? "That didn't work. Check what you entered and try again.";
  }
  if (error instanceof FunctionsFetchError) return "Couldn't reach Hallway. Check your connection and try again.";
  if (error instanceof FunctionsRelayError) return "Something went wrong on Hallway's side. Try again in a minute.";
  return null;
}

let installed = false;

export function installFriendlyFunctionErrors(): void {
  if (installed) return;
  installed = true;
  // supabase.functions is a new FunctionsClient on every access, so patch the
  // shared prototype rather than one instance.
  const proto = Object.getPrototypeOf(supabase.functions) as { invoke: (...args: unknown[]) => Promise<{ error: Error | null }> };
  const original = proto.invoke;
  proto.invoke = async function (this: unknown, ...args: unknown[]) {
    const result = await original.apply(this, args);
    if (result.error) {
      const message = await friendlyMessage(result.error);
      if (message) result.error.message = message;
    }
    return result;
  };
}
