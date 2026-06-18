import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Create your firm — Atlas" };

export default function SignupPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Start a workspace for your firm. You&apos;ll set up the firm in the next step.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <AuthForm mode="signup" />
        </Suspense>
      </CardContent>
    </Card>
  );
}
