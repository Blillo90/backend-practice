import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.SUPABASE_URL;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// OJO: esto solo debe usarse en servidor (endpoints).
if (!url || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

export const supabaseServer = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
