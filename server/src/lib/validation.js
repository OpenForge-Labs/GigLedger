import { ZodError } from 'zod'

export function validateBody(schema) {
  return (request, response, next) => {
    try {
      request.validatedBody = schema.parse(request.body)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        return response.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Some fields need attention.',
            details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
          },
        })
      }
      return next(error)
    }
  }
}
