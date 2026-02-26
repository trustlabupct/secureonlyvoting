import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { loginWithEmail, loginWithCertificate } from "../actions/auth-actions"
import { LoginFormTabs } from "./login-form-tabs" // Import the new client component

// Map error codes to user-friendly messages
const errorMessages: Record<string, string> = {
  invalid_credentials: "Login failed. Please check your email and password or certificate ID.",
  validation_failed: "Invalid input provided. Please check the form fields.",
  login_failed: "An unexpected error occurred during login. Please try again later.",
  // Add more specific error messages if needed
};

// Correct signature for App Router page component (treating searchParams as Promise)
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }> // Type as Promise
}) {
  // 1️⃣ check for existing session
  const user = await getCurrentUser()
  if (user) {
    redirect("/dashboard")
  }

  // ◀️ Await the searchParams promise
  const { error } = await searchParams

  // 2️⃣ map your error codes using the awaited error variable
  const errorMessage = error
    ? errorMessages[error] ?? "An unknown error occurred."
    : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Secure Voting System</CardTitle>
          <CardDescription className="text-center">Sign in to access your voting dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Render the client component, passing server actions and error message */}
          <LoginFormTabs
            loginWithEmail={loginWithEmail}
            loginWithCertificate={loginWithCertificate}
            errorMessage={errorMessage}
          />
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-500">Secure authentication for the voting platform</p>
        </CardFooter>
      </Card>
    </div>
  )
}
