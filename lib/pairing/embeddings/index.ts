"use server";
import { pipeline } from "@xenova/transformers";

/**
 * Create Subject Embeddings
 * @param subjects
 * @returns vector(384)
 */
export const createSubjectEmbeddings = async (
  subjects: string[]
): Promise<number[]> => {
  const embedder = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );

  const sentence = subjects.join(" ");
  const result = await embedder(sentence, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(result.data);
};
