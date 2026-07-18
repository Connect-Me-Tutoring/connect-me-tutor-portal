"use client";

import { useState, useEffect } from "react";
import { X, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfilePairingMetadata } from "@/types/profile";
import { fetchProfileData, updateProfileData } from "@/lib/profile-utils";
import { useToast } from "@/hooks/use-toast";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const COMMON_SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "History",
  "Geography",
  "Literature",
  "Languages",
  "Art",
  "Music",
];

const COMMON_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Mandarin",
  "Japanese",
  "Russian",
  "Arabic",
  "Portuguese",
  "Hindi",
];

export function ProfileEditor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfilePairingMetadata>({
    profileId: "",
    availability: [],
    subjectsOfInterest: [],
    languagesSpoken: [],
  });

  // For new availability slot
  const [newAvailability, setNewAvailability] = useState({
    day: "",
    startTime: "",
    endTime: "",
  });

  // For new subject and language inputs
  const [newSubject, setNewSubject] = useState("");
  const [newLanguage, setNewLanguage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const data = await fetchProfileData();
        setProfile(data);
      } catch (error) {
        console.error("Failed to load profile:", error);
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [toast]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProfileData(profile);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      // Notify the opener window to refresh if it exists
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage("profile-updated", window.location.origin);
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast({
        title: "Error",
        description: "Failed to save profile data",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addAvailability = () => {
    if (!newAvailability.day || !newAvailability.startTime || !newAvailability.endTime) {
      toast({
        title: "Missing information",
        description: "Please fill in all availability fields",
        variant: "destructive",
      });
      return;
    }

    setProfile((prev) => ({
      ...prev,
      availability: [...(prev.availability || []), { ...newAvailability }],
    }));

    setNewAvailability({ day: "", startTime: "", endTime: "" });
  };

  const removeAvailability = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      availability: prev.availability?.filter((_, i) => i !== index),
    }));
  };

  const addSubject = () => {
    if (!newSubject) return;

    if (!profile.subjectsOfInterest?.includes(newSubject)) {
      setProfile((prev) => ({
        ...prev,
        subjectsOfInterest: [...(prev.subjectsOfInterest || []), newSubject],
      }));
    }

    setNewSubject("");
  };

  const removeSubject = (subject: string) => {
    setProfile((prev) => ({
      ...prev,
      subjectsOfInterest: prev.subjectsOfInterest?.filter((s) => s !== subject),
    }));
  };

  const addLanguage = () => {
    if (!newLanguage) return;

    if (!profile.languagesSpoken?.includes(newLanguage)) {
      setProfile((prev) => ({
        ...prev,
        languagesSpoken: [...(prev.languagesSpoken || []), newLanguage],
      }));
    }

    setNewLanguage("");
  };

  const removeLanguage = (language: string) => {
    setProfile((prev) => ({
      ...prev,
      languagesSpoken: prev.languagesSpoken?.filter((l) => l !== language),
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-pulse text-center">
          <p className="text-muted-foreground">Loading profile data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Availability</h2>
        <p className="text-sm text-muted-foreground">
          Set your available time slots for tutoring or learning sessions.
        </p>

        <div className="space-y-4">
          {profile.availability && profile.availability.length > 0 ? (
            <div className="grid gap-2">
              {profile.availability.map((slot, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-md border bg-muted/50"
                >
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div className="text-sm">{slot.day}</div>
                    <div className="text-sm">{slot.startTime}</div>
                    <div className="text-sm">{slot.endTime}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeAvailability(index)}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">No availability set</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="day">Day</Label>
              <Select
                value={newAvailability.day}
                onValueChange={(value) => setNewAvailability((prev) => ({ ...prev, day: value }))}
              >
                <SelectTrigger id="day">
                  <SelectValue placeholder="Select day" />
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

            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={newAvailability.startTime}
                onChange={(e) =>
                  setNewAvailability((prev) => ({
                    ...prev,
                    startTime: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={newAvailability.endTime}
                onChange={(e) =>
                  setNewAvailability((prev) => ({
                    ...prev,
                    endTime: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex items-end">
              <Button onClick={addAvailability}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Subjects of Interest</h2>
        <p className="text-sm text-muted-foreground">
          {"  Add subjects you're interested in teaching or learning."}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {profile.subjectsOfInterest && profile.subjectsOfInterest.length > 0 ? (
            profile.subjectsOfInterest.map((subject, index) => (
              <Badge key={index} variant="secondary" className="pl-3 pr-2 py-1.5">
                {subject}
                <button
                  className="ml-1 hover:text-destructive"
                  onClick={() => removeSubject(subject)}
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove {subject}</span>
                </button>
              </Badge>
            ))
          ) : (
            <div className="w-full text-center py-4 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">No subjects added</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={newSubject} onValueChange={setNewSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Select or type a subject" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_SUBJECTS.filter(
                  (subject) => !profile.subjectsOfInterest?.includes(subject),
                ).map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addSubject}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Languages Spoken</h2>
        <p className="text-sm text-muted-foreground">Add languages you can communicate in.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {profile.languagesSpoken && profile.languagesSpoken.length > 0 ? (
            profile.languagesSpoken.map((language, index) => (
              <Badge key={index} variant="outline" className="pl-3 pr-2 py-1.5">
                {language}
                <button
                  className="ml-1 hover:text-destructive"
                  onClick={() => removeLanguage(language)}
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove {language}</span>
                </button>
              </Badge>
            ))
          ) : (
            <div className="w-full text-center py-4 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">No languages added</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={newLanguage} onValueChange={setNewLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select or type a language" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_LANGUAGES.filter(
                  (language) => !profile.languagesSpoken?.includes(language),
                ).map((language) => (
                  <SelectItem key={language} value={language}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addLanguage}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </span>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              Save Profile
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
