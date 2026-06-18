import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Sign in — Atlas" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your firm workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </CardContent>
    </Card>
  );
}
