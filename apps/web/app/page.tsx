import { redirect } from "next/navigation";
import { getSession } from "@/lib/session-server";
import { ErrorCard } from "@/components/ErrorCard";

export default async function Home() {
  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession();
  } catch (err) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <ErrorCard title="Could not load Pragati" error={err} />
      </div>
    );
  }

  if (session?.role === "teacher") {
    redirect("/teacher");
  }
  if (session) {
    redirect("/student");
  }
  redirect("/onboarding");
}
