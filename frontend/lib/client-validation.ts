import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(6, 'New password must be at least 6 characters')
    .max(100, 'Password must be less than 100 characters'),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const mfaVerificationSchema = z.object({
  token: z
    .string()
    .min(6, 'MFA token must be at least 6 characters')
    .max(8, 'MFA token must be at most 8 characters')
    .regex(/^\d+$/, 'MFA token must contain only numbers'),
});

export const createPollSchema = z.object({
  title: z
    .string()
    .min(1, 'Poll title is required')
    .min(3, 'Poll title must be at least 3 characters')
    .max(200, 'Poll title must be less than 200 characters'),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  startTime: z
    .string()
    .min(1, 'Start time is required')
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date > new Date();
    }, 'Start time must be in the future'),
  endTime: z
    .string()
    .min(1, 'End time is required'),
  isAnonymous: z.boolean().default(false),
  allowComments: z.boolean().default(false),
  isPublic: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
  allowedGroups: z.array(z.string()).optional(),
  votingMechanism: z.enum(['single', 'multiple', 'ranked', 'approval', 'rating'], {
    required_error: 'Please select a voting mechanism',
  }),
  options: z
    .array(
      z.object({
        text: z
          .string()
          .min(1, 'Option text is required')
          .max(500, 'Option text must be less than 500 characters'),
        description: z
          .string()
          .max(1000, 'Option description must be less than 1000 characters')
          .optional(),
      })
    )
    .min(2, 'At least 2 options are required')
    .max(20, 'Maximum 20 options allowed'),
}).refine((data) => {
  const startDate = new Date(data.startTime);
  const endDate = new Date(data.endTime);
  return endDate > startDate;
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const voteSchema = z.object({
  pollId: z.string().uuid('Invalid poll ID'),
  optionIds: z
    .array(z.string().uuid('Invalid option ID'))
    .min(1, 'At least one option must be selected')
    .optional(),
  rankings: z
    .array(
      z.object({
        optionId: z.string().uuid('Invalid option ID'),
        rank: z.number().min(1, 'Rank must be at least 1'),
      })
    )
    .optional(),
  ratings: z
    .array(
      z.object({
        optionId: z.string().uuid('Invalid option ID'),
        rating: z.number().min(1, 'Rating must be at least 1').max(10, 'Rating must be at most 10'),
      })
    )
    .optional(),
  blindTokenId: z.string().uuid('Invalid blind token ID').optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type MfaVerificationFormData = z.infer<typeof mfaVerificationSchema>;
export type CreatePollFormData = z.infer<typeof createPollSchema>;
export type VoteFormData = z.infer<typeof voteSchema>;

export const validateForm = <T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: boolean; 
  data?: T; 
  errors?: Record<string, string> 
} => {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        fieldErrors[path] = err.message;
      });
      return { success: false, errors: fieldErrors };
    }
    return { success: false, errors: { general: 'Validation failed' } };
  }
}; 