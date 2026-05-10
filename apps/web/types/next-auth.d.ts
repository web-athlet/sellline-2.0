import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    preAuthToken?: string;
    setupToken?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      twoFactorEnabled: boolean;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    role?: string;
    twoFactorEnabled?: boolean;
    accessToken?: string;
    preAuthToken?: string;
    setupToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    accessToken?: string;
    preAuthToken?: string;
    setupToken?: string;
    role?: string;
    twoFactorEnabled?: boolean;
  }
}
