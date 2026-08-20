import type { CSSProperties, ReactNode } from "react";

export interface AppTokens {
  accent: string;
  bodyFont: string;
  border: string;
  canvas: string;
  headingFont: string;
  ink: string;
  muted: string;
  primary: string;
}

export interface CloudflareAnalyticsAttributes {
  beacon: string;
  src: string;
}

export interface OgOptions {
  eyebrow: string;
  slug: string;
  subtitle: string;
  title: string;
}

export interface PageShellProps {
  children: ReactNode;
  className?: string;
  tokens: AppTokens;
}

const BODY_FONT = "Verdana, Arial, sans-serif";
const HEADING_FONT = "Palatino Linotype, Georgia, serif";

const APP_TOKENS: Record<string, AppTokens> = {
  rdlog: {
    accent: "#67c5d1",
    bodyFont: BODY_FONT,
    border: "#dbe4ed",
    canvas: "#f4f7fb",
    headingFont: HEADING_FONT,
    ink: "#132338",
    muted: "#536780",
    primary: "#174a76",
  },
};

export function getAppTokens(slug: string): AppTokens {
  return APP_TOKENS[slug] ?? APP_TOKENS.rdlog as AppTokens;
}

export function getCloudflareAnalyticsAttributes(token: string | undefined): CloudflareAnalyticsAttributes | null {
  const trimmed = token?.trim();
  return trimmed
    ? {
        beacon: JSON.stringify({ token: trimmed }),
        src: "https://static.cloudflareinsights.com/beacon.min.js",
      }
    : null;
}

function tokenStyle(tokens: AppTokens): CSSProperties {
  return {
    "--s72-accent": tokens.accent,
    "--s72-body-font": tokens.bodyFont,
    "--s72-border": tokens.border,
    "--s72-canvas": tokens.canvas,
    "--s72-heading-font": tokens.headingFont,
    "--s72-ink": tokens.ink,
    "--s72-muted": tokens.muted,
    "--s72-primary": tokens.primary,
    background: tokens.canvas,
    color: tokens.ink,
    fontFamily: tokens.bodyFont,
  } as CSSProperties;
}

export function PageShell({ children, className, tokens }: PageShellProps) {
  return <div className={className} style={tokenStyle(tokens)}>{children}</div>;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderOgSvg({ eyebrow, slug, subtitle, title }: OgOptions): string {
  const tokens = getAppTokens(slug);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(title)}">
  <rect width="1200" height="630" fill="${tokens.canvas}" />
  <rect x="64" y="64" width="14" height="502" fill="${tokens.accent}" />
  <text x="116" y="146" fill="${tokens.primary}" font-family="${tokens.bodyFont}" font-size="28" font-weight="700" letter-spacing="2">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="116" y="292" fill="${tokens.ink}" font-family="${tokens.headingFont}" font-size="78" font-weight="700">${escapeXml(title)}</text>
  <text x="116" y="390" fill="${tokens.muted}" font-family="${tokens.bodyFont}" font-size="34">${escapeXml(subtitle)}</text>
  <text x="116" y="520" fill="${tokens.primary}" font-family="${tokens.bodyFont}" font-size="25">ship72 / ${escapeXml(slug)}</text>
</svg>
`;
}
