import { useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"; // Adjust import as necessary
import { Button } from "@/components/ui/button"; // Import Button and other UI elements
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Clock, X } from "lucide-react";
import { Availability } from "@/types";
// Define the props for the AvailabilityForm component
interface AvailabilityFormProps {
  availabilityList: Availability[];
  setAvailabilityList: (availability: Availability[]) => void;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const formatTime = (time: string) => {
  if (time) {
    const [hours, minutes] = time.split(":");
    const formattedHours = Number(hours) % 12 || 12; // Convert to 12-hour format
    const ampm = Number(hours) >= 12 ? "PM" : "AM"; // Determine AM or PM
    return `${formattedHours}:${minutes} ${ampm}`; // Return formatted time
  }
};

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// Generates 15-minute-interval time options between 6am and 10pm, same as
// AvailabilityForm2's picker; end options are limited to times after the
// selected start time.
const generateTimeOptions = (selectedStartTime?: string) => {
  const startTimeSet = new Set<string>();
  const endTimeSet = new Set<string>();

  for (let minutes = 6 * 60; minutes <= 22 * 60; minutes += 15) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeString = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    startTimeSet.add(timeString);
  }

  if (selectedStartTime) {
    const selectedStartMinutes = timeToMinutes(selectedStartTime);
    for (let minutes = selectedStartMinutes + 15; minutes <= 22 * 60 + 15; minutes += 15) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeString = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
      endTimeSet.add(timeString);
    }
  }

  return {
    startOptions: Array.from(startTimeSet).sort(),
    endOptions: Array.from(endTimeSet).sort(),
  };
};

const AvailabilityForm: React.FC<AvailabilityFormProps> = ({
  availabilityList,
  setAvailabilityList,
}) => {
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  const [usePickerTime, setUsePickerTime] = useState(false);

  const { startOptions, endOptions } = generateTimeOptions(selectedStartTime);

  const toggleTimeInputMode = (checked: boolean) => {
    setUsePickerTime(checked);
    setSelectedStartTime("");
    setSelectedEndTime("");
  };

  const handleStartTimeChange = (value: string) => {
    setSelectedStartTime(value);
    setSelectedEndTime("");
  };

  const addAvailability = () => {
    if (selectedDay && selectedStartTime && selectedEndTime) {
      const updatedList = [
        {
          day: selectedDay,
          startTime: selectedStartTime,
          endTime: selectedEndTime,
        },
      ];
      setAvailabilityList(updatedList);
      setSelectedDay("");
      setSelectedStartTime("");
      setSelectedEndTime("");
    }
  };

  const removeAvailability = (index: number) => {
    const updatedList = availabilityList.filter((_, i) => i !== index);
    setAvailabilityList(updatedList); // Use the prop function to set the updated list
  };

  return (
    <div className="availability-form space-y-4">
      <Label className="text-base font-semibold">Enrollment Schedule (EST)</Label>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="font-medium text-sm">Enter enrollment time</Label>
          <div className="flex items-center gap-2">
            <Label htmlFor="use-time-picker" className="text-sm font-normal text-muted-foreground">
              Use time picker
            </Label>
            <Switch
              id="use-time-picker"
              checked={usePickerTime}
              onCheckedChange={toggleTimeInputMode}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="day" className="text-sm">
              Day
            </Label>
            <Select
              name="day"
              value={selectedDay}
              onValueChange={(value) => setSelectedDay(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day} value={day}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="start-time" className="text-sm">
              Start Time
            </Label>
            {usePickerTime ? (
              <Select value={selectedStartTime} onValueChange={handleStartTimeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent>
                  {startOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTime(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="time"
                id="start-time"
                value={selectedStartTime}
                onChange={(e) => setSelectedStartTime(e.target.value)}
              />
            )}
          </div>

          <div>
            <Label htmlFor="end-time" className="text-sm">
              End Time
            </Label>
            {usePickerTime ? (
              <Select
                value={selectedEndTime}
                onValueChange={setSelectedEndTime}
                disabled={!selectedStartTime || endOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedStartTime ? "Select start time first" : "Select end time"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {endOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTime(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="time"
                id="end-time"
                value={selectedEndTime}
                onChange={(e) => setSelectedEndTime(e.target.value)}
              />
            )}
          </div>
        </div>

        <Button
          onClick={addAvailability}
          disabled={!selectedDay || !selectedStartTime || !selectedEndTime}
        >
          Set Schedule
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="font-medium text-sm">Selected Schedule</Label>
        {availabilityList.length > 0 ? (
          <div className="space-y-2">
            {availabilityList.map((availability, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    <strong>{availability.day}</strong> from {formatTime(availability.startTime)}{" "}
                    to {formatTime(availability.endTime)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeAvailability(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm bg-muted/50 p-4 rounded-lg border-dashed border-2">
            Select a date and time
          </p>
        )}
      </div>
    </div>
  );
};

export default AvailabilityForm;
