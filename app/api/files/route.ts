import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/services/config-service";
import { scanDirectory, scanAllImages } from "@/lib/services/file-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const relativePath = searchParams.get("path") || "";
  const mode = searchParams.get("mode") || "folder"; // folder | flat

  try {
    const config = await getConfig();

    if (!config.rootDirectory) {
      return NextResponse.json(
        { error: "Root directory not configured" },
        { status: 400 }
      );
    }

    if (mode === "flat") {
      const images = await scanAllImages(config.rootDirectory, relativePath);
      return NextResponse.json({ items: images, mode: "flat" });
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

    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { error: "Directory not found" },
        { status: 404 }
      );
    }
    if ((error as NodeJS.ErrnoException).code === "EACCES") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}
