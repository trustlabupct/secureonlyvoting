import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  // Check if user is authenticated
  const user = await getCurrentUser()
  
  if (user) {
    // User is logged in, redirect to dashboard
    redirect("/dashboard")
  } else {
    // User is not logged in, redirect to login
    redirect("/login")
  }
  
  // This return statement will never be reached due to redirects,
  // but TypeScript requires it
  return null
} 