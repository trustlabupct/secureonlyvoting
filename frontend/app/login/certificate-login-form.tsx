"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginWithCertificate } from "../actions/auth-actions" // Import the server action

export function CertificateLoginForm() {
  return (
    <form
      action={loginWithCertificate} // Use the server action
      className="space-y-4"
    >
      <div>
        <Label htmlFor="certificateId">Certificate ID</Label>
        <Input
          id="certificateId"
          name="certificateId"
          type="text"
          required
        />
      </div>
      <Button type="submit" className="w-full">
        Sign in with Certificate
      </Button>
    </form>
  )
}
