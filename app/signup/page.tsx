import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";

export const metadata: Metadata = { title: "Skapa konto" };

export default function SignupPage() {
  return <AuthPage initialMode="signup" />;
}
