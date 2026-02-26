import { z } from 'zod';

// Auth validation schemas
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

export const recoveryCodeSchema = z.object({
  recoveryCode: z
    .string()
    .min(10, 'Recovery code must be at least 10 characters')
    .max(10, 'Recovery code must be exactly 10 characters')
    .regex(/^[A-F0-9]+$/, 'Recovery code must contain only uppercase letters and numbers'),
});

// Poll validation schemas
const pollBaseSchema = z.object({
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
  ratingScale: z
    .object({
      min: z.number().min(1, 'Minimum rating must be at least 1'),
      max: z.number().max(10, 'Maximum rating must be at most 10'),
      step: z.number().min(1, 'Step must be at least 1'),
    })
    .optional(),
})

export const createPollSchema = pollBaseSchema
  .refine((data) => {
    const startDate = new Date(data.startTime);
    const endDate = new Date(data.endTime);
    return endDate > startDate;
  }, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
  .refine((data) => {
    // Rating scale is required for rating voting mechanism
    if (data.votingMechanism === 'rating') {
      return data.ratingScale !== undefined;
    }
    return true;
  }, {
    message: 'Rating scale is required for rating polls',
    path: ['ratingScale'],
  })

export const updatePollSchema = pollBaseSchema
  .partial()
  .extend({
    id: z.string().uuid('Invalid poll ID'),
  })

// Vote validation schemas
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
}).refine((data) => {
  // At least one voting method must be provided
  const hasOptions = data.optionIds && data.optionIds.length > 0;
  const hasRankings = data.rankings && data.rankings.length > 0;
  const hasRatings = data.ratings && data.ratings.length > 0;
  
  return hasOptions || hasRankings || hasRatings;
}, {
  message: 'At least one vote choice must be provided',
  path: ['optionIds'],
});

// User profile validation schemas
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

// Certificate login validation schema
export const certificateLoginSchema = z.object({
  certificateSubject: z
    .string()
    .min(1, 'Certificate subject is required'),
  certificateIssuer: z
    .string()
    .min(1, 'Certificate issuer is required'),
  certificateSerial: z
    .string()
    .min(1, 'Certificate serial is required'),
  certificateFingerprint: z
    .string()
    .min(1, 'Certificate fingerprint is required'),
});

// Search and filter schemas
export const pollSearchSchema = z.object({
  query: z.string().max(100, 'Search query must be less than 100 characters').optional(),
  status: z.enum(['all', 'active', 'upcoming', 'completed']).default('all'),
  anonymous: z.boolean().optional(),
  sortBy: z.enum(['created', 'startTime', 'endTime', 'title']).default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1, 'Page must be at least 1').default(1),
  limit: z.number().min(1, 'Limit must be at least 1').max(100, 'Limit must be at most 100').default(20),
});

// Comment validation schema (for future use)
export const commentSchema = z.object({
  pollId: z.string().uuid('Invalid poll ID'),
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(500, 'Comment must be less than 500 characters'),
  parentId: z.string().uuid('Invalid parent comment ID').optional(),
});

// Admin schemas
export const securityCleanupSchema = z.object({
  expiredTokens: z.boolean().default(true),
  expiredSessions: z.boolean().default(true),
  revokedTokens: z.boolean().default(true),
  oldMetrics: z.boolean().default(false),
});

export const rateLimitPolicySchema = z.object({
  endpoint: z
    .string()
    .min(1, 'Endpoint is required')
    .max(100, 'Endpoint must be less than 100 characters'),
  maxAttempts: z
    .number()
    .min(1, 'Max attempts must be at least 1')
    .max(1000, 'Max attempts must be at most 1000'),
  windowMs: z
    .number()
    .min(1000, 'Window must be at least 1 second')
    .max(3600000, 'Window must be at most 1 hour'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
});

// Type exports for use in components
export type LoginFormData = z.infer<typeof loginSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type MfaVerificationFormData = z.infer<typeof mfaVerificationSchema>;
export type RecoveryCodeFormData = z.infer<typeof recoveryCodeSchema>;
export type CreatePollFormData = z.infer<typeof createPollSchema>;
export type UpdatePollFormData = z.infer<typeof updatePollSchema>;
export type VoteFormData = z.infer<typeof voteSchema>;
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
export type CertificateLoginFormData = z.infer<typeof certificateLoginSchema>;
export type PollSearchFormData = z.infer<typeof pollSearchSchema>;
export type CommentFormData = z.infer<typeof commentSchema>;
export type SecurityCleanupFormData = z.infer<typeof securityCleanupSchema>;
export type RateLimitPolicyFormData = z.infer<typeof rateLimitPolicySchema>;

// Validation helper functions
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

const getObjectSchema = (schema: z.ZodSchema<any>): z.ZodObject<any> | null => {
  if (schema instanceof z.ZodObject) {
    return schema
  }

  if (schema instanceof z.ZodEffects) {
    const innerSchema = schema._def.schema
    if (innerSchema instanceof z.ZodObject) {
      return innerSchema
    }
  }

  return null
}

export const validateField = <T>(
  schema: z.ZodSchema<T>,
  fieldName: string,
  value: unknown
): string | null => {
  try {
    const objectSchema = getObjectSchema(schema)
    if (!objectSchema) {
      return 'Invalid input'
    }

    const fieldSchema = objectSchema.shape[fieldName as keyof typeof objectSchema.shape]
    if (fieldSchema) {
      fieldSchema.parse(value)
    }
    return null
  } catch (error) {
    if (error instanceof z.ZodError && error.errors[0]) {
      return error.errors[0].message
    }
    return 'Invalid input'
  }
}
