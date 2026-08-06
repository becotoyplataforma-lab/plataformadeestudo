import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

/**
 * Configuração NextAuth (Auth.js v5).
 * - Credenciais validam contra o Supabase Auth (admin client).
 * - A sessão (JWT) carrega o user_id do Supabase para uso no banco.
 */

interface CredentialsInput {
  email?: string;
  password?: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const { email, password } = credentials as CredentialsInput;
        if (!email || !password) return null;

        const supabase = createAdminClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) return null;

        return {
          id: data.user.id,
          email: data.user.email ?? email,
          name:
            data.user.user_metadata?.full_name ??
            data.user.user_metadata?.name ??
            email,
          image: data.user.user_metadata?.avatar_url ?? undefined,
        } as User;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
      }
      return session;
    },
  },
});
