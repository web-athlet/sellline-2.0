import type { AuthOptions, Session, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { apiFetch } from './api-client';

interface ApiLoginResponse {
  accessToken?: string;
  user?: { id: string; email: string; name: string; role: string; twoFactorEnabled: boolean };
  requires2FA?: boolean;
  preAuthToken?: string;
  requires2FASetup?: boolean;
  setupToken?: string;
}

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        accessToken: { label: 'Access Token', type: 'text' },
      },
      async authorize(creds): Promise<User | null> {
        if (!creds) return null;

        // OAuth handoff path: caller has a freshly-issued access token from the API.
        if (creds.accessToken) {
          const me = await apiFetch<{
            id: string;
            email: string;
            name: string;
            role: string;
            twoFactorEnabled: boolean;
          }>('/api/v1/auth/me', { accessToken: creds.accessToken });
          return {
            id: me.id,
            email: me.email,
            name: me.name,
            role: me.role,
            accessToken: creds.accessToken,
            twoFactorEnabled: me.twoFactorEnabled,
          } as unknown as User;
        }

        if (!creds.email || !creds.password) return null;

        const res = await apiFetch<ApiLoginResponse>('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: creds.email, password: creds.password }),
        });

        if (res.requires2FA) {
          return {
            id: res.user!.id,
            email: res.user!.email,
            name: res.user!.name,
            role: res.user!.role,
            twoFactorEnabled: true,
            preAuthToken: res.preAuthToken,
          } as unknown as User;
        }
        if (res.requires2FASetup) {
          return {
            id: res.user!.id,
            email: res.user!.email,
            name: res.user!.name,
            role: res.user!.role,
            twoFactorEnabled: false,
            setupToken: res.setupToken,
          } as unknown as User;
        }
        if (!res.accessToken || !res.user) return null;
        return {
          id: res.user.id,
          email: res.user.email,
          name: res.user.name,
          role: res.user.role,
          accessToken: res.accessToken,
          twoFactorEnabled: res.user.twoFactorEnabled,
        } as unknown as User;
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }): Promise<JWT> {
      if (user) {
        const u = user as User & {
          accessToken?: string;
          role?: string;
          preAuthToken?: string;
          setupToken?: string;
          twoFactorEnabled?: boolean;
        };
        token.accessToken = u.accessToken;
        token.role = u.role;
        token.preAuthToken = u.preAuthToken;
        token.setupToken = u.setupToken;
        token.twoFactorEnabled = u.twoFactorEnabled;
        token.id = u.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      const t = token as JWT & {
        id?: string;
        accessToken?: string;
        role?: string;
        preAuthToken?: string;
        setupToken?: string;
        twoFactorEnabled?: boolean;
      };
      session.user = {
        ...session.user,
        id: t.id ?? '',
        role: t.role ?? 'SALES_REP',
        twoFactorEnabled: t.twoFactorEnabled ?? false,
      } as Session['user'];
      session.accessToken = t.accessToken;
      session.preAuthToken = t.preAuthToken;
      session.setupToken = t.setupToken;
      return session;
    },
  },
};
