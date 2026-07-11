import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateWithGemini, GeminiError } from "@/lib/ai/gemini";
import { buildAskPrompt } from "@/lib/ai/buildQuestionPrompt";
import { fetchUploadContent, type GeminiPart } from "@/lib/ai/fetchUploadContent";

const requestSchema = z.object({
  courseId: z.string().uuid(),
  sourceCategory: z.enum(["test1", "test2", "exam", "notes"]),
  question: z.string().min(3).max(500),
  noteUploadId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { courseId, sourceCategory, question, noteUploadId } = parsed.data;

  if (sourceCategory === "notes" && !noteUploadId) {
    return NextResponse.json(
      { error: "noteUploadId is required when sourceCategory is 'notes'" },
      { status: 400 }
    );
  }

  const { data: course } = await supabase
    .from("courses")
    .select("code, title, course_settings(ai_indexing_allowed)")
    .eq("id", courseId)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.course_settings?.[0]?.ai_indexing_allowed === false) {
    return NextResponse.json(
      { error: "AI features are disabled for this course" },
      { status: 403 }
    );
  }

  let uploadsQuery = supabase
    .from("uploads")
    .select("id, file_type, storage_path, display_label, generated_filename")
    .eq("course_id", courseId)
    .eq("status", "approved");

  uploadsQuery =
    sourceCategory === "notes"
      ? uploadsQuery.eq("id", noteUploadId)
      : uploadsQuery.eq("resource_type", sourceCategory);

  const { data: uploads, error: uploadsError } = await uploadsQuery;

  if (uploadsError) {
    return NextResponse.json({ error: uploadsError.message }, { status: 500 });
  }
  if (!uploads || uploads.length === 0) {
    return NextResponse.json(
      { error: "No approved uploads found for this selection yet." },
      { status: 404 }
    );
  }

  const fileParts = (
    await Promise.all(uploads.map((u) => fetchUploadContent(supabase, u)))
  ).filter((p): p is GeminiPart => p !== null);

  if (fileParts.length === 0) {
    return NextResponse.json(
      {
        error:
          "The approved file(s) for this selection aren't in a format the AI can currently read " +
          "(PDF, image, and DOCX are supported — PPTX and external links aren't yet).",
      },
      { status: 422 }
    );
  }

  const instructionPrompt = buildAskPrompt({
    courseTitle: course.title,
    courseCode: course.code,
    sourceCategory,
    question,
  });

  try {
    const answer = await generateWithGemini(
      [{ text: instructionPrompt }, ...fileParts],
      { responseFormat: "text" }
    );
    return NextResponse.json({ answer });
  } catch (err) {
    if (err instanceof GeminiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Something went wrong getting an answer. Please try again." },
      { status: 500 }
    );
  }
}
