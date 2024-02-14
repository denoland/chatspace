import { FreshContext, Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  GET(req: Request, _ctx: FreshContext) {
    const url = new URL(req.url);
    const defaultWorkspaceId = Deno.env.get("CHATSPACE_DEFAULT_WORKSPACE");

    if (defaultWorkspaceId) {
      return Response.redirect(
        `${url.origin}/workspace/${defaultWorkspaceId}`,
        302,
      );
    }

    return Response.redirect(`${url.origin}/workspace`, 302);
  },
};

export default function Home() {
  return (
    <div>
    </div>
  );
}
