import React from "react";
import { Section, Text, Link } from "@react-email/components";
import { SOCIAL_LINKS } from "@/constants/socials";

export interface EmailFooterProps {
  style?: React.CSSProperties;
  tagline?: string;
  className?: string;
}

const defaultFooterStyle: React.CSSProperties = {
  backgroundColor: "#30302F",
  padding: "20px 16px",
  textAlign: "center",
  borderTop: "1px solid #495860",
  borderRadius: "0 0 8px 8px",
};

const linkStyle: React.CSSProperties = {
  color: "#B7E2F2",
  textDecoration: "underline",
  fontSize: "13px",
  fontWeight: 500,
  margin: "0 8px",
};

const separatorStyle: React.CSSProperties = {
  color: "#8494A8",
  fontSize: "12px",
};

const taglineStyle: React.CSSProperties = {
  color: "#8494A8",
  fontSize: "13px",
  margin: "0 0 10px 0",
};

export default function EmailFooter({
  style,
  tagline = "Connect Me Free Tutoring & Mentoring",
  className,
}: EmailFooterProps) {
  return (
    <Section style={{ ...defaultFooterStyle, ...style }} className={className}>
      <Text style={taglineStyle}>{tagline}</Text>
      <Text style={{ margin: "0", lineHeight: "1.4" }}>
        <Link href={SOCIAL_LINKS.website.url} style={linkStyle} target="_blank">
          Website
        </Link>
        <span style={separatorStyle}>•</span>
        <Link href={SOCIAL_LINKS.instagram.url} style={linkStyle} target="_blank">
          Instagram
        </Link>
        <span style={separatorStyle}>•</span>
        <Link href={SOCIAL_LINKS.linkedin.url} style={linkStyle} target="_blank">
          LinkedIn
        </Link>
      </Text>
    </Section>
  );
}

export function getEmailFooterHtml(tagline = "Connect Me Free Tutoring & Mentoring") {
  return `
    <div style="background-color: #30302F; padding: 20px 16px; text-align: center; border-top: 1px solid #495860; border-radius: 0 0 8px 8px; margin-top: 24px; font-family: Arial, sans-serif;">
      <p style="color: #8494A8; font-size: 13px; margin: 0 0 10px 0;">${tagline}</p>
      <p style="margin: 0; line-height: 1.4;">
        <a href="${SOCIAL_LINKS.website.url}" target="_blank" rel="noopener noreferrer" style="color: #B7E2F2; text-decoration: underline; font-size: 13px; font-weight: 500; margin: 0 8px;">Website</a>
        <span style="color: #8494A8; font-size: 12px;">•</span>
        <a href="${SOCIAL_LINKS.instagram.url}" target="_blank" rel="noopener noreferrer" style="color: #B7E2F2; text-decoration: underline; font-size: 13px; font-weight: 500; margin: 0 8px;">Instagram</a>
        <span style="color: #8494A8; font-size: 12px;">•</span>
        <a href="${SOCIAL_LINKS.linkedin.url}" target="_blank" rel="noopener noreferrer" style="color: #B7E2F2; text-decoration: underline; font-size: 13px; font-weight: 500; margin: 0 8px;">LinkedIn</a>
      </p>
    </div>
  `;
}
