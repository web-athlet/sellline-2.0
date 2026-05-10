import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtSetup2FAGuard extends AuthGuard('jwt-setup-2fa') {}
