import { useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, Plus, X, AlertCircle, Info } from "lucide-react";

// Types
interface Availability {
  day: string;
  startTime: string;
  endTime: string;
}

interface AvailabilityFormProps {
  availabilityList: Availability[];
  setAvailabilityList: (availability: Availability[]) => void;
  openAvailabilities: Availability[];
}

const formatTime = (time: string) => {
  if (time) {
    const [hours, minutes] = time.split(":");
    const formattedHours = Number(hours) % 12 || 12;
    const ampm = Number(hours) >= 12 ? "PM" : "AM";
    return `${formattedHours}:${minutes} ${ampm}`;
  }
};

// Helper function to convert time string to minutes for comparison
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// Generate full time options for override mode
const generateFullTimeOptions = (selectedStartTime?: string) => {
  const startTimeSet = new Set<string>();
  const endTimeSet = new Set<string>();

  // Generate 15-minute intervals for full day (6 AM to 10 PM)
  for (let minutes = 6 * 60; minutes <= 22 * 60; minutes += 15) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeString = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    startTimeSet.add(timeString);
  }

  // For end times, only show times after selected start time
  if (selectedStartTime) {
    const selectedStartMinutes = timeToMinutes(selectedStartTime);
    for (
      let minutes = selectedStartMinutes + 15;
      minutes <= 22 * 60 + 15;
      minutes += 15
    ) {
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
const isTimeWithinOpenSlots = (
  day: string,
  startTime: string,
  endTime: string,
  openAvailabilities: Availability[]
): { isValid: boolean; reason?: string } => {
  if (!day || !startTime || !endTime) {
    return {
      isValid: false,
      reason: "Please select day, start time, and end time.",
    };
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (startMinutes >= endMinutes) {
    return { isValid: false, reason: "End time must be after start time." };
  }

  // Find all open slots for the selected day
  const daySlots = openAvailabilities.filter((slot) => slot.day === day);

  if (daySlots.length === 0) {
    return { isValid: false, reason: "No availability for this day." };
  }

  // Check if the ENTIRE selected time range falls within ANY single open slot
  const isWithinSlot = daySlots.some((slot) => {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    return startMinutes >= slotStart && endMinutes <= slotEnd;
  });

  if (!isWithinSlot) {
    return {
      isValid: false,
      reason:
        "Selected time must fall completely within an available time slot.",
    };
  }

  return { isValid: true };
};

// Generate time options ONLY within open availabilities with stricter bounds
const generateStrictTimeOptions = (
  day: string,
  openAvailabilities: Availability[],
  selectedStartTime?: string
) => {
  if (!day) return { startOptions: [], endOptions: [] };

  const daySlots = openAvailabilities.filter((slot) => slot.day === day);
  const startTimeSet = new Set<string>();
  const endTimeSet = new Set<string>();

  daySlots.forEach((slot) => {
    const startMinutes = timeToMinutes(slot.startTime);
    const endMinutes = timeToMinutes(slot.endTime);

    // Generate 15-minute intervals within each slot
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 15) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeString = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

      // Add to start time options (can't start at the very end of a slot)
      if (minutes < endMinutes) {
        startTimeSet.add(timeString);
      }
    }
  });

  // For end times, only show times that would create valid ranges within the same slot
  if (selectedStartTime) {
    const selectedStartMinutes = timeToMinutes(selectedStartTime);

    daySlots.forEach((slot) => {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);

      // Only consider this slot if the selected start time is within it
      if (selectedStartMinutes >= slotStart && selectedStartMinutes < slotEnd) {
        // Generate end times from 15 minutes after start time to the end of this slot
        for (
          let minutes = selectedStartMinutes + 15;
          minutes <= slotEnd;
          minutes += 15
        ) {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          const timeString = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
          endTimeSet.add(timeString);
        }
      }
    });
  }

  return {
    startOptions: Array.from(startTimeSet).sort(),
    endOptions: Array.from(endTimeSet).sort(),
  };
};

