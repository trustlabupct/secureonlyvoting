"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle } from "lucide-react"
import { createPoll } from "@/lib/admin-actions"
import { Separator } from "@/components/ui/separator"
import { VotingMechanismConfig } from "./voting-mechanism-config"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Define enums locally matching backend
enum PollVisibility {
  EVERYONE = "everyone",
  ADMIN_ONLY = "admin-only",
  SPECIFIC_GROUPS = "specific-groups",
}

// Define allowed voting mechanisms explicitly
type VotingMechanism = "yes-no" | "multiple-choice" | "multiple-selection" | "ranking" | "rating" | "text-response";

enum ShowResultsTo {
  VOTERS = "voters",
  ADMINS = "admins",
  EVERYONE_AFTER_CLOSE = "everyone-after-close",
}

// Define expected payload type matching backend CreatePollDto structure
type PollCreationPayload = {
  name: string;
  description: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  votingMechanism: VotingMechanism; // Use the specific type
  options?: string[];
  ratingScale?: { min: number; max: number; step?: number; labels?: { min?: string; max?: string; mid?: string; } };
  visibility: PollVisibility;
  allowedGroups: string[] | undefined;
  showResultsTo?: ShowResultsTo[];
  anonymous?: boolean;
  allowComments?: boolean;
};

