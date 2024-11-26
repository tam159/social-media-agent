import { describe, it, expect } from "@jest/globals";
import {
  extractTweetId,
  extractUrls,
  extractUrlsFromSlackText,
} from "../agent/utils.js";

describe("extractUrlsFromSlackText", () => {
  it("Can extract URL from Slack-style message text", () => {
    const singleUrlText = `<https://github.com/karimulla0908/capstone_repo|https://github.com/karimulla0908/capstone_repo>`;
    const urls = extractUrlsFromSlackText(singleUrlText);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://github.com/karimulla0908/capstone_repo");
  });

  it("Can extract multiple URLs from Slack-style message text", () => {
    const multipleUrlsText = `<https://github.com/karimulla0908/capstone_repo|https://github.com/karimulla0908/capstone_repo> And another one is <this youtube video|https://www.youtube.com/watch?v=OyDfr0xIhss>`;
    const urls = extractUrlsFromSlackText(multipleUrlsText);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("https://github.com/karimulla0908/capstone_repo");
    expect(urls[1]).toBe("https://www.youtube.com/watch?v=OyDfr0xIhss");
  });

  it("Can extract URLs when they do not have a label", () => {
    const urlWithoutLabelText = `<https://github.com/ReddyNitheeesh/AI-Lc-Lg-examples/blob/main/code_assistant_lg.py>`;
    const urls = extractUrlsFromSlackText(urlWithoutLabelText);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://github.com/ReddyNitheeesh/AI-Lc-Lg-examples/blob/main/code_assistant_lg.py",
    );
  });
});

describe("extractTweetId", () => {
  it("Can extract tweet IDs", () => {
    const id = "1422656689476354560";
    const tweetUrl = `https://twitter.com/elonmusk/status/${id}`;
    const tweetId = extractTweetId(tweetUrl);
    expect(tweetId).toBe(id);
  });

  it("Can extract tweet IDs when URL has query params", () => {
    const id = "1422656689476354560";
    const tweetUrl = `https://twitter.com/elonmusk/status/${id}?param=1`;
    const tweetId = extractTweetId(tweetUrl);
    expect(tweetId).toBe(id);
  });

  it("Can extract tweet IDs when URL has extra path fields", () => {
    const id = "1422656689476354560";
    const tweetUrl = `https://twitter.com/elonmusk/status/${id}/extra/path`;
    const tweetId = extractTweetId(tweetUrl);
    expect(tweetId).toBe(id);
  });
});

describe("extractUrls", () => {
  it("can extract a single URL from a string", () => {
    const stringWithUrl = "This is a string with a URL: https://example.com";
    const urls = extractUrls(stringWithUrl);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://example.com");
  });

  it("can extract multiple URLs from a string", () => {
    const multiLineMultiUrl = `This is a string with multiple URLs:
  2. But: too much competition, keeps prices down! https://t.co/GI4uWOGPO5
finally, we have a URL on the link below https xyz
https://example.com`;
    const urls = extractUrls(multiLineMultiUrl);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("https://t.co/GI4uWOGPO5");
    expect(urls[1]).toBe("https://example.com");
  });
});
