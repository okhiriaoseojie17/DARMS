// src/app/api/ai/question-bank/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateWithGemini, GeminiError } from "@/lib/ai/gemini";
import { buildQuestionPrompt } from "@/lib/ai/buildQuestionPrompt";
import { fetchUploadContent, type GeminiPart } from "@/lib/ai/fetchUploadContent";

const generateSchema = z.object({
  courseId: z.string().uuid(),
  sourceCategory: z.enum(["test1", "test2", "exam", "notes"]),
  questionType: z.enum(["objective", "theory", "mixed"]),
  difficulty: z.enum(["easy", "normal", "hard"]),
  noteUploadId: z.string().uuid().optional(),
});

// GET /api/ai/question-bank?courseId=...&sourceCategory=...&questionType=...&difficulty=...&noteUploadId=...
// Cache lookup — unchanged, doesn't touch file content at all.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  const sourceCategory = searchParams.get("sourceCategory");
  const questionType = searchParams.get("questionType");
  const difficulty = searchParams.get("difficulty");
  const noteUploadId = searchParams.get("noteUploadId");

  if (!courseId || !sourceCategory || !questionType || !difficulty) {
    return NextResponse.json(
      { error: "courseId, sourceCategory, questionType, and difficulty are required" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("question_banks")
    .select("*")
    .eq("course_id", courseId)
    .eq("source_category", sourceCategory)
    .eq("question_type", questionType)
    .eq("difficulty", difficulty)
    .eq("generated_by", user.id)
    .order("generated_at", { ascending: false })
    .limit(1);

  if (sourceCategory === "notes") {
    if (!noteUploadId) {
      return NextResponse.json(
        { error: "noteUploadId is required when sourceCategory is 'notes'" },
        { status: 400 }
      );
    }
    query = query.contains("source_upload_ids", [noteUploadId]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ questionBank: data?.[0] ?? null });
}

// POST /api/ai/question-bank — always generates a fresh set.
// Now reads the actual approved file(s) from storage (PDF/image sent
// directly to Gemini, docx converted to text via mammoth) instead of a
// pre-extracted_text column that nothing currently populates.
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = generateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { courseId, sourceCategory, questionType, difficulty, noteUploadId } =
    parsed.data;

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

  const instructionPrompt = buildQuestionPrompt({
    courseTitle: course.title,
    courseCode: course.code,
    sourceCategory,
    questionType,
    difficulty,
  });

  let content: unknown;
  try {
    const raw = await generateWithGemini(
      [{ text: instructionPrompt }, ...fileParts],
      { responseFormat: "json" }
    );
    content = JSON.parse(raw);
  } catch (err) {
    if (err instanceof GeminiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "AI returned output that could not be parsed. Please try again." },
      { status: 502 }
    );
  }

  const sourceUploadIds = uploads.map((u) => u.id);

  const { data: saved, error: saveError } = await supabase
    .from("question_banks")
    .insert({
      course_id: courseId,
      source_upload_ids: sourceUploadIds,
      source_category: sourceCategory,
      difficulty,
      question_type: questionType,
      content,
      generated_by: user.id,
    })
    .select()
    .single();

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ questionBank: saved });
}
