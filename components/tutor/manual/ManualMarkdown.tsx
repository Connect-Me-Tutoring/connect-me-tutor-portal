import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, Info } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const linkClass =
  "font-medium text-connect-me-blue-3 underline underline-offset-2 hover:text-connect-me-blue-4";

// Section bodies are written by admins in Markdown. Map it onto the portal's shadcn
// components and brand colours so the manual looks like the rest of the portal.
const components: Components = {
  h1: ({ children }) => (
    <h3 className="pt-2 text-lg font-semibold text-connect-me-blue-4">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="pt-2 text-lg font-semibold text-connect-me-blue-4">{children}</h3>
  ),
  h3: ({ children }) => (
    <h3 className="pt-2 text-base font-semibold text-connect-me-blue-4">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="pt-1 text-sm font-semibold text-connect-me-blue-4">{children}</h4>
  ),
  p: ({ children }) => <p>{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-connect-me-gray-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1.5 pl-5 marker:text-connect-me-gray-1">{children}</ol>
  ),
  a: ({ href = "", children }) =>
    href.startsWith("/") || href.startsWith("#") ? (
      <Link href={href} className={linkClass}>
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {children}
        <ExternalLink aria-hidden="true" className="ml-0.5 inline h-3 w-3 align-baseline" />
      </a>
    ),
  blockquote: ({ children }) => (
    <Alert className="border-connect-me-blue-1 bg-connect-me-blue-1/20">
      <Info className="h-4 w-4 !text-connect-me-blue-3" />
      <AlertDescription className="space-y-2 text-connect-me-gray-3">{children}</AlertDescription>
    </Alert>
  ),
  hr: () => <hr className="border-border" />,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
  ),
  table: ({ children }) => <Table>{children}</Table>,
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHead>{children}</TableHead>,
  td: ({ children }) => <TableCell>{children}</TableCell>,
  // Images aren't part of the manual; don't let a pasted one load third-party content.
  img: ({ alt }) => <span>{alt}</span>,
};

export default function ManualMarkdown({ children }: { children: string }) {
  return (
    <div className="space-y-4 text-sm leading-6 text-connect-me-gray-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
