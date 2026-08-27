import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

/**
 * Configuração NextAuth (Auth.js v5).
 * - Credenciais validam contra o Supabase Auth (admin client).
 * - Google OAuth: o usuário é sincronizado com o Supabase Auth (fonte de
 *   verdade) no callback `signIn` — se o e-mail ainda não existir, é criado
 *   via admin.createUser; se existir, apenas vincula o id.
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
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Sincroniza usuários do Google com o Supabase Auth (fonte de verdade).
      if (account?.provider === "google" && user.email) {
        const supabase = createAdminClient();
        const { data: existing, error: listError } =
          await supabase.auth.admin.listUsers();

        if (listError || !existing) {
          console.error("[auth/google] Falha ao consultar usuários:", listError?.message);
          return false;
        }

        const found = existing.users.find(
          (u: { email?: string | null }) =>
            u.email?.toLowerCase() === user.email!.toLowerCase()
        );

        if (found) {
          // Já existe no Supabase — usa o id do Supabase como id da sessão.
          user.id = found.id;
        } else {
          // Cria no Supabase para manter a fonte de verdade consistente.
          const { data: created, error: createError } =
            await supabase.auth.admin.createUser({
              email: user.email,
              email_confirm: true,
              user_metadata: {
                full_name: user.name ?? user.email,
                avatar_url: user.image ?? null,
              },
            });

          if (createError || !created.user) {
            console.error("[auth/google] Falha ao criar usuário:", createError?.message);
            return false;
          }
          user.id = created.user.id;
        }
      }
      return true;
    },
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
