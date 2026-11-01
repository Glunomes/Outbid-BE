import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from "../prisma/prisma.service.js";
import { JwtService } from '@nestjs/jwt';
import type { RegisterDto, RegisterResponseDto } from './schemas/register.schemas.js';
import { hashPassword, comparePassword } from './utils/hash.util.js';
import { Prisma } from '../generated/prisma/client.js';
import type { LoginDto, LoginResponseDto } from './schemas/login.schemas.js';

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: `${number}${'s' | 'm' | 'h' | 'd'}`;
  private readonly refreshExpiresIn: `${number}${'s' | 'm' | 'h' | 'd'}`;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService
  ) {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN;
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;

    if (
      !accessSecret ||
      !refreshSecret ||
      !accessExpiresIn ||
      !refreshExpiresIn
    ) {
      throw new Error('JWT environment variables are not fully defined');
    }

    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
    this.accessExpiresIn =
      accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`;
    this.refreshExpiresIn =
      refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`;
  }

  async createUser(dto: RegisterDto): Promise<RegisterResponseDto> {
    const passwordHash = await hashPassword(dto.password);

    try {
      const user = await this.prismaService.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
        },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User with that email already exists')
      }
      throw error;
    }
  }

    private generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.prismaService.user.findUnique({
      where: { email: dto.email }
    });

    if(!user || !(await comparePassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password')
    }

    return this.generateTokens(user.id, user.email);
  }
}
