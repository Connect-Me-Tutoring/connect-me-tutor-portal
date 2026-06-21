"use server";

/**
 * Create Subject Embeddings
 * @param subjects
 * @returns vector(384)
 */
export const createSubjectEmbeddings = async (
  subjects: string[]
): Promise<number[]> => {
  const vector = new Array(384).fill(0);
  const tokens = subjects
    .join(" ")
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];

  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % vector.length;
    vector[index] += hash % 2 === 0 ? 1 : -1;
  }

  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
};
