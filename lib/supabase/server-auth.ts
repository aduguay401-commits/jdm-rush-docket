import { createServerClient as createSupabaseServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerAuthClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            try {
              cookieStore.set({
                name: cookie.name,
                value: cookie.value,
                ...cookie.options,
              } as {
                name: string;
                value: string;
                options?: CookieOptions;
              });
            } catch {
              // Server Components may not allow mutating cookies during render.
            }
          }
        },
      },
    }
  );
}
