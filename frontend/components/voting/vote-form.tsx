"use client"

import type React from "react"
import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, EyeOff, Eye, MessageSquare, Loader2 } from "lucide-react"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { GripVertical } from "lucide-react"
import Link from "next/link"
import { submitVoteClient } from "@/lib/vote-client"
import type { VotePayload } from "@/lib/vote-actions"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Use PollWithPermissions type defined similar to PollPage
type PollOption = { id: string; name: string; description?: string };
type RatingScale = { min: number; max: number; step?: number; labels?: { min?: string; max?: string; mid?: string; } };
type PollVisibility = "everyone" | "admin-only" | "specific-groups";
type ShowResultsTo = "voters" | "admins" | "everyone-after-close";
type PollWithPermissions = {
  id: string;
  name: string;
  description: string | null;
  startTime: string; 
  endTime: string; 
  votingMechanism: string;
  ratingScale: RatingScale | null;
  allowComments: boolean;
  visibility: PollVisibility;
  allowedGroups: string[] | null;
  showResultsTo: ShowResultsTo[];
  options: PollOption[];
  createdAt: string; 
  updatedAt: string; 
  hasVoted: boolean; 
  canView: boolean; 
  canVote: boolean; 
  showResultsRealtime: boolean; 
  showResultsAfterClose: boolean;
  anonymous: boolean;
};

interface VoteFormProps {
  poll: PollWithPermissions;
  userId: string;
}

// Helper function to round to the nearest step
function roundToStep(value: number, min: number, max: number, step: number): number {
    if (step <= 0) return Math.max(min, Math.min(value, max)); // Avoid division by zero or weird behavior
    const steps = Math.floor((value - min) / step);
    const lowerBound = min + steps * step;
    const upperBound = min + (steps + 1) * step;
    // Ensure upper bound doesn't exceed max
    const effectiveUpperBound = Math.min(upperBound, max);
    // Determine which step boundary is closer
    const roundedValue = (value - lowerBound < effectiveUpperBound - value) ? lowerBound : effectiveUpperBound;
    // Clamp final value within min/max bounds
    return Math.max(min, Math.min(roundedValue, max));
}

