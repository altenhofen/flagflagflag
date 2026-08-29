import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AllowAnonymous } from './allow-anonymous.decorator.js';
import { AuthIdentityService } from './auth-identity.service.js';
import type { AuthToken, JwtPayload } from './auth-identity.service.js';
import { AuthService } from './auth.service.js';
import type { PublicUser } from './auth.service.js';
import { SESSION_COOKIE, SESSION_TTL_MS } from './tokens.js';
import { ChangePasswordSchema, SignInSchema, SignUpSchema } from './schemas.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly identity: AuthIdentityService,
  ) {}

  @AllowAnonymous()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
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
    this.setSessionCookie(response, token);
    return token;
  }

  @AllowAnonymous()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthToken> {
    const parsed = SignUpSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    await this.authService.signUp(parsed.data);
    const token = await this.identity.authenticate(
      parsed.data.username,
      parsed.data.password,
    );
    this.setSessionCookie(response, token);
    return token;
  }

  @Post('password')
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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response): { status: boolean } {
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    return { status: true };
  }

  @Get('me')
  async me(
    @Req() request: Request & { user: JwtPayload },
  ): Promise<PublicUser> {
    return this.identity.getCurrentUser(request.user.sub);
  }

  private setSessionCookie(response: Response, token: AuthToken): void {
    response.cookie(SESSION_COOKIE, token.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
  }
}
