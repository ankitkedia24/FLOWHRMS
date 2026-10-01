import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "rishabh17704@gmail.com",
    password: "flowacord2026",
  });

  if (error) {
    console.error("Sign-in verification FAILED:", error.message);
    process.exit(1);
  }

  console.log("SUCCESS: Sign-in verified with Supabase!");
  console.log("Authenticated User ID:", data.user.id);
  console.log("Email:", data.user.email);
}

test();
