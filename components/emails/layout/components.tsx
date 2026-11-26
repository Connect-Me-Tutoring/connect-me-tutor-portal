import React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import EmailFooter from "@/components/emails/email-footer";
import {
  DEFAULT_SIGNATURE,
  emailColors as c,
  emailFont,
  emailLogoUrl,
  emailTones,
  type EmailTone,
} from "@/components/emails/layout/tokens";

/*
 * Building blocks for transactional emails, styled after the tutor portal (shadcn cards,
 * badges and alerts in the Connect Me palette). Every template should compose these
 * rather than hand-writing styles, so all emails look like one product.
 *
 * Components here must not use hooks: some callers invoke templates as plain functions.
 */

const textStyle: React.CSSProperties = {
  color: c.black,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

export interface EmailLayoutProps {
  /** Inbox preview text shown after the subject line. */
  preview?: string;
  children: React.ReactNode;
  /** Render without <html>/<body>, for embedding in a page. */
  isPreview?: boolean;
  footerTagline?: string;
  logoUrl?: string;
}

/** Page, brand row, white card with the shared footer. Put the email's content inside. */
export function EmailLayout({
  preview,
  children,
  isPreview = false,
  footerTagline,
  logoUrl = emailLogoUrl,
}: EmailLayoutProps) {
  const content = (
    <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 16px" }}>
      {/* Brand row, same as the portal sidebar */}
      <Section style={{ padding: "0 4px 20px" }}>
        <Row>
          <Column style={{ width: "36px" }}>
            <Img
              src={logoUrl}
              width="28"
              height="28"
              alt="Connect Me"
              style={{ display: "block" }}
            />
          </Column>
          <Column>
            <Text style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: c.black }}>
              Connect Me
            </Text>
          </Column>
        </Row>
      </Section>

      <Section
        style={{
          backgroundColor: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: "8px",
          boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
        }}
      >
        <Section style={{ padding: "28px" }}>{children}</Section>
        <EmailFooter tagline={footerTagline} />
      </Section>
    </Container>
  );

  if (isPreview) {
    return <div style={{ fontFamily: emailFont, backgroundColor: c.page }}>{content}</div>;
  }

  return (
    <Html>
      <Head />
      {preview ? <Preview>{preview}</Preview> : null}
      <Body style={{ fontFamily: emailFont, backgroundColor: c.page, margin: 0, padding: 0 }}>
        {content}
      </Body>
    </Html>
  );
}

/** Small status pill above the heading, like the portal's Badge. */
export function EmailBadge({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: EmailTone;
}) {
  const t = emailTones[tone];
  return (
    <Text
      style={{
        display: "inline-block",
        margin: "0 0 16px",
        padding: "2px 10px",
        borderRadius: "9999px",
        backgroundColor: t.background,
        border: `1px solid ${t.border}`,
        color: t.accent,
        fontSize: "12px",
        lineHeight: "20px",
        fontWeight: 600,
      }}
    >
      ● {children}
    </Text>
  );
}

/** The email's title, with optional muted description underneath. */
export function EmailHeading({
  children,
  description,
}: {
  children: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <>
      <Heading
        as="h1"
        style={{
          margin: description ? "0 0 6px" : "0 0 24px",
          fontSize: "22px",
          lineHeight: "30px",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: c.black,
        }}
      >
        {children}
      </Heading>
      {description ? (
        <Text style={{ ...textStyle, color: c.muted, fontSize: "14px", margin: "0 0 24px" }}>
          {description}
        </Text>
      ) : null}
    </>
  );
}

/** A heading for a group of content within the card. */
export function EmailSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading
      as="h2"
      style={{
        margin: "8px 0 12px",
        fontSize: "16px",
        lineHeight: "24px",
        fontWeight: 600,
        color: c.black,
      }}
    >
      {children}
    </Heading>
  );
}

