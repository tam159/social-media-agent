import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post/generate-post-state.js";
import { z } from "zod";
import { ChatOpenAI} from "@langchain/openai";
import { FireCrawlLoader } from "@langchain/community/document_loaders/web/firecrawl";
import { getPrompts } from "../../generate-post/prompts/index.js";
import { VerifyContentAnnotation } from "../shared-state.js";
import { RunnableLambda } from "@langchain/core/runnables";
import { getPageText } from "../../utils.js";

type VerifyGeneralContentReturn = {
  relevantLinks: (typeof GeneratePostAnnotation.State)["relevantLinks"];
  pageContents: (typeof GeneratePostAnnotation.State)["pageContents"];
  imageOptions?: (typeof GeneratePostAnnotation.State)["imageOptions"];
};

const RELEVANCY_SCHEMA = z
  .object({
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the webpage is or isn't relevant to your company's products.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the webpage is relevant to your company's products.",
      ),
  })
  .describe("The relevancy of the content to your company's products.");

const VERIFY_COMPANY_RELEVANT_CONTENT_PROMPT = `You are a highly regarded marketing employee.
You're provided with a webpage containing content a third party submitted to you claiming it's relevant and implements your company's products.
Your task is to carefully read over the entire page, and determine whether or not the content actually implements and is relevant to your company's products.
You're doing this to ensure the content is relevant to your company, and it can be used as marketing material to promote your company.

${getPrompts().businessContext}

Given this context, examine the webpage content closely, and determine if the content implements your company's products.
You should provide reasoning as to why or why not the content implements your company's products, then a simple true or false for whether or not it implements some.`;

const getImagesFromFireCrawlMetadata = (
  metadata: any,
): string[] | undefined => {
  const image = metadata.image || [];
  const ogImage = metadata.ogImage ? [metadata.ogImage] : [];
  if (image?.length || ogImage?.length) {
    return [...ogImage, ...image];
  }
  return undefined;
};

type UrlContents = {
  content: string;
  imageUrls?: string[];
};

export async function getUrlContents(url: string): Promise<UrlContents> {
  const loader = new FireCrawlLoader({
    url,
    mode: "scrape",
    params: {
      formats: ["markdown", "screenshot"],
    },
  });
  const docs = await loader.load();

  const docsText = docs.map((d) => d.pageContent).join("\n");
  if (docsText.length) {
    return {
      content: docsText,
      imageUrls: docs.flatMap(
        (d) => getImagesFromFireCrawlMetadata(d.metadata) || [],
      ),
    };
  }

  const text = await getPageText(url);
  if (text) {
    return {
      content: text,
    };
  }
  throw new Error(`Failed to fetch content from ${url}.`);
}

export async function verifyGeneralContentIsRelevant(
  content: string,
): Promise<boolean> {
  const relevancyModel = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  }).withStructuredOutput(RELEVANCY_SCHEMA, {
    name: "relevancy",
  });

  const { relevant } = await relevancyModel
    .withConfig({
      runName: "check-general-relevancy-model",
    })
    .invoke([
      {
        role: "system",
        content: VERIFY_COMPANY_RELEVANT_CONTENT_PROMPT,
      },
      {
        role: "user",
        content: content,
      },
    ]);
  return relevant;
}

/**
 * Verifies the content provided is relevant to your company's products.
 */
/**
 * Verifies if the general content from a provided URL is relevant to your company's products.
 *
 * @param state - The current state containing the link to verify.
 * @param _config - Configuration for the LangGraph runtime (unused in this function).
 * @returns An object containing relevant links and page contents if the content is relevant;
 * otherwise, returns empty arrays.
 */
export async function verifyGeneralContent(
  state: typeof VerifyContentAnnotation.State,
  _config: LangGraphRunnableConfig,
): Promise<VerifyGeneralContentReturn> {
  const urlContents = await new RunnableLambda<string, UrlContents>({
    func: getUrlContents,
  })
    .withConfig({ runName: "get-url-contents" })
    .invoke(state.link);
  const relevant = await verifyGeneralContentIsRelevant(urlContents.content);

  if (relevant) {
    return {
      relevantLinks: [state.link],
      pageContents: [urlContents.content],
      ...(urlContents.imageUrls?.length
        ? { imageOptions: urlContents.imageUrls }
        : {}),
    };
  }

  // Not relevant, return empty arrays so this URL is not included.
  return {
    relevantLinks: [],
    pageContents: [],
  };
}
