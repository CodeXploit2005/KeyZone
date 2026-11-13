/** Shared product identity rules, applied to every image and clip without editing saved scene text. */
export const MAX_PRODUCT_IMAGES = 6;
export const PRODUCT_REFERENCE_PLANNING = "The user attached a product photograph or a set of product photographs. Plan the video around the referenced products, with useful product shots and coherent marketing storytelling as requested. All photos will guide the image generator for each shot. They may show several angles of one product or different products; follow the user's description, never fuse different products into an invented hybrid. Refer to the attached products rather than inventing their shape, color, brand, label text, ingredients, specifications or unverified claims. Do not replace them with unrelated products or characters.";

type ProductImages = { referenceImagePath: string | null; referenceImageKind: string; productImagePaths?: string[] };
export function productImagePaths(project: ProductImages) {
  if (project.referenceImageKind !== "product") return [];
  return [...new Set(project.productImagePaths?.length ? project.productImagePaths : project.referenceImagePath ? [project.referenceImagePath] : [])];
}

export function hasProductReference(project: ProductImages) {
  return productImagePaths(project).length > 0;
}

export function withProductIdentity(prompt: string, product: boolean, stage: "image" | "video" = "image") {
  if (!product) return prompt;
  return `${prompt}\n\nPRODUCT IDENTITY: ${stage === "image" ? "The attached reference image contains product photos, possibly arranged in a reference sheet, not a character sheet or a background to copy. Use the exact referenced product(s) requested in this scene. Different photos may be angles of one item or distinct products: do not mix their shapes, merge labels or force every item into each shot. Output one cinematic scene, not a collage, grid or reference sheet." : "Keep the product exactly as shown in the first frame throughout the entire clip."} Preserve its silhouette, proportions, material, colors, packaging, printed label and existing logo; do not redesign, recolor, replace, duplicate or morph it. Change only the scene, viewpoint, lighting and action requested above. Existing printed product branding must remain consistent; do not invent additional text or labels.`;
}
