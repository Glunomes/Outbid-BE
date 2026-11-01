import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from "../prisma/prisma.service.js";
import type { RegisterDto, RegisterResponseDto } from './auth.schemas.js';
import { hashPassword } from './utils/hash.util.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}

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
}
