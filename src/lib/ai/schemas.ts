import { z } from "zod";

export const SceneSchema = z.object({
  order: z.number(),
  start: z.number(),
  end: z.number(),
  visual: z.string(),
  action: z.string(),
  camera: z.string(),
  lighting: z.string().optional().default(""),
  audio: z.string().optional().default(""),
  dialogue: z.string().optional().default(""),
  onScreenText: z.string().optional().default(""),
  transition: z.string().optional().default(""),
  prompt: z.string().optional().default(""),
});

export type SceneData = z.infer<typeof SceneSchema>;

export const CreativeSchema = z.object({
  title: z.string(),
  hook: z.string(),
  angle: z.string(),
  cta: z.string(),
  scenes: z.array(SceneSchema).min(1).max(10),
  adCopy: z.string(),
  headline: z.string(),
  description: z.string().optional().default(""),
});

export type CreativeData = z.infer<typeof CreativeSchema>;

export const GenerateRequestSchema = z.object({
  productName: z.string().min(1),
  productDescription: z.string().optional().default(""),
  productUrl: z.string().optional().default(""),
  productImage: z.string().optional().default(""),
  platform: z.string().min(1),
  format: z.enum(["video", "image"]),
  style: z.string().min(1),
  objective: z.string().min(1),
  duration: z.number().min(5).max(60).default(15),
  country: z.string().default("ES"),
  language: z.string().default("es"),
  audience: z.object({
    age: z.string().optional().default(""),
    gender: z.string().optional().default(""),
    interests: z.string().optional().default(""),
    problem: z.string().optional().default(""),
    desire: z.string().optional().default(""),
  }).optional().default(() => ({ age: "", gender: "", interests: "", problem: "", desire: "" })),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const RegenerateSceneRequestSchema = z.object({
  scenes: z.array(SceneSchema),
  sceneOrder: z.number(),
  instruction: z.string().min(1),
  productName: z.string().min(1),
  platform: z.string().default("TikTok"),
  style: z.string().default("UGC"),
  duration: z.number().default(15),
});

export type RegenerateSceneRequest = z.infer<typeof RegenerateSceneRequestSchema>;
