import { branding } from "../config/branding";
import { matchConfig, type MatchConfig } from "../config/match";
import { prisma } from "./db/prisma";

const SETTINGS_ID = "singleton";

export interface EffectiveMatchSettings extends MatchConfig {
  matchThreshold: number;
}

export interface EffectiveBrandingSettings {
  companyName: string;
  footerText: string;
  anonymizeCV: boolean;
  /** Niet aanpasbaar via /instellingen (spec noemt alleen bedrijfsnaam/voettekst/anonimisering). */
  logoUrl: string;
  primaryColor: string;
}

export type AutoGenerateMode = "volledig" | "alleen_matchen";

function getDefaultMatchThreshold(): number {
  const raw = process.env.MATCH_THRESHOLD;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isNaN(parsed) ? 90 : parsed;
}

/** Haalt de ene instellingenrij op, en maakt 'm aan met alle velden op null (= fallback) als die nog niet bestaat. */
async function getSettingsRow() {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function getEffectiveMatchSettings(): Promise<EffectiveMatchSettings> {
  const row = await getSettingsRow();
  return {
    matchThreshold: row.matchThreshold ?? getDefaultMatchThreshold(),
    skillWeight: row.skillWeight ?? matchConfig.skillWeight,
    semanticWeight: row.semanticWeight ?? matchConfig.semanticWeight,
    mustHaveWeight: row.mustHaveWeight ?? matchConfig.mustHaveWeight,
    niceToHaveWeight: row.niceToHaveWeight ?? matchConfig.niceToHaveWeight,
    knockOutCapScore: row.knockOutCapScore ?? matchConfig.knockOutCapScore,
    aiCallMustHaveThreshold: row.aiCallMustHaveThreshold ?? matchConfig.aiCallMustHaveThreshold,
  };
}

export async function getEffectiveBrandingSettings(): Promise<EffectiveBrandingSettings> {
  const row = await getSettingsRow();
  return {
    companyName: row.companyName ?? branding.companyName,
    footerText: row.footerText ?? branding.footerText,
    anonymizeCV: row.anonymizeCV ?? branding.anonymizeCV,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
  };
}

/** "volledig" (matchen + frontsheet + mail) is de standaard als er geen databasewaarde is. */
export async function getEffectiveAutoGenerateMode(): Promise<AutoGenerateMode> {
  const row = await getSettingsRow();
  return (row.autoGenerateMode as AutoGenerateMode | null) ?? "volledig";
}

export interface SettingsUpdateInput {
  matchThreshold?: number;
  skillWeight?: number;
  semanticWeight?: number;
  mustHaveWeight?: number;
  niceToHaveWeight?: number;
  knockOutCapScore?: number;
  aiCallMustHaveThreshold?: number;
  anonymizeCV?: boolean;
  companyName?: string;
  footerText?: string;
  autoGenerateMode?: AutoGenerateMode;
}

/** Slaat aangepaste instellingen op. Alleen de meegegeven velden worden bijgewerkt. */
export async function updateAppSettings(input: SettingsUpdateInput) {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: input,
    create: { id: SETTINGS_ID, ...input },
  });
}
