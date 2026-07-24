import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Profile } from "@/types";

interface TimeZoneSelectorProps {
  profile: Partial<Profile> | null;
  handleTimeZone: (value: string) => void;
}

const TimeZoneSelector = ({ profile, handleTimeZone }: TimeZoneSelectorProps) => {
  return (
    <Select name="timeZone" value={profile?.timeZone} onValueChange={handleTimeZone}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="UTC-10">Hawaiian Standard Time (UTC-10)</SelectItem>
        <SelectItem value="UTC-09">Alaskan Time (UTC-9)</SelectItem>
        <SelectItem value="UTC-08">Pacific Time (UTC-8)</SelectItem>
        <SelectItem value="UTC-07">Mountain Time (UTC-7)</SelectItem>
        <SelectItem value="UTC-06">Central Time (UTC-6)</SelectItem>
        <SelectItem value="UTC-05">Eastern Time (UTC-5)</SelectItem>
        <SelectItem value="UTC-04">Puerto Rican Time (UTC-4)</SelectItem>
        <SelectItem value="UTC">Greenwich Mean Time (UTC)</SelectItem>
        <SelectItem value="UTC+01">Central European Time (UTC+1)</SelectItem>
        <SelectItem value="UTC+02">Eastern European Time (UTC+2)</SelectItem>
        <SelectItem value="UTC+03">Eastern European Summer Time (UTC+3)</SelectItem>
        <SelectItem value="UTC+04">Moscow Standard Time (UTC+4)</SelectItem>
        <SelectItem value="UTC+05">Pakistan Standard Time (UTC+5)</SelectItem>
        <SelectItem value="UTC+05:30">Indian Standard Time (UTC+5:30)</SelectItem>
        <SelectItem value="UTC+06">Bangladesh Standard Time (UTC+6)</SelectItem>
        <SelectItem value="UTC+07">Indochina Time (UTC+7)</SelectItem>
        <SelectItem value="UTC+8">China Standard Time (UTC+8)</SelectItem>
        <SelectItem value="UTC+9">Japan Standard Time (UTC+9)</SelectItem>
        <SelectItem value="UTC+10">Australian Eastern Standard Time (UTC+10)</SelectItem>
      </SelectContent>
    </Select>
  );
};

export default TimeZoneSelector;
