import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { generateCsrfToken } from '../../common/csrf/csrf.config';
import { Public } from './decorators/public.decorator';
import { CurrentUser, type AuthenticatedUser } from './decorators/current-user.decorator';
import { JwtPre2FAGuard } from './guards/jwt-pre-2fa.guard';
import { JwtSetup2FAGuard } from './guards/jwt-setup-2fa.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { MicrosoftOAuthGuard } from './guards/microsoft-oauth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TwoFactorCodeDto, DisableTwoFactorDto } from './dto/two-factor.dto';
import type { OAuthProfileSummary } from './auth.types';

const REFRESH_COOKIE = 'rt';
const STRICT_THROTTLE = { default: { limit: 10, ttl: 15 * 60 * 1000 } };
// Brute-force protection: tighter than STRICT for the most-attacked routes.
const LOGIN_THROTTLE = { default: { limit: 5, ttl: 15 * 60 * 1000 } };
const RESET_THROTTLE = { default: { limit: 3, ttl: 60 * 60 * 1000 } };

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ── Public auth endpoints ───────────────────────────────────────────────

  /** Issues a CSRF token + cookie for the SPA to send as X-CSRF-Token (ADR-0003). */
  @Public()
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return { csrfToken: generateCsrfToken(req, res) };
  }

  @Public()
  @Throttle(STRICT_THROTTLE)
  @Post('register')
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(body);
    this.setRefreshCookie(res, result.refreshCookie);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const outcome = await this.auth.login(body);
    if (outcome.status === 'authenticated' && outcome.refreshCookie && outcome.accessToken) {
      this.setRefreshCookie(res, outcome.refreshCookie);
      return { accessToken: outcome.accessToken, user: outcome.user };
    }
    if (outcome.status === 'requires-2fa') {
      return { requires2FA: true, preAuthToken: outcome.preAuthToken, user: outcome.user };
    }
    return { requires2FASetup: true, setupToken: outcome.setupToken, user: outcome.user };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieValue = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const result = await this.auth.refresh(cookieValue);
    this.setRefreshCookie(res, result.refreshCookie);
    return { accessToken: result.accessToken, user: result.user };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieValue = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    await this.auth.logoutByCookie(cookieValue);
    this.clearRefreshCookie(res);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(user.id);
    this.clearRefreshCookie(res);
  }

  @Public()
  @Throttle(RESET_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.auth.forgotPassword(body.email);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.auth.resetPassword(body.token, body.newPassword);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.changePassword(user.id, body.oldPassword, body.newPassword);
    this.setRefreshCookie(res, result.refreshCookie);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const me = await this.auth.getMe(user.id);
    if (!me) throw new UnauthorizedException();
    return me;
  }

  // ── 2FA ─────────────────────────────────────────────────────────────────

  @Post('2fa/generate')
  async generate2FA(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.generate2FA(user.id);
  }

  @Public()
  @UseGuards(JwtSetup2FAGuard)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/setup-generate')
  async generate2FAFromSetup(@Req() req: Request) {
    const setupUser = (req as Request & { user: { id: string } }).user;
    return this.auth.generate2FA(setupUser.id);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verify2FA(@CurrentUser() user: AuthenticatedUser, @Body() body: TwoFactorCodeDto) {
    await this.auth.verify2FA(user.id, body.code);
    return { enabled: true };
  }

  @Public()
  @UseGuards(JwtSetup2FAGuard)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/setup-verify')
  async verify2FAFromSetup(
    @Req() req: Request,
    @Body() body: TwoFactorCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const setupUser = (req as Request & { user: { id: string } }).user;
    await this.auth.verify2FA(setupUser.id, body.code);
    const success = await this.auth.loginAfter2FA(setupUser.id, body.code);
    this.setRefreshCookie(res, success.refreshCookie);
    return { accessToken: success.accessToken, user: success.user };
  }

  @Public()
  @UseGuards(JwtPre2FAGuard)
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/validate')
  async validate2FA(
    @Req() req: Request,
    @Body() body: TwoFactorCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const preAuthUser = (req as Request & { user: { id: string } }).user;
    const success = await this.auth.loginAfter2FA(preAuthUser.id, body.code);
    this.setRefreshCookie(res, success.refreshCookie);
    return { accessToken: success.accessToken, user: success.user };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  async disable2FA(@CurrentUser() user: AuthenticatedUser, @Body() body: DisableTwoFactorDto) {
    await this.auth.disable2FA(user.id, body.password, body.code);
    return { enabled: false };
  }

  // ── OAuth ───────────────────────────────────────────────────────────────

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('google')
  googleStart(): void {
    /* handled by GoogleOAuthGuard redirect */
  }

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = (req as Request & { user: OAuthProfileSummary }).user;
    const success = await this.auth.oauthSync('google', profile);
    this.setRefreshCookie(res, success.refreshCookie);
    res.redirect(this.oauthSuccessRedirect(success.accessToken));
  }

  @Public()
  @UseGuards(MicrosoftOAuthGuard)
  @Get('microsoft')
  microsoftStart(): void {
    /* handled by MicrosoftOAuthGuard redirect */
  }

  @Public()
  @UseGuards(MicrosoftOAuthGuard)
  @Get('microsoft/callback')
  async microsoftCallback(@Req() req: Request, @Res() res: Response) {
    const profile = (req as Request & { user: OAuthProfileSummary }).user;
    const success = await this.auth.oauthSync('microsoft', profile);
    this.setRefreshCookie(res, success.refreshCookie);
    res.redirect(this.oauthSuccessRedirect(success.accessToken));
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private setRefreshCookie(res: Response, payload: { value: string; expiresAt: Date }): void {
    res.cookie(REFRESH_COOKIE, payload.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: payload.expiresAt,
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    });
  }

  private oauthSuccessRedirect(accessToken: string): string {
    const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
    return `${webUrl}/auth/oauth-callback?at=${encodeURIComponent(accessToken)}`;
  }
}
