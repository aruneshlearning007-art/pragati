import { redirect } from "next/navigation";
import { getSession } from "@/lib/session-server";

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect("/student");
  }
  redirect("/onboarding");
}
