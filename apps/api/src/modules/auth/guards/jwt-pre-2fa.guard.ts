import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtPre2FAGuard extends AuthGuard('jwt-pre-2fa') {}
