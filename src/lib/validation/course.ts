import { z } from 'zod';

export const createCourseRequestSchema = z.object({
  departmentId: z.string().uuid(),
  levelId: z.string().uuid(),
  code: z
    .string()
    .min(4)
    .max(10)
    .regex(/^[A-Z]{2,4}\d{3}$/, 'Course code must look like CSC201'),
  title: z.string().min(3).max(150),
  semester: z.enum(['First', 'Second']),
});

export type CreateCourseRequestInput = z.infer<typeof createCourseRequestSchema>;
