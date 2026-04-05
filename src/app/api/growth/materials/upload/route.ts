export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { addMaterial } from "@/lib/growthStore";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv",
  "video/mp4",
  "audio/mpeg",
  "audio/mp4",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/zip",
]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const topicId = formData.get("topicId") as string | null;
    const title = (formData.get("title") as string | null) ?? "";

    if (!file || !topicId) {
      return NextResponse.json({ error: "file and topicId are required" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 413 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `File type ${file.type} is not supported` }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uploadDir = path.join(process.cwd(), "public", "uploads", "growth", topicId);
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `${Date.now()}-${safeName}`);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/growth/${topicId}/${Date.now()}-${safeName}`;
    const material = await addMaterial({
      topicId,
      title: title.trim() || file.name,
      type: "file",
      url: publicUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });

    return NextResponse.json({ material });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
