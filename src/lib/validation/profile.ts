import { z } from 'zod';

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2, 'Name is too short').max(100).optional(),
  departmentId: z.string().uuid().optional(),
  levelId: z.string().uuid().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
