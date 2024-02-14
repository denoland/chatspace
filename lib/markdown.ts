import * as ammonia from "https://deno.land/x/ammonia@0.3.1/mod.ts";
import { marked } from "npm:marked@11.1.0";

const ammoniaInit = ammonia.init();

export async function safelyRenderMarkdown(input: string): Promise<string> {
  await ammoniaInit;
  return ammonia.clean(await marked(input));
}
