import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const LICENSE_COOKIE = "keyzone_license";
type Activation = { device: string; token?: string };
type LicenseResult = { valid: boolean; error?: string; customer?: string; expiresAt?: string; token?: string };
const directory = () => process.env.KEYZONE_LICENSE_DIR || path.join(process.env.STORAGE_DIR || path.join(os.homedir(), ".keyzone", "storage"), "..", "license");
let identity: Promise<Activation> | undefined;
export async function activation(): Promise<Activation> {
  // Read the token on every call: the worker and web server share this file.
  try { return JSON.parse(await readFile(path.join(directory(), "activation.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  identity ??= (async () => {
    await mkdir(directory(), { recursive: true });
    const value = { device: randomBytes(32).toString("hex") };
    try { await writeFile(path.join(directory(), "activation.json"), JSON.stringify(value), { flag: "wx", mode: 0o600 }); return value; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; return JSON.parse(await readFile(path.join(directory(), "activation.json"), "utf8")) as Activation; }
  })();
  return identity;
}
export async function licenseRequest(action: "activate" | "verify" | "deactivate", extra: { key?: string; token?: string } = {}): Promise<LicenseResult> {
  const base = process.env.KEYZONE_LICENSE_URL;
  if (!base) return { valid: false, error: "Chưa cấu hình máy chủ quản lý key. Vui lòng liên hệ người phát hành." };
  const url = new URL(base);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) return { valid: false, error: "Máy chủ key phải dùng HTTPS." };
  try {
    const saved = await activation();
    const response = await fetch(new URL(`/v1/${action}`, url), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...saved, ...extra }), cache: "no-store", signal: AbortSignal.timeout(6000), redirect: "error",
    });
    const result = await response.json() as LicenseResult;
    return response.ok ? result : { valid: false, error: result.error || "Key không hợp lệ." };
  } catch { return { valid: false, error: "Không kết nối được máy chủ key. Kiểm tra Internet rồi thử lại." }; }
}
export async function saveActivation(value: Activation) {
  await mkdir(directory(), { recursive: true });
  const temp = path.join(directory(), `activation-${randomBytes(8).toString("hex")}.tmp`);
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await rename(temp, path.join(directory(), "activation.json"));
}
export async function requireLicense() {
  const result = await licenseRequest("verify");
  if (!result.valid) throw new Error(result.error || "Cần kích hoạt key.");
  return result;
}
