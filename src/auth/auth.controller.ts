import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { RegisterDto, RegisterResponseDto } from './schemas/register.schemas.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { registerSchema } from './schemas/register.schemas.js';
import { loginSchema } from './schemas/login.schemas.js';
import type { LoginDto, LoginResponseDto } from './schemas/login.schemas.js';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  createUser
    (@Body(new ZodValidationPipe(registerSchema)) data: RegisterDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.createUser(data);
  }

  @Post('login')
  login
    (@Body(new ZodValidationPipe(loginSchema)) data: LoginDto,
  ): Promise<LoginResponseDto> {
    return this.authService.login(data);
  }
  
}
