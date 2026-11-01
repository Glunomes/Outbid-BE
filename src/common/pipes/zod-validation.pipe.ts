import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export class ZodValidationPipe<
  Schema extends z.ZodType,
> implements PipeTransform<unknown, z.output<Schema>> {
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}
