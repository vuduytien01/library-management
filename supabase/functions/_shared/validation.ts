// Deno type definitions are provided by deno.d.ts in the functions root

import { z } from "zod";

/**
 * User Creation Schema (DTO)
 */
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(['LIBRARIAN', 'ADMIN', 'MEMBER']).default('MEMBER'),
});

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;

/**
 * User Update Schema
 */
export const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().optional(),
  role: z.enum(['LIBRARIAN', 'ADMIN', 'MEMBER']).optional(),
  isLocked: z.boolean().optional(),
});

/**
 * User Deletion Schema
 */
export const DeleteUserSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Request Helper for Zod Validation
 */
export async function validateRequest<T>(req: Request, schema: z.ZodSchema<T>): Promise<T> {
  const body = await req.json();
  const result = schema.safeParse(body);
  
  if (!result.success) {
    throw { 
      message: 'Validation failed', 
      status: 400, 
      details: result.error.format() 
    };
  }
  
  return result.data;
}
