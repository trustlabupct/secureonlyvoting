"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { EnhancedLoginForm } from "@/components/enhanced-login-form"

interface LoginFormTabsProps {
  loginWithEmail: (formData: FormData) => Promise<void>;
  loginWithCertificate: (formData: FormData) => Promise<void>;
  errorMessage: string | null;
}

export function LoginFormTabs({
  loginWithEmail,
  loginWithCertificate,
  errorMessage,
}: LoginFormTabsProps) {
  // Controlled tab state
  const [tabValue, setTabValue] = useState<"email" | "certificate">("email")

  return (
    <>
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Controlled Tabs: value and onValueChange */}
      <Tabs
        value={tabValue}
        onValueChange={(newVal) => setTabValue(newVal as "email" | "certificate")}
        className="w-full"
      >
        <TabsList aria-label="Login method" className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="email">Email Login</TabsTrigger>
          <TabsTrigger value="certificate">Certificate Login</TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <EnhancedLoginForm />
        </TabsContent>

        <TabsContent value="certificate">
          <form action={loginWithCertificate} className="space-y-4">
            <div>
              <Label htmlFor="certificateId">Certificate ID</Label>
              <Input id="certificateId" name="certificateId" type="text" required />
            </div>
            <Button type="submit" className="w-full">
              Sign in with Certificate
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </>
  )
}