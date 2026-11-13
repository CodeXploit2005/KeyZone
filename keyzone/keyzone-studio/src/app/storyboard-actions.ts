"use server";
import { requireLicense } from "@/lib/license";

import { z } from "zod";
import { MAX_IMPORTED_SCENES, MAX_SCRIPT_CHARS } from "@/lib/imported-script";
import { expandStoryboard } from "@/lib/storyboard";
import { getProvider } from "@/lib/providers";
import { gatewayChat, gatewayConfigured } from "@/lib/providers/gateway";

export async function developStoryboard(input: unknown) {
  await requireLicense();
  const parsed = z.object({ brief: z.string().trim().min(3).max(MAX_SCRIPT_CHARS), count: z.number().int().min(1).max(MAX_IMPORTED_SCENES).nullable().default(null), ratio: z.enum(["16:9", "9:16"]), productReference: z.boolean().default(false) }).safeParse(input);
  if (!parsed.success) return { error: "Kiểm tra nội dung, số cảnh (1–48) và khung hình." };
  try {
    const { brief, count, ratio, productReference } = parsed.data;
    const storyboard = await expandStoryboard(brief, count, ratio, gatewayConfigured() ? gatewayChat : prompt => getProvider().chat(prompt), productReference);
    return { storyboard };
  } catch {
    return { error: "Chưa chia được cảnh bằng AI. Kiểm tra kết nối dịch vụ AI và thử lại; nội dung của bạn vẫn được giữ lại." };
  }
}
