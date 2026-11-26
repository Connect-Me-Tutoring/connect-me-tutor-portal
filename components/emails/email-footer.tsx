import React from "react";
import { Section, Text, Link } from "@react-email/components";
import { SOCIAL_LINKS } from "@/constants/socials";
import { emailColors as c, emailFont } from "@/components/emails/layout/tokens";

export interface EmailFooterProps {
  style?: React.CSSProperties;
  tagline?: string;
  className?: string;
}

const DEFAULT_TAGLINE = "Connect Me Free Tutoring & Mentoring";

const links = [SOCIAL_LINKS.website, SOCIAL_LINKS.instagram, SOCIAL_LINKS.linkedin];

// A light card footer, like the portal's CardFooter: it sits flush with the bottom of the
// email card (radius 7px so it fits inside the card's 1px border and 8px corners).
const defaultFooterStyle: React.CSSProperties = {
  backgroundColor: c.page,
  borderTop: `1px solid ${c.border}`,
  borderRadius: "0 0 7px 7px",
  padding: "20px 16px",
  textAlign: "center",
};

const taglineStyle: React.CSSProperties = {
  color: c.muted,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 8px",
};

const linkStyle: React.CSSProperties = {
  color: c.blue3,
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
};

const separatorStyle: React.CSSProperties = {
  color: c.gray1,
  fontSize: "13px",
  padding: "0 8px",
};

export default function EmailFooter({
  style,
  tagline = DEFAULT_TAGLINE,
  className,
}: EmailFooterProps) {
  return (
    <Section style={{ ...defaultFooterStyle, ...style }} className={className}>
      <Text style={taglineStyle}>{tagline}</Text>
      <Text style={{ margin: 0, lineHeight: "20px" }}>
        {links.map((link, i) => (
          <React.Fragment key={link.label}>
            {i > 0 ? <span style={separatorStyle}>·</span> : null}
            <Link href={link.url} style={linkStyle} target="_blank">
              {link.label}
            </Link>
          </React.Fragment>
        ))}
      </Text>
    </Section>
  );
}

/** The same footer as raw HTML, for templates that build their markup as strings. */
export function getEmailFooterHtml(tagline = DEFAULT_TAGLINE) {
  const escaped = tagline.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linkHtml = links
    .map(
      (link) =>
        `<a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: ${c.blue3}; font-size: 13px; font-weight: 500; text-decoration: none;">${link.label}</a>`,
    )
    .join(`<span style="color: ${c.gray1}; font-size: 13px; padding: 0 8px;">·</span>`);
  return `
    <div style="background-color: ${c.page}; border-top: 1px solid ${c.border}; border-radius: 0 0 7px 7px; padding: 20px 16px; text-align: center; font-family: ${emailFont};">
      <p style="color: ${c.muted}; font-size: 12px; line-height: 18px; margin: 0 0 8px 0;">${escaped}</p>
      <p style="margin: 0; line-height: 20px;">${linkHtml}</p>
    </div>
  `;
}
