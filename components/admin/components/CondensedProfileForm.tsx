"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, BookOpen, Languages } from "lucide-react";

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  subjectsOfInterest?: string[];
  languages_spoken?: string[];
  availability?: { day: string; startTime: string; endTime: string }[];
}

interface CondensedProfileFormProps {
  profile: Profile;
  onProfileUpdate: (updatedProfile: Profile) => void;
  isStudent?: boolean; // Flag to determine if this is for student or tutor
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function CondensedProfileForm({
  profile,
  onProfileUpdate,
  isStudent = true,
}: CondensedProfileFormProps) {
  const [localProfile, setLocalProfile] = useState<Profile>(profile);
  const [newSubject, setNewSubject] = useState("");
  const [newLanguage, setNewLanguage] = useState("");

  const updateProfile = (updates: Partial<Profile>) => {
    const updatedProfile = { ...localProfile, ...updates };
    setLocalProfile(updatedProfile);
    onProfileUpdate(updatedProfile);
  };

  const addAvailabilitySlot = () => {
    const newAvailability = [
      ...(localProfile.availability || []),
      { day: "Monday", startTime: "09:00", endTime: "17:00" },
    ];
    updateProfile({ availability: newAvailability });
  };

  const updateAvailabilitySlot = (
    index: number,
    field: keyof { day: string; startTime: string; endTime: string },
    value: string,
  ) => {
    if (!localProfile.availability) return;

    const updated = [...localProfile.availability];
    updated[index] = { ...updated[index], [field]: value };
    updateProfile({ availability: updated });
  };

  const removeAvailabilitySlot = (index: number) => {
    if (!localProfile.availability) return;

    const filtered = localProfile.availability.filter((_, i) => i !== index);
    updateProfile({ availability: filtered });
  };

  const addSubject = () => {
    if (newSubject.trim() && !(localProfile.subjectsOfInterest || []).includes(newSubject.trim())) {
      const newSubjects = [...(localProfile.subjectsOfInterest || []), newSubject.trim()];
      updateProfile({ subjectsOfInterest: newSubjects });
      setNewSubject("");
    }
  };

  const removeSubject = (subject: string) => {
    const filtered = (localProfile.subjectsOfInterest || []).filter((s) => s !== subject);
    updateProfile({ subjectsOfInterest: filtered });
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !(localProfile.languages_spoken || []).includes(newLanguage.trim())) {
      const newLanguages = [...(localProfile.languages_spoken || []), newLanguage.trim()];
      updateProfile({ languages_spoken: newLanguages });
      setNewLanguage("");
    }
  };

  const removeLanguage = (language: string) => {
    const filtered = (localProfile.languages_spoken || []).filter((l) => l !== language);
    updateProfile({ languages_spoken: filtered });
  };

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {isStudent ? "Student" : "Tutor"} Profile Details
        </h3>
        <p className="text-sm text-gray-600">
          {localProfile.firstName} {localProfile.lastName} - {localProfile.email}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Availability Section */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full" />
              Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(localProfile.availability || []).map((slot, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row gap-2 p-3 border rounded-md bg-gray-50"
              >
                <div className="flex-1">
                  <Label className="text-xs text-gray-500">Day</Label>
                  <Select
                    value={slot.day}
                    onValueChange={(value) => updateAvailabilitySlot(index, "day", value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
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
                <div className="flex-1">
                  <Label className="text-xs text-gray-500">Start</Label>
                  <Input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateAvailabilitySlot(index, "startTime", e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-gray-500">End</Label>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateAvailabilitySlot(index, "endTime", e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeAvailabilitySlot(index)}
                    className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addAvailabilitySlot}
              className="w-full h-8 text-sm"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Time Slot
            </Button>
          </CardContent>
        </Card>

        {/* Subjects and Languages */}
        <div className="space-y-4">
          {/* Subjects of Interest */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-3 w-3 text-green-600" />
                Subjects of Interest
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="e.g., Math, Physics"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSubject())}
                  className="h-8 text-sm"
                />
                <Button type="button" onClick={addSubject} size="sm" className="h-8">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {(localProfile.subjectsOfInterest || []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(localProfile.subjectsOfInterest || []).map((subject) => (
                    <Badge
                      key={subject}
                      variant="secondary"
                      className="flex items-center gap-1 text-xs py-1 px-2"
                    >
                      {subject}
                      <button
                        type="button"
                        onClick={() => removeSubject(subject)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Languages Spoken */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Languages className="h-3 w-3 text-purple-600" />
                Languages Spoken
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="e.g., English, Spanish"
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addLanguage())}
                  className="h-8 text-sm"
                />
                <Button type="button" onClick={addLanguage} size="sm" className="h-8">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {(localProfile.languages_spoken || []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(localProfile.languages_spoken || []).map((language) => (
                    <Badge
                      key={language}
                      variant="secondary"
                      className="flex items-center gap-1 text-xs py-1 px-2"
                    >
                      {language}
                      <button
                        type="button"
                        onClick={() => removeLanguage(language)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
