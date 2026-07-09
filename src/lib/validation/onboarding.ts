import { z } from 'zod';

export const onboardingSchema = z.object({
  profileType: z.enum(['student', 'lecturer']),
  departmentIds: z.array(z.string().uuid()).min(1, 'Pick at least one department'),
  levelIds: z.array(z.string().uuid()).min(1, 'Pick at least one level'),
  // Only meaningful when profileType === 'lecturer'; a lecturer teaching
  // courses that don't exist yet is expected — those codes are simply
  // reported back as "not found" rather than blocking the rest of onboarding.
  courseCodes: z.array(z.string().min(3).max(10)).optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
