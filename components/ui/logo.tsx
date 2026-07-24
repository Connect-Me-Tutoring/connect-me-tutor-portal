import React from "react";
import { Search, Link as LinkIcon, Home, HelpCircle, Settings, Compass, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function Logo() {
  return (
    <div className="p-4 flex items-center space-x-2">
      <div className="text-white p-1 rounded">
        {/* <Globe size={24} /> */}
        {/* <Image alt = "logo" height = "50" width = "50" src = "/logo.png"/> */}
        <Image alt="logo" height="30" width="30" src="/logo.png" />
      </div>
      <span className="text-xl font-semibold">Connect Me</span>
    </div>
  );
}
