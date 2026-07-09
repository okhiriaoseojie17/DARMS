import { z } from 'zod';

export const resourceTypeSchema = z.enum(['notes', 'test', 'assignment', 'exam', 'other']);
export const fileTypeSchema = z.enum(['pdf', 'docx', 'pptx', 'image', 'link']);

// What the client is allowed to send when creating an upload. Notice there is
// no `generated_filename` or `status` field here — both are computed/enforced
// server-side (naming service + the DB trigger), never trusted from the client.
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
    semester: z.enum(['First', 'Second']),
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
  });

export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
];

export const MIME_TO_FILE_TYPE: Record<string, 'pdf' | 'docx' | 'pptx' | 'image'> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/png': 'image',
  'image/jpeg': 'image',
};
