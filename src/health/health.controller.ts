import {
  Controller,
  Get,
  Header,
  Logger,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  async check(@Res({ passthrough: true }) response: Response): Promise<string> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'Backend Status: OK \nDB Status: OK';
    } catch {
      this.logger.warn('Database health check failed');
      response.status(503);
      return 'Backend Status: OK\n DB Status: Unavailable';
    }
  }
}
