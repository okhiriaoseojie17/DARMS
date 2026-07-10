import { z } from 'zod';

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2, 'Name is too short').max(100).optional(),
  departmentIds: z.array(z.string().uuid()).min(1, 'Pick at least one department').optional(),
  levelIds: z.array(z.string().uuid()).min(1, 'Pick at least one level').optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
