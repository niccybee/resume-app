import {
  createOpenRouterServer,
  OpenRouterServerError,
} from "../utils/openRouterService";

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig(event);
    const service = createOpenRouterServer({
      supabaseUrl: config.public.supabaseUrl,
      publishableKey: config.public.supabasePublishableKey,
      serviceRoleKey: config.supabaseServiceRoleKey,
    });
    return await service.handle({
      authorization: getHeader(event, "authorization"),
      body: await readBody(event),
    });
  } catch (reason) {
    const error = reason instanceof OpenRouterServerError
      ? reason
      : new OpenRouterServerError(
        "openrouter-unavailable",
        "The OpenRouter service is temporarily unavailable.",
        500,
      );
    setResponseStatus(event, error.status);
    return { code: error.code, error: error.message };
  }
});