// Helper function to get color based on rating value
function getRatingColor(value: number | null, min: number, max: number): string {
    if (value === null) {
        return 'hsl(0, 0%, 80%)'; // Default grey if no value
    }
    if (min === max) return 'hsl(120, 70%, 50%)'; // Avoid division by zero, return green

    // Normalize value to 0-1 range
    const percentage = (value - min) / (max - min);

    // Interpolate hue from red (0) to green (120)
    const hue = percentage * 120;

    // Use HSL color space (adjust saturation and lightness for better look)
    const saturation = 70; // Slightly desaturated
    const lightness = 50; // Standard lightness

    return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness}%)`;
}

export function VoteForm({ poll, userId }: VoteFormProps) {
  const router = useRouter();
  console.log("[VoteForm Debug] Rendering with props:", { poll, userId });

  const [yesNoValue, setYesNoValue] = useState<string | null>(null);
  const [singleChoiceValue, setSingleChoiceValue] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);

  const calculateInitialRating = () => {
      if (!poll.ratingScale) return null;
      const { min, max, step = 1 } = poll.ratingScale;
      if (min === max) return min;
      const midpoint = (min + max) / 2;
      return roundToStep(midpoint, min, max, step);
  };
  const initialRating = calculateInitialRating();
  const [ratingValue, setRatingValue] = useState<number | null>(initialRating);
  const [rankingOrder, setRankingOrder] = useState<PollOption[]>(poll.options || []);
  const [textResponse, setTextResponse] = useState<string>("");
  const [comment, setComment] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string; voteId?: string } | null>(null);

  const ratingColor = poll.votingMechanism === 'rating' && poll.ratingScale
      ? getRatingColor(ratingValue, poll.ratingScale.min, poll.ratingScale.max)
      : 'hsl(0, 0%, 80%)';

  useEffect(() => {
    if (result?.success) {
      const now = new Date();
      const pollEndTime = new Date(poll.endTime);
      const pollHasEnded = now > pollEndTime;

      if (pollHasEnded) {
        const redirectTimer = setTimeout(() => {
          router.push(`/polls/${poll.id}/results`);
        }, 2000);
        return () => clearTimeout(redirectTimer);
      } 
    }
  }, [result, router, poll.id, poll.endTime]);

  const handleCheckboxChange = (optionId: string, checked: boolean) => {
    if (checked) {
      setSelectedOptionIds([...selectedOptionIds, optionId]);
    } else {
      setSelectedOptionIds(selectedOptionIds.filter((id) => id !== optionId));
    }
  };

  const onDragEnd = (dropResult: DropResult) => {
    if (!dropResult.destination) return;
    const items = Array.from(rankingOrder);
    const [reorderedItem] = items.splice(dropResult.source.index, 1);
    items.splice(dropResult.destination.index, 0, reorderedItem);
    setRankingOrder(items);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);

    const voteData: VotePayload = {
        comment: poll.allowComments ? comment : undefined,
    };
    let isValid = true;

    switch (poll.votingMechanism) {
      case "yes-no":
        const yesNoOption = poll.options?.find(opt => opt.name.toLowerCase() === yesNoValue?.toLowerCase());
        if (!yesNoValue || !yesNoOption) {
             setResult({ success: false, message: "Please select 'Yes' or 'No'." });
             isValid = false;
        } else {
             voteData.optionId = yesNoOption.id;
        }
        break;
      case "multiple-choice":
        if (!singleChoiceValue) {
            setResult({ success: false, message: "Please select an option." });
            isValid = false;
        } else {
            voteData.optionId = singleChoiceValue;
        }
        break;
      case "multiple-selection":
        if (selectedOptionIds.length === 0) {
            setResult({ success: false, message: "Please select at least one option." });
            isValid = false;
        } else {
            voteData.selectedOptionIds = selectedOptionIds;
        }
        break;
      case "rating":
         if (ratingValue === null) { 
             setResult({ success: false, message: "Please select a rating." });
             isValid = false;
         } else {
             const { min, max, step = 1 } = poll.ratingScale ?? { min: 0, max: 0, step: 1};
             voteData.ratingValue = roundToStep(ratingValue, min, max, step);
         }
         break;
      case "ranking":
         if (rankingOrder.length !== poll.options?.length) {
             setResult({ success: false, message: "Please rank all options." });
             isValid = false;
         } else {
             voteData.rankedOptionIds = rankingOrder.map(option => option.id);
         }
         break;
      case "text-response":
         if (!textResponse || textResponse.trim() === "") {
             setResult({ success: false, message: "Please provide a response." });
             isValid = false;
         } else if (textResponse.length > 5000) { 
             setResult({ success: false, message: "Response is too long (max 5000 characters)." });
             isValid = false;
         } else {
            voteData.textResponse = textResponse;
         }
         break;
      default:
        setResult({ success: false, message: `Unsupported voting mechanism: ${poll.votingMechanism}`});
        isValid = false;
        break;
    }

    if (!isValid) return;

    startTransition(async () => {
      try {
        const voteResult = await submitVoteClient(poll.id, voteData, poll);
        setResult(voteResult);
      } catch (error) {
        console.error("Vote submission error:", error);
        setResult({
          success: false,
          message: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      }
    });
  };

  const renderVotingMechanism = () => {
    switch (poll.votingMechanism) {
      case "yes-no":
        return (
          <div className="space-y-3">
            <RadioGroup value={yesNoValue ?? undefined} onValueChange={setYesNoValue} className="space-y-2">
              {poll.options?.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.name} id={`option-${option.id}`} />
                  <Label htmlFor={`option-${option.id}`}>{option.name}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case "multiple-choice":
         return (
           <div className="space-y-3">
             <h3 className="text-lg font-medium">Select One Option</h3>
             <RadioGroup value={singleChoiceValue ?? undefined} onValueChange={setSingleChoiceValue} className="space-y-2">
              {poll.options?.map((option) => (
                 <div key={option.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                  <Label htmlFor={`option-${option.id}`} className="flex items-center">
                    {option.name}
                    {option.description && (
                       <TooltipProvider>
                         <Tooltip>
                           <TooltipTrigger asChild>
                             <span className="ml-2 text-gray-400 cursor-help">(?)</span>
                           </TooltipTrigger>
                           <TooltipContent>
                             <p>{option.description}</p>
                           </TooltipContent>
                         </Tooltip>
                       </TooltipProvider>
                     )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
           </div>
        );
       case "multiple-selection":
          return (
             <div className="space-y-3">
               <h3 className="text-lg font-medium">Select All That Apply</h3>
               <div className="space-y-2">
                 {poll.options?.map((option) => (
                   <div key={option.id} className="flex items-center space-x-2">
                     <Checkbox
                       id={`option-${option.id}`}
                       checked={selectedOptionIds.includes(option.id)}
                       onCheckedChange={(checked) => handleCheckboxChange(option.id, !!checked)}
                     />
                     <Label htmlFor={`option-${option.id}`} className="flex items-center">
                       {option.name}
                       {option.description && (
                         <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <span className="ml-2 text-gray-400 cursor-help">(?)</span>
                             </TooltipTrigger>
                             <TooltipContent>
                               <p>{option.description}</p>
                             </TooltipContent>
                           </Tooltip>
                         </TooltipProvider>
                       )}
                     </Label>
                   </div>
                 ))}
               </div>
             </div>
           );
      case "rating":
        if (!poll.ratingScale) return <p>Rating scale not configured.</p>;
        const { min, max, step = 1, labels } = poll.ratingScale;
        const displayValue = ratingValue !== null ? ratingValue.toFixed(step < 1 ? 1 : 0) : "-";
        return (
            <div className="space-y-4 pt-2">
                <h3 className="text-lg font-medium">Rate Your Preference</h3>
                <Slider
                    value={ratingValue !== null ? [ratingValue] : []}
                    onValueChange={(value) => setRatingValue(value[0] ?? null)} 
                    min={min}
                    max={max}
                    step={step}
                    className="w-full py-2 [&>span[data-radix-collection-item]:first-child]:bg-[--slider-track-color]"
                     style={{
                       '--slider-thumb-color': ratingColor,
                       '--slider-track-color': ratingColor,
                      } as React.CSSProperties}
                />
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-muted-foreground">{labels?.min ?? min}</span>
                  {ratingValue !== null ? (
                    <span 
                      className="font-semibold px-2 py-1 rounded-full text-white text-lg shadow-sm"
                      style={{ 
                        backgroundColor: ratingColor, 
                        textShadow: '1px 1px 2px rgba(0,0,0,0.3)' 
                      }}
                    >
                      {displayValue} {labels?.mid}
                    </span>
                   ) : (
                    <span className="text-muted-foreground">Select a rating</span>
                   )}
                  <span className="text-muted-foreground">{labels?.max ?? max}</span>
                </div>
            </div>
        );
      case "ranking":
          return (
            <div className="space-y-3">
                <h3 className="text-lg font-medium">Rank the Options (Drag to reorder)</h3>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="ranking-list">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 border rounded-md p-2 bg-muted/30">
                        {rankingOrder.map((option, index) => (
                          <Draggable key={option.id} draggableId={option.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="flex items-center p-3 bg-background border rounded-md shadow-sm"
                              >
                                <div className="mr-3 text-muted-foreground cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-medium">
                                        <span className="mr-2 text-muted-foreground">{index + 1}.</span>{option.name}
                                    </div>
                                    {option.description && <p className="text-sm text-muted-foreground mt-1">{option.description}</p>}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
            </div>
          );
       case "text-response":
         return (
           <div className="space-y-2">
             <h3 className="text-lg font-medium">Your Response</h3>
             <Textarea
               value={textResponse}
               onChange={(e) => setTextResponse(e.target.value)}
               placeholder="Enter your response..."
               rows={4}
               maxLength={5000} 
             />
             <div className="text-right text-xs text-muted-foreground">{textResponse.length} / 5000 characters</div>
           </div>
         );
      default:
        return <p>Unsupported voting mechanism: {poll.votingMechanism}</p>;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Alert variant="default" className={poll.anonymous ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-yellow-50 border-yellow-200 text-yellow-800"}>
          {poll.anonymous ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <AlertTitle>{poll.anonymous ? "Anonymous Voting" : "Identified Voting"}</AlertTitle>
          <AlertDescription>
            {poll.anonymous
              ? "Your vote will be anonymous. Your identity will not be stored or displayed with your vote."
              : "Your identity will be stored with your vote and may be visible depending on poll settings."}
          </AlertDescription>
        </Alert>

      {result && (
        <Alert variant={result.success ? "default" : "destructive"} className="mt-4">
           {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
           <AlertTitle>{result.success ? "Vote Submitted" : "Submission Failed"}</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
           {result.success && (
            <div className="mt-4">
                <Button asChild variant="outline">
                     <Link href={`/polls/${poll.id}/results`}>View Results</Link>
                 </Button>
            </div>
          )}
        </Alert>
      )}

      {!result?.success && (
        <div className="space-y-4">
            {renderVotingMechanism()}
        </div>
      )}

      {poll.allowComments && !result?.success && (
        <div className="space-y-2 pt-4 border-t mt-6">
          <div className="flex items-center mb-1">
              <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />
              <Label htmlFor="comment">Additional Comment (Optional)</Label>
          </div>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add any comments here (optional)"
            rows={3}
            maxLength={1000}
          />
           <p className="text-xs text-muted-foreground text-right">{comment.length} / 1000 characters</p>
        </div>
      )}

      {!result?.success && (
        <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Vote"}
        </Button>
      )}
    </form>
  );
}
