"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginWithEmail } from "../actions/auth-actions" // Import the server action

export function EmailLoginForm() {
  return (
    <form
      action={loginWithEmail} // Use the server action
      className="space-y-4"
    >
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="name@example.com"
          required
          autoComplete="email"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full">
        Sign in with Email
      </Button>
    </form>
  )
}
