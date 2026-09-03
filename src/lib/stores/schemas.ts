import { z } from "zod";

export const StoreSearchRequestSchema = z.object({
  category: z.string().min(1).max(60),
  productName: z.string().optional().default(""),
  productDescription: z.string().optional().default(""),
  country: z.string().optional().default("es"),
});

export const StoreAnalyzeRequestSchema = z.object({
  url: z
    .string()
    .min(4)
    .max(2000)
    .refine((u) => /^https?:\/\//i.test(u), { message: "Debe ser una URL http(s) válida" }),
});

export const StoreGenerateRequestSchema = z.object({
  url: z.string().min(4).max(2000),
  analysis: z.any().optional(),
  productName: z.string().optional().default(""),
  productDescription: z.string().optional().default(""),
  brandName: z.string().optional().default(""),
  userPreferences: z.string().optional().default(""),
});

export const StoreEditRequestSchema = z.object({
  url: z.string().min(4).max(2000),
  theme: z.any(),
  instruction: z.string().min(1).max(2000),
});
