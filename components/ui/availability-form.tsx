import { useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"; // Adjust import as necessary
import { Button } from "@/components/ui/button"; // Import Button and other UI elements
import { Label } from "@/components/ui/label";
import { Availability } from "@/types";
// Define the props for the AvailabilityForm component
interface AvailabilityFormProps {
  availabilityList: Availability[];
  setAvailabilityList: (availability: Availability[]) => void;
}

const formatTime = (time: string) => {
  if (time) {
    const [hours, minutes] = time.split(":");
    const formattedHours = Number(hours) % 12 || 12; // Convert to 12-hour format
    const ampm = Number(hours) >= 12 ? "PM" : "AM"; // Determine AM or PM
    return `${formattedHours}:${minutes}${ampm}`; // Return formatted time
  }
};

const AvailabilityForm: React.FC<AvailabilityFormProps> = ({
  availabilityList,
  setAvailabilityList,
}) => {
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");

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
    <div className="availability-form">
      <Label>Enrollment Schedule (EST)</Label>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="day" className="text-right">
            Day:
          </Label>
          <Select name="day" value={selectedDay} onValueChange={(value) => setSelectedDay(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Monday">Monday</SelectItem>
              <SelectItem value="Tuesday">Tuesday</SelectItem>
              <SelectItem value="Wednesday">Wednesday</SelectItem>
              <SelectItem value="Thursday">Thursday</SelectItem>
              <SelectItem value="Friday">Friday</SelectItem>
              <SelectItem value="Saturday">Saturday</SelectItem>
              <SelectItem value="Sunday">Sunday</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="start-time" className="text-right">
            Start Time:
          </Label>
          <input
            type="time"
            id="start-time"
            value={selectedStartTime}
            onChange={(e) => setSelectedStartTime(e.target.value)}
            className="border rounded p-2 w-full"
          />
        </div>

        <div>
          <Label htmlFor="end-time" className="text-right">
            End Time:
          </Label>
          <input
            type="time"
            id="end-time"
            value={selectedEndTime}
            onChange={(e) => setSelectedEndTime(e.target.value)}
            className="border rounded p-2 w-full"
          />
        </div>
      </div>

      <Button onClick={addAvailability} className="mt-4">
        Set Schedule
      </Button>

      <div className="mt-4">
        <Label>Current Schedule:</Label>
        <ul className="list-disc pl-5">
          {availabilityList.length > 0 ? (
            availabilityList?.map((availability, index) => (
              <li key={index} className="flex justify-between">
                {availability.day} from {formatTime(availability.startTime)} to{" "}
                {formatTime(availability.endTime)}
                <Button
                  variant="link"
                  onClick={() => removeAvailability(index)}
                  className="text-red-500"
                >
                  Remove
                </Button>
              </li>
            ))
          ) : (
            <p className="text-[#ff0000]">Select a date and time</p>
          )}
        </ul>
      </div>
    </div>
  );
};

export default AvailabilityForm;
