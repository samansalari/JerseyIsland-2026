import { z } from 'zod'
import { NextResponse } from 'next/server'

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { data: T } | { error: NextResponse } {
  const result = schema.safeParse(data)
  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: 'Invalid request', details: result.error.flatten() },
        { status: 400 },
      ),
    }
  }
  return { data: result.data }
}

export const voteSchema = z.object({
  issue: z.enum([
    'housing',
    'healthcare',
    'cost_of_living',
    'environment',
    'economy',
    'education',
    'transport',
    'tax',
    'public_services',
    'immigration',
  ]),
})

export const ratingSchema = z.object({
  candidateId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
})
