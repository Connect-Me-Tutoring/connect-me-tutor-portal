"use client";

import type React from "react";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  X,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  User,
  BookOpen,
  Languages,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateProfile } from "@/lib/actions/user/actions";
import { updateProfileDetails } from "@/lib/actions/profile/client.actions";
import { createClient } from "@/lib/supabase/client";
import { useFetchProfile } from "@/hooks/auth";

interface UpdateProfileInput {
  userId: string;
  availability?: { day: string; startTime: string; endTime: string }[];
  subjectsOfInterest?: string[];
  languagesSpoken?: string[];
}

interface ProfileUpdateFormProps {
  userId: string;
  initialData?: {
    availability?: { day: string; startTime: string; endTime: string }[];
    subjectsOfInterest?: string[];
    languagesSpoken?: string[];
  };
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ProfileUpdateForm() {
  const t = useTranslations("profileSessions");
  const { profile: initialData } = useFetchProfile();
  const [availability, setAvailability] = useState<
    { day: string; startTime: string; endTime: string }[]
  >(initialData?.availability || []);
  const [subjectsOfInterest, setSubjectsOfInterest] = useState<string[]>(
    initialData?.subjects_of_interest || [],
  );
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>(
    initialData?.languages_spoken || [],
  );
  const [newSubject, setNewSubject] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (initialData) {
      setAvailability(initialData.availability || []);
      setSubjectsOfInterest(initialData.subjects_of_interest || []);
      setLanguagesSpoken(initialData.languages_spoken || []);
    }
  }, [initialData]);

  const supabase = createClient();

  const addAvailabilitySlot = () => {
    setAvailability([...availability, { day: "Monday", startTime: "09:00", endTime: "17:00" }]);
  };

  const updateAvailabilitySlot = (
    index: number,
    field: keyof (typeof availability)[0],
    value: string,
  ) => {
    const updated = [...availability];
    updated[index] = { ...updated[index], [field]: value };
    setAvailability(updated);
  };

  const removeAvailabilitySlot = (index: number) => {
    setAvailability(availability.filter((_, i) => i !== index));
  };

  const addSubject = () => {
    if (newSubject.trim() && !subjectsOfInterest.includes(newSubject.trim())) {
      setSubjectsOfInterest([...subjectsOfInterest, newSubject.trim()]);
      setNewSubject("");
    }
  };

  const removeSubject = (subject: string) => {
    setSubjectsOfInterest(subjectsOfInterest.filter((s) => s !== subject));
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !languagesSpoken.includes(newLanguage.trim())) {
      setLanguagesSpoken([...languagesSpoken, newLanguage.trim()]);
      setNewLanguage("");
    }
  };

  const removeLanguage = (language: string) => {
    setLanguagesSpoken(languagesSpoken.filter((l) => l !== language));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const user = await supabase.auth.getUser();

    // Prepare the data in the exact format required
    const profileData: UpdateProfileInput = {
      userId: user.data.user?.id || "",
      availability: availability.length > 0 ? availability : undefined,
      subjectsOfInterest: subjectsOfInterest.length > 0 ? subjectsOfInterest : undefined,
      languagesSpoken: languagesSpoken.length > 0 ? languagesSpoken : undefined,
    };

    // Log the exact output format

    try {
      const result = await updateProfileDetails(profileData);

      if (result.success) {
        setMessage({ type: "success", text: t("profilePage.messages.updateSuccess") });
      } else {
        setMessage({
          type: "error",
          text: result.error || t("profilePage.messages.updateError"),
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : t("profilePage.messages.unexpectedError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <User className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">{t("profilePage.header.title")}</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t("profilePage.header.description")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Availability Section */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  {t("profilePage.availability.cardTitle")}
                </CardTitle>
                <CardDescription>
                  {t("profilePage.availability.cardDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {availability.map((slot, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row gap-2 p-4 border rounded-lg bg-gray-50"
                  >
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500">
                        {t("profilePage.availability.dayLabel")}
                      </Label>
                      <Select
                        value={slot.day}
                        onValueChange={(value) => updateAvailabilitySlot(index, "day", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((day) => (
                            <SelectItem key={day} value={day}>
                              {t(`days.${day}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500">
                        {t("profilePage.availability.startTimeLabel")}
                      </Label>
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateAvailabilitySlot(index, "startTime", e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500">
                        {t("profilePage.availability.endTimeLabel")}
                      </Label>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateAvailabilitySlot(index, "endTime", e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeAvailabilitySlot(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAvailabilitySlot}
                  className="w-full bg-transparent"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("profilePage.availability.addSlot")}
                </Button>
              </CardContent>
            </Card>

            {/* Subjects and Languages Section */}
            <div className="space-y-8">
              {/* Subjects of Interest */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-green-600" />
                    {t("profilePage.subjects.cardTitle")}
                  </CardTitle>
                  <CardDescription>{t("profilePage.subjects.cardDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder={t("profilePage.subjects.placeholder")}
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSubject())}
                    />
                    <Button type="button" onClick={addSubject} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {subjectsOfInterest.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {subjectsOfInterest.map((subject) => (
                        <Badge
                          key={subject}
                          variant="secondary"
                          className="flex items-center gap-1 text-sm py-1 px-3"
                        >
                          {subject}
                          <button
                            type="button"
                            onClick={() => removeSubject(subject)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Languages Spoken */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="h-5 w-5 text-purple-600" />
                    {t("profilePage.languages.cardTitle")}
                  </CardTitle>
                  <CardDescription>{t("profilePage.languages.cardDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder={t("profilePage.languages.placeholder")}
                      value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addLanguage())}
                    />
                    <Button type="button" onClick={addLanguage} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {languagesSpoken.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {languagesSpoken.map((language) => (
                        <Badge
                          key={language}
                          variant="secondary"
                          className="flex items-center gap-1 text-sm py-1 px-3"
                        >
                          {language}
                          <button
                            type="button"
                            onClick={() => removeLanguage(language)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Success/Error Message */}
          {message && (
            <Alert
              variant={message.type === "error" ? "destructive" : "default"}
              className="max-w-2xl mx-auto"
            >
              {message.type === "success" ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex justify-center pt-8">
            <Button type="submit" size="lg" className="px-12 py-3 text-lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Clock className="h-5 w-5 mr-2 animate-spin" />
                  {t("profilePage.submit.updating")}
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  {t("profilePage.submit.update")}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
