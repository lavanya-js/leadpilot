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