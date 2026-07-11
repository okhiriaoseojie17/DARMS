// src/lib/ai/fetchUploadContent.ts
//
// Turns an approved upload into a piece of content Gemini can actually
// consume — no pre-extracted text required. PDFs and images go straight in
// as inline file data (Gemini reads these natively, including scanned/
// handwritten pages). DOCX gets converted to plain text locally with
// mammoth, since Gemini doesn't understand the raw Office XML format.
// PPTX and link-type resources aren't supported yet — see note below.
import type { SupabaseClient } from "@supabase/supabase-js";
import mammoth from "mammoth";

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface UploadRow {
  id: string;
  file_type: "pdf" | "docx" | "pptx" | "image" | "link";
  storage_path: string | null;
  display_label: string | null;
  generated_filename?: string | null;
}

function inferImageMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  return "image/jpeg"; // covers .jpg/.jpeg; safe default for anything else
}

// Returns null for anything we can't currently turn into Gemini content —
// callers filter these out and surface a message if the whole pool ends up
// empty, rather than failing the request outright for a partially-supported
// selection.
export async function fetchUploadContent(
  supabase: SupabaseClient,
  upload: UploadRow
): Promise<GeminiPart | null> {
  if (upload.file_type === "link" || !upload.storage_path) {
    return null;
  }

  const { data: blob, error } = await supabase.storage
    .from("uploads-approved")
    .download(upload.storage_path);

  if (error || !blob) {
    return null;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (upload.file_type === "pdf") {
    return { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } };
  }

  if (upload.file_type === "image") {
    return {
      inlineData: {
        mimeType: inferImageMime(upload.storage_path),
        data: buffer.toString("base64"),
      },
    };
  }

  if (upload.file_type === "docx") {
    try {
      const { value: text } = await mammoth.extractRawText({ buffer });
      if (!text.trim()) return null;
      const label = upload.display_label ?? upload.generated_filename ?? "document";
      return { text: `--- ${label} ---\n${text}` };
    } catch {
      return null;
    }
  }

  // pptx: not supported yet — no lightweight free way to extract PPTX text
  // or hand it to Gemini directly. Worth revisiting later (e.g. server-side
  // conversion to PDF) if enough course material is PPTX-only.
  return null;
}
