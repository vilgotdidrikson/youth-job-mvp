import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";

export const metadata: Metadata = { title: "Logga in" };

export default function LoginPage() {
  return <AuthPage initialMode="login" />;
}