export function CreatePollForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(new Date().setDate(new Date().getDate() + 7)), // Default to 7 days from now
  )
  const [votingMechanism, setVotingMechanism] = useState<VotingMechanism>("yes-no")
  const [options, setOptions] = useState<string[]>(["", ""])
  const [ratingScale, setRatingScale] = useState({
    min: 1,
    max: 5,
    step: 1,
    labels: {
      min: "",
      max: "",
      mid: "",
    },
  })
  const [visibility, setVisibility] = useState<PollVisibility>(PollVisibility.EVERYONE)
  const [allowedGroupsInput, setAllowedGroupsInput] = useState<string>("") // New state for input field
  const [showResultsTo, setShowResultsTo] = useState<ShowResultsTo[]>([ShowResultsTo.VOTERS, ShowResultsTo.ADMINS]) // New state
  const [anonymous, setAnonymous] = useState(true)
  const [allowComments, setAllowComments] = useState(false)

  const handleShowResultsChange = (value: ShowResultsTo) => {
    setShowResultsTo(prev => 
      prev.includes(value) 
        ? prev.filter(item => item !== value) 
        : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setResult(null)

    try {
      // Validate form
      if (!title || !description || !startDate || !endDate) {
        setResult({
          success: false,
          message: "Please fill in all required fields.",
        })
        setIsSubmitting(false)
        return
      }

      if (
        (votingMechanism === "multiple-choice" ||
          votingMechanism === "multiple-selection" ||
          votingMechanism === "ranking") &&
        options.filter((o) => o.trim()).length < 2
      ) {
        setResult({
          success: false,
          message: "Please provide at least two options for this voting mechanism.",
        })
        setIsSubmitting(false)
        return
      }

      // Parse allowed groups from input
      const parsedAllowedGroups = visibility === PollVisibility.SPECIFIC_GROUPS
        ? allowedGroupsInput.split(",").map(g => g.trim()).filter(g => g !== "")
        : undefined;

      if (visibility === PollVisibility.SPECIFIC_GROUPS && (!parsedAllowedGroups || parsedAllowedGroups.length === 0)) {
           setResult({
              success: false,
              message: "Please enter at least one group name when visibility is set to Specific Groups.",
            })
            setIsSubmitting(false)
            return
      }

      // Create poll data with explicit type
      const pollData: PollCreationPayload = {
        name: title, 
        description,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        votingMechanism: votingMechanism, // State now matches payload type
        options: ["multiple-choice", "multiple-selection", "ranking"].includes(votingMechanism)
          ? options.map(o => o.trim()).filter((o) => o)
          : undefined,
        ratingScale: votingMechanism === "rating" ? ratingScale : undefined,
        visibility: visibility,
        allowedGroups: parsedAllowedGroups,
        showResultsTo: showResultsTo.length > 0 ? showResultsTo : undefined,
        anonymous: anonymous,
        allowComments: allowComments,
      }
      console.log('Submitting Poll Data:', pollData); 

      // Submit the poll
      const result = await createPoll(pollData)
      setResult(result)

      if (result.success) {
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/dashboard")
        }, 2000)
      }
    } catch (error) { // Catch specific errors if possible
       console.error("Poll creation error:", error); // Log the actual error
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while creating the poll. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {result && (
        <Alert variant={result.success ? "default" : "destructive"}> {/* Changed variant to default */}
          {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Poll Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter poll title"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter poll description"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <DateTimePicker date={startDate} setDate={setStartDate} granularity="minute" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date *</Label>
            <DateTimePicker date={endDate} setDate={setEndDate} granularity="minute" />
          </div>
        </div>

        <Separator className="my-4" />

        {/* Voting Mechanism Configuration */}
        <VotingMechanismConfig
          votingMechanism={votingMechanism}
          setVotingMechanism={setVotingMechanism as (value: string) => void}
          options={options}
          setOptions={setOptions}
          ratingScale={ratingScale}
          setRatingScale={setRatingScale}
        />

        <Separator className="my-4" />

        <div className="space-y-2">
          <Label htmlFor="visibility">Visibility *</Label>
          <Select value={visibility} onValueChange={(value) => setVisibility(value as PollVisibility)}>
            <SelectTrigger>
              <SelectValue placeholder="Select visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="admin-only">Administrators Only</SelectItem>
              <SelectItem value="specific-groups">Specific Groups</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {visibility === PollVisibility.SPECIFIC_GROUPS && (
          <div className="space-y-2 p-3 border rounded-md bg-secondary/50">
            <Label htmlFor="allowedGroupsInput">Allowed Groups *</Label>
            <Input
              id="allowedGroupsInput"
              value={allowedGroupsInput}
              onChange={(e) => setAllowedGroupsInput(e.target.value)}
              placeholder="Enter group names, comma-separated (e.g., group1, group2)"
              required={visibility === PollVisibility.SPECIFIC_GROUPS}
            />
            <p className="text-xs text-muted-foreground">
Enter the exact group names that users must belong to. Separate multiple groups with commas.</p>
          </div>
        )}

        <Separator className="my-4" />
        
        {/* Show Results To Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Results Visibility</CardTitle>
            <p className="text-sm text-muted-foreground">
                Control who can see the poll results and when.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="show-admins"
                checked={showResultsTo.includes(ShowResultsTo.ADMINS)}
                onCheckedChange={() => handleShowResultsChange(ShowResultsTo.ADMINS)}
              />
              <Label htmlFor="show-admins" className="font-normal">
                Administrators (can always see results)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="show-voters"
                checked={showResultsTo.includes(ShowResultsTo.VOTERS)}
                onCheckedChange={() => handleShowResultsChange(ShowResultsTo.VOTERS)}
              />
              <Label htmlFor="show-voters" className="font-normal">
                 Voters (can see results after voting or after poll closes)
              </Label>
            </div>
             <div className="flex items-center space-x-2">
              <Checkbox 
                id="show-everyone-after-close"
                checked={showResultsTo.includes(ShowResultsTo.EVERYONE_AFTER_CLOSE)}
                onCheckedChange={() => handleShowResultsChange(ShowResultsTo.EVERYONE_AFTER_CLOSE)}
              />
              <Label htmlFor="show-everyone-after-close" className="font-normal">
                 Everyone (can see results only after the poll closes)
              </Label>
            </div>
             {showResultsTo.length === 0 && (
                <p className="text-xs text-destructive">Warning: If no group is selected, results might be hidden from everyone except potentially super-admins.</p>
            )}
          </CardContent>
        </Card>

        <Separator className="my-4" />

        {/* Other Settings (Anonymous, Allow Comments) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <div className="flex items-center space-x-2">
            <Switch id="anonymous-voting" checked={anonymous} onCheckedChange={setAnonymous} />
            <Label htmlFor="anonymous-voting">Anonymous Voting</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="allow-comments" checked={allowComments} onCheckedChange={setAllowComments} />
            <Label htmlFor="allow-comments">Allow Comments</Label>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating Poll..." : "Create Poll"}
      </Button>
    </form>
  )
}
