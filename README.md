# Chatspace

Real-time, collaborative GPT frontend built with
[Deno KV](https://docs.deno.com/deploy/kv/manual) and
[Fresh](https://fresh.deno.dev/). Chat history is stored in Deno KV, and the
[`watch()`](https://docs.deno.com/deploy/kv/manual/operations#watch) feature is
used to deliver updates to everyone in this workspace.

![screenshot](static/screenshot.png)

## Running locally

To run the app locally, you will need to install Deno and have the API key to an
OpenAI-compatible service. Then run from the root of this repository:

```
export CHATSPACE_DEFAULT_BACKEND=myapi
export CHATSPACE_BACKEND_MYAPI=https://api.openai.com/v1,sk-xxxxxxxx,gpt-3.5-turbo-1106

deno task start
```
