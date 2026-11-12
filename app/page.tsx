import { redirect } from "next/navigation";
import { getConfig } from "@/lib/services/config-service";
import { Gallery } from "@/components/gallery/gallery";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const config = await getConfig();

  if (!config.rootDirectory) {
    redirect("/setup");
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <Gallery />
    </Suspense>
  );
}
