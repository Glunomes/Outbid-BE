import { Body, Controller, Post, Get } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { RegisterDto, RegisterResponseDto } from './auth.schemas.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { registerSchema } from './auth.schemas.js';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  createUser
    (@Body(new ZodValidationPipe(registerSchema)) data: RegisterDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.createUser(data);
  }

}
