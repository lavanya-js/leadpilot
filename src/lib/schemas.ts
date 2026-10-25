import { z } from "zod";

// Empty strings become null, so blank form fields are stored as "no value".
const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => v || null);

// "https://www.Acme.com/about" -> "acme.com"
const domain = z
  .string()
  .trim()
  .max(100)
  .nullish()
  .transform((v) =>
    v ? v.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : null
  )
  .refine((v) => v === null || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v), {
    message: "Enter a valid domain, like acme.com",
  });

export const companyCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  domain,
  industry: optionalText(80),
  phone: optionalText(30),
  notes: optionalText(2000),
});

export const listParams = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
});

export const LEAD_SOURCES = ["Website", "Referral", "LinkedIn", "Cold Call", "Event"] as const;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || z.email().safeParse(v).success, {
    message: "Enter a valid email address",
  });

const phone = z
  .string()
  .trim()
  .max(30)
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || /^\+?[\d\s\-()]{7,20}$/.test(v), {
    message: "Enter a valid phone number",
  });

export const leadCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email,
  phone,
  source: z.enum(LEAD_SOURCES, { message: "Pick a valid lead source" }),
  value: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  notes: optionalText(2000),
  companyId: z.string().trim().min(1).nullish().transform((v) => v || null),
  ownerId: z.string().trim().min(1).optional(), // only Admins may set this
  stageId: z.string().trim().min(1).optional(), // defaults to the first stage
});

// Stage changes go through their own endpoint, so edits can't change the stage.
export const leadUpdateSchema = leadCreateSchema.omit({ stageId: true });