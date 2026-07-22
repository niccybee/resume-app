export default async (_request, context) => context.next();

export const config = {
  path: "/mcp",
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