/** A body paragraph. */
export function EmailText({
  children,
  muted = false,
  small = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  small?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <Text
      style={{
        ...textStyle,
        ...(muted ? { color: c.muted } : null),
        ...(small ? { fontSize: "14px", lineHeight: "22px" } : null),
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** An inline link in the brand blue. */
export function EmailLink({
  href,
  children,
  style,
}: {
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <Link href={href} style={{ color: c.blue3, textDecoration: "underline", ...style }}>
      {children}
    </Link>
  );
}

/** The primary call to action, like the portal's default Button. */
export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={{ margin: "4px 0 24px" }}>
      <Button
        href={href}
        style={{
          backgroundColor: c.blue3,
          color: c.white,
          padding: "12px 20px",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

/**
 * A highlighted note, like the portal's Alert. Each entry in `paragraphs` (or the single
 * `children` node) becomes one paragraph.
 */
export function EmailCallout({
  title,
  tone = "info",
  children,
  paragraphs,
}: {
  title?: React.ReactNode;
  tone?: EmailTone;
  children?: React.ReactNode;
  paragraphs?: React.ReactNode[];
}) {
  const t = emailTones[tone];
  const body = paragraphs ?? (children !== undefined && children !== null ? [children] : []);
  return (
    <Section
      style={{
        backgroundColor: t.background,
        border: `1px solid ${t.border}`,
        borderLeft: `4px solid ${t.accent}`,
        borderRadius: "8px",
        padding: "14px 16px",
        margin: "0 0 24px",
      }}
    >
      {title ? (
        <Text
          style={{
            margin: body.length ? "0 0 4px" : 0,
            fontSize: "14px",
            lineHeight: "22px",
            fontWeight: 600,
            color: t.title,
          }}
        >
          {title}
        </Text>
      ) : null}
      {body.map((p, i) => (
        <Text
          key={i}
          style={{
            margin: i < body.length - 1 ? "0 0 8px" : 0,
            fontSize: "14px",
            lineHeight: "22px",
            color: t.text,
          }}
        >
          {p}
        </Text>
      ))}
    </Section>
  );
}

/** A bordered panel with a gray header row, like a portal Card with a CardHeader. */
function Panel({
  title,
  description,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Section
      style={{
        border: `1px solid ${c.border}`,
        borderRadius: "8px",
        backgroundColor: c.card,
        margin: "0 0 24px",
      }}
    >
      {title || description ? (
        <Section
          style={{
            padding: "14px 16px",
            backgroundColor: c.subtle,
            borderBottom: `1px solid ${c.border}`,
            borderRadius: "8px 8px 0 0",
          }}
        >
          {title ? (
            <Text style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: c.black }}>
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text
              style={{
                margin: title ? "2px 0 0" : 0,
                fontSize: "13px",
                lineHeight: "20px",
                color: c.muted,
              }}
            >
              {description}
            </Text>
          ) : null}
        </Section>
      ) : null}
      {children}
    </Section>
  );
}

/** A list of items in a bordered panel, numbered or with a dot marker. */
export function EmailList({
  title,
  description,
  items,
  ordered = true,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  items: React.ReactNode[];
  ordered?: boolean;
}) {
  return (
    <Panel title={title} description={description}>
      {items.map((item, i) => (
        <Row
          key={i}
          style={{ borderBottom: i < items.length - 1 ? `1px solid ${c.border}` : "none" }}
        >
          <Column style={{ width: "40px", verticalAlign: "top", padding: "14px 0 14px 16px" }}>
            {ordered ? (
              <Text
                style={{
                  margin: 0,
                  width: "22px",
                  height: "22px",
                  lineHeight: "22px",
                  borderRadius: "9999px",
                  backgroundColor: c.blue3,
                  color: c.white,
                  fontSize: "12px",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {i + 1}
              </Text>
            ) : (
              <Text
                style={{
                  margin: 0,
                  lineHeight: "22px",
                  color: c.blue3,
                  fontSize: "14px",
                  textAlign: "center",
                  width: "22px",
                }}
              >
                ●
              </Text>
            )}
          </Column>
          <Column style={{ verticalAlign: "top", padding: "14px 16px 14px 4px" }}>
            <Text style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: c.black }}>
              {item}
            </Text>
          </Column>
        </Row>
      ))}
    </Panel>
  );
}

export interface EmailDetailRow {
  label: React.ReactNode;
  value: React.ReactNode;
}

/** Label/value rows in a bordered panel, for session details, contact info and the like. */
export function EmailDetails({
  title,
  description,
  rows,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  rows: EmailDetailRow[];
}) {
  return (
    <Panel title={title} description={description}>
      {rows.map((row, i) => (
        <Row
          key={i}
          style={{ borderBottom: i < rows.length - 1 ? `1px solid ${c.border}` : "none" }}
        >
          <Column style={{ width: "34%", verticalAlign: "top", padding: "12px 8px 12px 16px" }}>
            <Text style={{ margin: 0, fontSize: "13px", lineHeight: "22px", color: c.muted }}>
              {row.label}
            </Text>
          </Column>
          <Column style={{ verticalAlign: "top", padding: "12px 16px 12px 8px" }}>
            <Text
              style={{
                margin: 0,
                fontSize: "14px",
                lineHeight: "22px",
                color: c.black,
                fontWeight: 500,
                wordBreak: "break-word",
              }}
            >
              {row.value}
            </Text>
          </Column>
        </Row>
      ))}
    </Panel>
  );
}

/** A bordered panel for free-form content (quoted messages, descriptions). */
export function EmailPanel({
  title,
  description,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel title={title} description={description}>
      <Section style={{ padding: "14px 16px" }}>{children}</Section>
    </Panel>
  );
}

/** A horizontal rule in the border color. */
export function EmailDivider() {
  return <Hr style={{ borderColor: c.border, margin: "24px 0 16px" }} />;
}

/** Sign-off below a divider. `children` adds lines (e.g. a contact email) underneath. */
export function EmailSignature({
  closing = "Best regards,",
  name = DEFAULT_SIGNATURE,
  children,
}: {
  closing?: React.ReactNode;
  name?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      <EmailDivider />
      <Text style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: c.muted }}>
        {closing}
      </Text>
      <Text
        style={{ margin: 0, fontSize: "14px", lineHeight: "22px", fontWeight: 600, color: c.black }}
      >
        {name}
      </Text>
      {children ? (
        <Text style={{ margin: "4px 0 0", fontSize: "14px", lineHeight: "22px", color: c.muted }}>
          {children}
        </Text>
      ) : null}
    </>
  );
}
