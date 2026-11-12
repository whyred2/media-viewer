import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/services/config-service";
import { scanDirectory, scanAllMedia } from "@/lib/services/file-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const relativePath = searchParams.get("path") || "";
  const mode = searchParams.get("mode") || "folder"; // folder | flat

  if (mode !== "folder" && mode !== "flat") {
    return NextResponse.json({ error: "Invalid view mode" }, { status: 400 });
  }

  try {
    const config = await getConfig();

    if (!config.rootDirectory) {
      return NextResponse.json(
        { error: "Root directory not configured" },
        { status: 400 }
      );
    }

    if (mode === "flat") {
      const media = await scanAllMedia(config.rootDirectory, relativePath);
      return NextResponse.json({ items: media, mode: "flat" });
    } else {
      const items = await scanDirectory(config.rootDirectory, relativePath);
      return NextResponse.json({
        items,
        mode: "folder",
        currentPath: relativePath,
      });
    }
  } catch (error) {
    console.error("Error listing files:", error);

    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code || "")) {
      return NextResponse.json(
        { error: "Directory not found" },
        { status: 404 }
      );
    }
    if (["EACCES", "EPERM", "ELOOP"].includes((error as NodeJS.ErrnoException).code || "")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}
