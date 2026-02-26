"use client"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd"
import { GripVertical, Plus, Trash2 } from "lucide-react"

interface VotingMechanismConfigProps {
  votingMechanism: string
  setVotingMechanism: (mechanism: string) => void
  options: string[]
  setOptions: (options: string[]) => void
  ratingScale: {
    min: number
    max: number
    step?: number
    labels?: {
      min?: string
      max?: string
      mid?: string
    }
  }
  setRatingScale: (scale: any) => void
}

export function VotingMechanismConfig({
  votingMechanism,
  setVotingMechanism,
  options,
  setOptions,
  ratingScale,
  setRatingScale,
}: VotingMechanismConfigProps) {
  // For options management
  const handleAddOption = () => {
    setOptions([...options, ""])
  }

  const handleRemoveOption = (index: number) => {
    const newOptions = [...options]
    newOptions.splice(index, 1)
    setOptions(newOptions)
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  // For drag and drop reordering of options
  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(options)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setOptions(items)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Voting Mechanism *</Label>
        <RadioGroup value={votingMechanism} onValueChange={setVotingMechanism}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes-no" id="yes-no" />
            <Label htmlFor="yes-no">Yes/No Vote</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="multiple-choice" id="multiple-choice" />
            <Label htmlFor="multiple-choice">Multiple Choice (Single Selection)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="multiple-selection" id="multiple-selection" />
            <Label htmlFor="multiple-selection">Multiple Selection (Checkbox)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="rating" id="rating" />
            <Label htmlFor="rating">Rating Scale</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ranking" id="ranking" />
            <Label htmlFor="ranking">Ranking (Order by Preference)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="text-response" id="text-response" />
            <Label htmlFor="text-response">Text Response</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Configuration for multiple choice or multiple selection */}
      {(votingMechanism === "multiple-choice" ||
        votingMechanism === "multiple-selection" ||
        votingMechanism === "ranking") && (
        <div className="space-y-3 p-4 border rounded-md bg-gray-50">
          <Label>Options *</Label>
          <p className="text-sm text-gray-500 mb-2">
            {votingMechanism === "multiple-choice"
              ? "Voters will select one option."
              : votingMechanism === "multiple-selection"
                ? "Voters can select multiple options."
                : "Voters will rank these options in order of preference."}
          </p>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="options">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {options.map((option, index) => (
                    <Draggable key={`option-${index}`} draggableId={`option-${index}`} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex items-center space-x-2"
                        >
                          <div {...provided.dragHandleProps} className="cursor-move">
                            <GripVertical className="h-5 w-5 text-gray-400" />
                          </div>
                          <Input
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                            className="flex-1"
                          />
                          {options.length > 2 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveOption(index)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remove option</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <Button type="button" variant="outline" onClick={handleAddOption} className="mt-2">
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
        </div>
      )}

      {/* Configuration for rating scale */}
      {votingMechanism === "rating" && (
        <div className="space-y-4 p-4 border rounded-md bg-gray-50">
          <Label>Rating Scale Configuration *</Label>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ratingMin">Minimum Value</Label>
              <Input
                id="ratingMin"
                type="number"
                value={ratingScale.min}
                onChange={(e) => setRatingScale({ ...ratingScale, min: Number(e.target.value) })}
                min={0}
                max={ratingScale.max - 1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ratingMax">Maximum Value</Label>
              <Input
                id="ratingMax"
                type="number"
                value={ratingScale.max}
                onChange={(e) => setRatingScale({ ...ratingScale, max: Number(e.target.value) })}
                min={ratingScale.min + 1}
                max={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ratingStep">Step Size (Optional)</Label>
            <Input
              id="ratingStep"
              type="number"
              value={ratingScale.step || 1}
              onChange={(e) => setRatingScale({ ...ratingScale, step: Number(e.target.value) })}
              min={0.1}
              max={ratingScale.max - ratingScale.min}
              step={0.1}
              placeholder="1"
            />
            <p className="text-xs text-gray-500">Leave at 1 for whole numbers only</p>
          </div>

          <div className="space-y-4 pt-2">
            <Label>Scale Labels (Optional)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="minLabel" className="text-xs">
                  Minimum Label
                </Label>
                <Input
                  id="minLabel"
                  value={ratingScale.labels?.min || ""}
                  onChange={(e) =>
                    setRatingScale({
                      ...ratingScale,
                      labels: { ...(ratingScale.labels || {}), min: e.target.value },
                    })
                  }
                  placeholder={`${ratingScale.min} (Poor)`}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="midLabel" className="text-xs">
                  Middle Label
                </Label>
                <Input
                  id="midLabel"
                  value={ratingScale.labels?.mid || ""}
                  onChange={(e) =>
                    setRatingScale({
                      ...ratingScale,
                      labels: { ...(ratingScale.labels || {}), mid: e.target.value },
                    })
                  }
                  placeholder="Neutral"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxLabel" className="text-xs">
                  Maximum Label
                </Label>
                <Input
                  id="maxLabel"
                  value={ratingScale.labels?.max || ""}
                  onChange={(e) =>
                    setRatingScale({
                      ...ratingScale,
                      labels: { ...(ratingScale.labels || {}), max: e.target.value },
                    })
                  }
                  placeholder={`${ratingScale.max} (Excellent)`}
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Label className="mb-6 block">Preview</Label>
            <div className="space-y-6">
              <div className="flex justify-between text-sm">
                <span>{ratingScale.labels?.min || ratingScale.min}</span>
                <span>{ratingScale.labels?.mid || "Neutral"}</span>
                <span>{ratingScale.labels?.max || ratingScale.max}</span>
              </div>
              <Slider
                defaultValue={[Math.floor((ratingScale.min + ratingScale.max) / 2)]}
                max={ratingScale.max}
                min={ratingScale.min}
                step={ratingScale.step || 1}
              />
            </div>
          </div>
        </div>
      )}

      {/* Configuration for text response */}
      {votingMechanism === "text-response" && (
        <div className="space-y-3 p-4 border rounded-md bg-gray-50">
          <Label>Text Response Configuration</Label>
          <p className="text-sm text-gray-500">
            Voters will provide a written response. This is useful for collecting feedback or suggestions.
          </p>
          <div className="pt-4">
            <Label className="mb-2 block">Preview</Label>
            <Textarea placeholder="Enter your response here..." disabled />
          </div>
        </div>
      )}
    </div>
  )
}