const EnhancedAvailabilityForm: React.FC<AvailabilityFormProps> = ({
  availabilityList,
  setAvailabilityList,
  openAvailabilities,
}) => {
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  const [validationError, setValidationError] = useState("");
  const [overrideMode, setOverrideMode] = useState(false);

  // Get available days from openAvailabilities (or all days if in override mode)
  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const availableDays = overrideMode
    ? daysOfWeek
    : Array.from(new Set(openAvailabilities.map((slot) => slot.day)));

  // Get time options based on selected day and start time (or full time range if in override mode)
  const { startOptions, endOptions } = overrideMode
    ? generateFullTimeOptions(selectedStartTime)
    : generateStrictTimeOptions(
        selectedDay,
        openAvailabilities,
        selectedStartTime
      );

  const addAvailability = () => {

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
  };

  const removeAvailability = (index: number) => {
    setAvailabilityList([]); // Clear the single slot
  };

  const quickAddAvailability = (availability: Availability) => {
    // Double-check validation even for quick add
    const validation = isTimeWithinOpenSlots(
      availability.day,
      availability.startTime,
      availability.endTime,
      openAvailabilities
    );

    if (!validation.isValid) {
      setValidationError(validation.reason || "Invalid time slot.");
      return;
    }

    setAvailabilityList([availability]);
    setValidationError("");
  };

  const handleStartTimeChange = (startTime: string) => {
    setSelectedStartTime(startTime);
    setSelectedEndTime("");
    setValidationError("");
  };

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
    setSelectedStartTime("");
    setSelectedEndTime("");
    setValidationError("");
  };

  const toggleOverrideMode = () => {
    setOverrideMode(!overrideMode);
    // Reset form when toggling modes
    setSelectedDay("");
    setSelectedStartTime("");
    setSelectedEndTime("");
    setValidationError("");
  };

  // Group open availabilities by day
  const groupedOpenAvailabilities = openAvailabilities.reduce(
    (acc, availability) => {
      if (!acc[availability.day]) {
        acc[availability.day] = [];
      }
      acc[availability.day].push(availability);
      return acc;
    },
    {} as Record<string, Availability[]>
  );

  // Show which open slots are still available (not conflicting with user's selections)
  const getAvailableSlots = () => {
    return openAvailabilities.filter((openSlot) => {
      return !availabilityList.some((userSlot) => {
        if (userSlot.day !== openSlot.day) return false;
        const openStart = timeToMinutes(openSlot.startTime);
        const openEnd = timeToMinutes(openSlot.endTime);
        const userStart = timeToMinutes(userSlot.startTime);
        const userEnd = timeToMinutes(userSlot.endTime);
        return userStart < openEnd && userEnd > openStart;
      });
    });
  };

  const availableSlots = getAvailableSlots();
  const groupedAvailableSlots = availableSlots.reduce(
    (acc, slot) => {
      if (!acc[slot.day]) acc[slot.day] = [];
      acc[slot.day].push(slot);
      return acc;
    },
    {} as Record<string, Availability[]>
  );

  return (
    <div className="availability-form space-y-6">
      <div>
        <Label className="text-lg font-semibold">
          Enrollment Schedule (EST)
        </Label>
        {/* <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            You can only select times within the available time slots shown. You
            can view your {"student's"} availabilities here{" "}
            <a
              href="/dashboard/my-students"
              className="underline font-semibold"
            >
              (student availabilities)
            </a>
          </span>
        </div> */}
      </div>

      {/* Show Available Time Slots */}
      {Object.keys(groupedAvailableSlots).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Available Time Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(groupedAvailableSlots).map(([day, slots]) => (
                <div key={day} className="space-y-2">
                  <Label className="font-medium text-sm">{day}</Label>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors p-2"
                      >
                        {/* <Plus className="h-3 w-3 mr-1" /> */}
                        {formatTime(slot.startTime)} -{" "}
                        {formatTime(slot.endTime)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* <p className="text-sm text-muted-foreground mt-4">
              Click on any time slot to add it to your availability
            </p> */}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {openAvailabilities.length === 0
                  ? "No time slots are currently available."
                  : "All available time slots have been selected or overlap with your existing availability."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Manual Entry Section - Only show if there are available options */}
      {availableDays.length > 0 && (
        <div className="space-y-4">
          <Label className="font-medium">Enter enrollment time</Label>

          {validationError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                {validationError}
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="day" className="text-right">
                Day:
              </Label>
              <Select
                name="day"
                value={selectedDay}
                onValueChange={handleDayChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a day" />
                </SelectTrigger>
                <SelectContent>
                  {availableDays.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start-time" className="text-right">
                Start Time:
              </Label>
              <Select
                value={selectedStartTime}
                onValueChange={handleStartTimeChange}
                disabled={!selectedDay || startOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedDay
                        ? "Select a day first"
                        : startOptions.length === 0
                          ? "No times available"
                          : "Select start time"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {startOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTime(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="end-time" className="text-right">
                End Time:
              </Label>
              <Select
                value={selectedEndTime}
                onValueChange={setSelectedEndTime}
                disabled={!selectedStartTime || endOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedStartTime
                        ? "Select start time first"
                        : endOptions.length === 0
                          ? "No end times available"
                          : "Select end time"
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
            </div>
          </div>

          <Button
            className="mt-4"
            disabled={!selectedDay || !selectedStartTime || !selectedEndTime}
            onClick={() => addAvailability()}
          >
            Set Schedule
          </Button>
        </div>
      )}

      <Separator />

      {/* Current Availability List */}
      <div className="space-y-4">
        <Label className="font-medium">Selected Schedule</Label>
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
                    <strong>{availability.day}</strong> from{" "}
                    {formatTime(availability.startTime)} to{" "}
                    {formatTime(availability.endTime)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm bg-muted/50 p-4 rounded-lg border-dashed border-2">
            No schedule selected. Choose a time within the open availability
            windows.
          </p>
        )}
      </div>
    </div>
  );
};

export default EnhancedAvailabilityForm;
