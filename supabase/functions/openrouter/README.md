# OpenRouter Edge Function

This function is the only browser-facing boundary for OpenRouter. It authenticates
the bearer token against Supabase Auth, stores provider keys in Vault, and returns
only configuration metadata or generated proposals.

The function deliberately uses custom authentication because it supports current
publishable keys as well as legacy anon JWTs. Deploy it with gateway JWT checking
disabled; the first action in the handler validates the bearer token via
`/auth/v1/user` before reading settings or generating content.

```sh
supabase functions deploy openrouter --no-verify-jwt
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_DB_URL`, publishable keys, and the
legacy anon key to the hosted runtime. Apply `database/cv_ai_settings.sql` before
deploying. Never add an OpenRouter key to project environment variables: each
owner submits their key through `/app/settings/ai`, and the function stores it in
Supabase Vault.
