import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getConfig } from "@/lib/services/config-service";
import { getImageBuffer } from "@/lib/services/file-service";
import path from "path";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const relativePath = searchParams.get("path");
  const size = searchParams.get("size") || "thumbnail"; // thumbnail | original
  const width = parseInt(searchParams.get("width") || "300");

  if (!relativePath) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  try {
    const config = await getConfig();

    if (!config.rootDirectory) {
      return NextResponse.json(
        { error: "Root directory not configured" },
        { status: 400 }
      );
    }

    const fullPath = path.join(config.rootDirectory, relativePath);

    // Security: Ensure the path is within the root directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedRoot = path.resolve(config.rootDirectory);

    if (!resolvedPath.startsWith(resolvedRoot)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const imageBuffer = await getImageBuffer(fullPath);

    let outputBuffer: Buffer;
    let contentType: string;

    if (size === "original") {
      // Return original image
      outputBuffer = imageBuffer;
      const ext = path.extname(relativePath).toLowerCase();
      contentType = getContentType(ext);
    } else {
      // Generate optimized thumbnail
      outputBuffer = await sharp(imageBuffer)
        .resize(width, null, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();
      contentType = "image/webp";
    }

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving image:", error);

    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    if ((error as NodeJS.ErrnoException).code === "EACCES") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}

function getContentType(extension: string): string {
  const types: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".avif": "image/avif",
  };
  return types[extension] || "application/octet-stream";
}
