import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/LandingPage";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://passten.vercel.app",
  },
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/vault");
  return <LandingPage />;
}
