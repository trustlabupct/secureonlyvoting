"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
// Removed: import { createSessionToken, verifyPassword, verifyCertificate, users } from "@/lib/auth-node"
import { z } from "zod"

// Backend API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Schemas remain the same...
const EmailLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})
const CertificateLoginSchema = z.object({
  certificateId: z.string().min(1, "Certificate ID is required"),
})

// Email login action - Simplified to always redirect
export async function loginWithEmail(formData: FormData) {
  console.log("[Action] Attempting email login...");

  // --- Validation ---
  console.log("[Action] Validating fields...");
  const validatedFields = EmailLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    console.error("[Action] Validation failed:", validatedFields.error.flatten().fieldErrors);
    redirect('/login?error=validation_failed');
  }
  console.log("[Action] Validation successful. Email:", validatedFields.data.email);
  const { email, password } = validatedFields.data;

  // --- API Call for Login ---
  let loginResponse = null;
  try {
    console.log(`[Action] Calling backend login API for username: ${email}...`); // Using email as username
    const response = await fetch(`/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Backend expects 'username', we send the email field value as username
      body: JSON.stringify({ username: email, password: password }),
    });

    if (!response.ok) {
      // Handle specific auth error (401) vs other errors
      if (response.status === 401) {
        console.error(`[Action] API Auth failed for ${email}: Invalid credentials`);
        redirect("/login?error=invalid_credentials");
      } else {
        // Handle other potential API errors (500, etc.)
        const errorBody = await response.text(); // Get error details if possible
        console.error(`[Action] API login failed for ${email}: ${response.status} ${response.statusText}`, errorBody);
        redirect(`/login?error=login_failed&status=${response.status}`);
      }
      return; // Stop execution after redirect
    }

    // Login successful, get the response data
    loginResponse = await response.json();
    console.log(`[Action] API login successful for ${email}. RequiresMFA:`, loginResponse.requiresMFA);

  } catch (error) {
    console.error("[Action] Network or fetch error during API login:", error);
    redirect('/login?error=network_error');
    return; // Stop execution after redirect
  }

  // --- Handle MFA or Set Cookie ---
  if (loginResponse?.requiresMFA) {
    // MFA is required - this should be handled by client-side component
    // For server actions, we can't handle MFA flow, so redirect with special parameter
    console.log("[Action] MFA required, redirecting to handle client-side...");
    redirect('/login?mfa_required=true');
    return;
  }

  // No MFA required, proceed with normal login
  const accessToken = loginResponse?.access_token || loginResponse?.token;
  if (accessToken) {
    try {
        console.log("[Action] Setting HTTP-only session cookie via API route...");
        // Use the API route to set HTTP-only cookie
        const setCookieResponse = await fetch('/api/auth/set-cookie', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: accessToken }),
        });
        
        if (!setCookieResponse.ok) {
          console.error("[Action] Failed to set cookie via API route:", setCookieResponse.status);
          redirect('/login?error=cookie_error');
          return;
        }
        
        console.log("[Action] HTTP-only cookie set successfully.");
    } catch (error) {
        console.error("[Action] Error during cookie setting:", error);
        redirect('/login?error=cookie_error');
        return; // Stop execution
    }
  } else {
     // Should not happen if API call was successful, but as a safeguard
     console.error("[Action] Access token was missing after successful API call.");
     redirect('/login?error=token_missing');
     return; // Stop execution
  }


  // --- Success Redirect ---
  console.log("[Action] Redirecting to dashboard...");
  redirect("/dashboard");
}

// Certificate login action - TODO: Implement with backend API call
export async function loginWithCertificate(formData: FormData) {
  console.log("[Action] Certificate login not yet implemented");
  redirect('/login?error=certificate_login_not_implemented');
}

// Logout action remains the same
export async function logout() {
  console.log("[Action] Logging out...");
  const cookieStoreLogout = await cookies();
  cookieStoreLogout.delete("session");
  console.log("[Action] Session cookie deleted. Redirecting to /login...");
  redirect("/login");
}
