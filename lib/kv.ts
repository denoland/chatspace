export const kv = await Deno.openKv(Deno.env.get("KV_PATH") || undefined);
