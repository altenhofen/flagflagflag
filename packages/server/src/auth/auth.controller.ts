import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AllowAnonymous } from './allow-anonymous.decorator.js';
import {
  AuthIdentityService,
  AuthToken,
  JwtPayload,
} from './auth-identity.service.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE, SESSION_TTL_MS } from './tokens.js';
import { ChangePasswordSchema, SignInSchema, SignUpSchema } from './schemas.js';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly identity: AuthIdentityService,
  ) {}

  @AllowAnonymous()
  @Post('sign-in/username')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthToken> {
    const parsed = SignInSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const token = await this.identity.authenticate(
      parsed.data.username,
      parsed.data.password,
    );
    response.cookie(SESSION_COOKIE, token.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
    return token;
  }

  @AllowAnonymous()
  @Post('sign-up/email')
  @HttpCode(HttpStatus.OK)
  async signUp(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthToken> {
    const parsed = SignUpSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    await this.authService.signUp(parsed.data);
    const user = await this.identity.authenticate(
      parsed.data.username,
      parsed.data.password,
    );
    response.cookie(SESSION_COOKIE, user.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
    return user;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() body: unknown,
    @Req() request: Request & { user: JwtPayload },
  ): Promise<{ status: boolean }> {
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    await this.authService.changePassword(
      request.user.sub,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    return { status: true };
  }
}
