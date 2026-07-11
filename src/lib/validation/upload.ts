import { z } from 'zod';

export const resourceTypeSchema = z.enum(['notes', 'test1', 'test2', 'assignment', 'exam', 'other']);
export const fileTypeSchema = z.enum(['pdf', 'docx', 'pptx', 'image', 'link']);

// What the client is allowed to send when creating an upload. Notice there is
// no `generated_filename`, `status`, or `semester` field here — semester is
// no longer asked for at upload time at all, since a course is permanently
// tied to one semester at creation (a course code can't exist in both
// Alpha and Omega). The API route reads semester off the course row itself
// rather than trusting a second value from the client, so the two can never
// disagree. `generated_filename`/`status` remain computed/enforced server-side
// (naming service + the DB trigger) for the same reason.
//
// For fileType === 'link': externalUrl is required, storagePath/fileSizeBytes
// are omitted.
// For any other fileType: the browser has already uploaded the file directly
// to the `uploads-pending` Supabase Storage bucket (see the upload form),
// and storagePath/fileSizeBytes describe where it landed.
export const createUploadSchema = z
  .object({
    courseId: z.string().uuid(),
    fileType: fileTypeSchema,
    resourceType: resourceTypeSchema,
    label: z.string().min(1).max(120).optional(),
    academicYear: z
      .string()
      .regex(/^\d{4}\/\d{4}$/, 'Academic year must look like 2024/2025'),
    externalUrl: z.string().url().optional(),
    storagePath: z.string().min(1).optional(),
    fileSizeBytes: z.number().int().positive().optional(),
    tags: z.array(z.string().min(1).max(30)).max(10).optional(),
    description: z.string().max(1000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.fileType === 'link' && !val.externalUrl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'externalUrl is required for link uploads', path: ['externalUrl'] });
    }
    if (val.fileType !== 'link' && !val.storagePath) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'storagePath is required once the file has been uploaded', path: ['storagePath'] });
    }
    if (val.fileType !== 'link' && val.fileSizeBytes && val.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File exceeds the ${MAX_FILE_SIZE_MB}MB limit`,
        path: ['fileSizeBytes'],
      });
    }
  });

export type CreateUploadInput = z.infer<typeof createUploadSchema>;

// Configurable via env so the cap can be tuned without a redeploy of logic —
// just update NEXT_PUBLIC_MAX_UPLOAD_MB in Vercel and both client and server
// pick it up. NEXT_PUBLIC_ prefix is required since UploadForm.tsx (a client
// component) reads this too. Falls back to 8MB if unset.
export const MAX_FILE_SIZE_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 5);
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
];

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'];

export const MIME_TO_FILE_TYPE: Record<string, 'pdf' | 'docx' | 'pptx' | 'image'> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/png': 'image',
  'image/jpeg': 'image',
};
