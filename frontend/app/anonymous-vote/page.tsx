"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Users, Vote } from "lucide-react"

interface PollOption {
  id: string
  name: string
}

interface Poll {
  id: string
  name: string
  description: string | null
  options: PollOption[]
  anonymous: boolean
  canVote: boolean
}

export default function AnonymousVotePage() {
  const [polls, setPolls] = useState<Poll[]>([])
  const [selectedPollId, setSelectedPollId] = useState("")
  const [selectedOptionId, setSelectedOptionId] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info")
  const [accessToken, setAccessToken] = useState("")
  const [blindTokenId, setBlindTokenId] = useState("")

  const selectedPoll = useMemo(
    () => polls.find((poll) => poll.id === selectedPollId) ?? null,
    [polls, selectedPollId],
  )

  const setStatus = (type: "success" | "error" | "info", text: string) => {
    setMessageType(type)
    setMessage(text)
  }

  const requestBlindToken = async (token: string) => {
    const response = await fetch("/api/blind-tokens/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || "Failed to generate blind token")
    }

    const tokenData = await response.json()
    const generatedTokenId = tokenData?.data?.blindTokenId
    if (!generatedTokenId) {
      throw new Error("Blind token response was missing blindTokenId")
    }
    setBlindTokenId(generatedTokenId)
    return generatedTokenId
  }

  const loadAnonymousPolls = async (token: string) => {
    const response = await fetch("/api/polls", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || "Failed to load polls")
    }

    const allPolls = (await response.json()) as Poll[]
    const anonymousPolls = allPolls.filter((poll) => poll.anonymous && poll.canVote)
    setPolls(anonymousPolls)

    if (anonymousPolls.length > 0) {
      setSelectedPollId(anonymousPolls[0].id)
      setSelectedOptionId("")
    }
    return anonymousPolls
  }

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: email, password }),
      })

      if (!loginResponse.ok) {
        setStatus("error", "Login failed. Please check your credentials.")
        return
      }

      const loginData = await loginResponse.json()
      if (loginData.requiresMFA) {
        setStatus(
          "error",
          "This account requires MFA. Complete MFA on the standard login page first.",
        )
        return
      }

      const token = loginData.access_token
      if (!token) {
        setStatus("error", "Login succeeded but access token was missing.")
        return
      }

      setAccessToken(token)
      const availablePolls = await loadAnonymousPolls(token)
      await requestBlindToken(token)
      setIsLoggedIn(true)

      if (availablePolls.length === 0) {
        setStatus("info", "Authenticated successfully, but no active anonymous polls are available.")
      } else {
        setStatus("success", "Successfully authenticated for anonymous voting.")
      }
    } catch (error) {
      console.error("Anonymous login error:", error)
      setStatus("error", error instanceof Error ? error.message : "Network error during login")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnonymousVote = async () => {
    if (!selectedPoll || !selectedOptionId) {
      setStatus("error", "Please select a poll and an option.")
      return
    }

    if (!accessToken) {
      setStatus("error", "Missing access token. Please authenticate again.")
      return
    }

    setIsLoading(true)
    try {
      const tokenToUse = blindTokenId || (await requestBlindToken(accessToken))

      const voteResponse = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pollId: selectedPoll.id,
          optionId: selectedOptionId,
          blindTokenId: tokenToUse,
        }),
      })

      if (!voteResponse.ok) {
        const errorData = await voteResponse.json().catch(() => ({}))
        throw new Error(errorData.message || "Vote submission failed")
      }

      setStatus("success", "Your anonymous vote has been submitted successfully.")
      setSelectedOptionId("")

      // Refresh token after successful vote because blind tokens are one-time use.
      await requestBlindToken(accessToken)
    } catch (error) {
      console.error("Anonymous voting error:", error)
      setStatus("error", error instanceof Error ? error.message : "Error submitting anonymous vote")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-4 flex items-center gap-2 text-3xl font-bold">
          <Vote className="h-8 w-8 text-blue-600" />
          Anonymous Voting System
        </h1>
        <p className="text-gray-600">Cast your vote anonymously using blind-token validation.</p>
      </div>

      {message && (
        <Alert
          className={`mb-6 ${
            messageType === "success"
              ? "border-green-500 bg-green-50"
              : messageType === "error"
                ? "border-red-500 bg-red-50"
                : "border-blue-500 bg-blue-50"
          }`}
        >
          {messageType === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>Login to request a blind token for anonymous voting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@email.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
            />
          </div>
          <Button onClick={handleLogin} disabled={isLoading || !email || !password} className="w-full">
            {isLoading ? "Authenticating..." : "Login for Anonymous Voting"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Available Anonymous Polls</CardTitle>
          <CardDescription>Select an active anonymous poll and vote option.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoggedIn && polls.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="poll-select">Poll</Label>
                <select
                  id="poll-select"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedPollId}
                  onChange={(event) => {
                    setSelectedPollId(event.target.value)
                    setSelectedOptionId("")
                  }}
                >
                  {polls.map((poll) => (
                    <option key={poll.id} value={poll.id}>
                      {poll.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPoll && (
                <div className="rounded-lg border p-4">
                  <h3 className="mb-2 font-semibold">{selectedPoll.name}</h3>
                  <p className="mb-4 text-sm text-gray-600">
                    {selectedPoll.description || "No description provided."}
                  </p>
                  <div className="space-y-2">
                    {selectedPoll.options.map((option) => (
                      <div key={option.id}>
                        <input
                          type="radio"
                          id={`option-${option.id}`}
                          name="vote-option"
                          value={option.id}
                          checked={selectedOptionId === option.id}
                          onChange={(event) => setSelectedOptionId(event.target.value)}
                          className="mr-2"
                        />
                        <label htmlFor={`option-${option.id}`}>{option.name}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600">
              {isLoggedIn
                ? "No active anonymous polls are available right now."
                : "Authenticate first to load anonymous polls."}
            </p>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleAnonymousVote}
        disabled={isLoading || !isLoggedIn || !selectedPoll || !selectedOptionId}
        className="w-full"
        size="lg"
      >
        {isLoading ? "Submitting..." : "Submit Anonymous Vote"}
      </Button>
    </div>
  )
}
