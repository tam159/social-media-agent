import { Client } from "@langchain/langgraph-sdk";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../generate-post-state.js";
import { ChatOpenAI} from "@langchain/openai";
import {
  getReflections,
  REFLECTIONS_PROMPT,
  RULESET_KEY,
} from "../../../utils/reflections.js";

const REWRITE_POST_PROMPT = `You're a highly regarded marketing employee, working on crafting thoughtful and engaging content for the LinkedIn and Twitter pages.
You wrote a post for the LinkedIn and Twitter pages, however your boss has asked for some changes to be made before it can be published.

The original post you wrote is as follows:
<original-post>
{originalPost}
</original-post>

{reflectionsPrompt}

Listen to your boss closely, and make the necessary changes to the post. You should respond ONLY with the updated post, with no additional information, or text before or after the post.`;

interface RunReflectionsArgs {
  originalPost: string;
  newPost: string;
  userResponse: string;
}

/**
 * Kick off a new run to generate reflections.
 * @param param0
 */
async function runReflections({
  originalPost,
  newPost,
  userResponse,
}: RunReflectionsArgs) {
  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const thread = await client.threads.create();
  await client.runs.create(thread.thread_id, "reflection", {
    input: {
      originalPost,
      newPost,
      userResponse,
    },
  });
}

export async function rewritePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.post) {
    throw new Error("No post found");
  }
  if (!state.userResponse) {
    throw new Error("No user response found");
  }

  const rewritePostModel = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0.5,
  });

  const reflections = await getReflections(config);
  let reflectionsPrompt = "";
  if (
    reflections?.value?.[RULESET_KEY]?.length &&
    Array.isArray(reflections?.value?.[RULESET_KEY])
  ) {
    const rulesetString = `- ${reflections.value[RULESET_KEY].join("\n- ")}`;
    reflectionsPrompt = REFLECTIONS_PROMPT.replace(
      "{reflections}",
      rulesetString,
    );
  }

  const systemPrompt = REWRITE_POST_PROMPT.replace(
    "{originalPost}",
    state.post,
  ).replace("{reflectionsPrompt}", reflectionsPrompt);

  const revisePostResponse = await rewritePostModel.invoke([
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: state.userResponse,
    },
  ]);

  await runReflections({
    originalPost: state.post,
    newPost: revisePostResponse.content as string,
    userResponse: state.userResponse,
  });

  return {
    post: revisePostResponse.content as string,
    next: undefined,
    userResponse: undefined,
  };
}
