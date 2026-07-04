# Deployment

## Required Environment Variables

Production requires these project-level DeepSeek settings:

- `DEEPSEEK_API_ENDPOINT=https://api.deepseek.com/chat/completions`
- `DEEPSEEK_MODEL=deepseek-v4-pro`

Do not configure or store a real user API Key in deployment settings. The MVP accepts the user's DeepSeek API Key in memory for one request and sends it through the server route only for that analysis.

If either required production variable is missing, `/api/analyze` returns:

```json
{
  "success": false,
  "error": {
    "code": "DEEPSEEK_CONFIGURATION_ERROR",
    "message": "服务端 DeepSeek 配置缺失，请联系部署维护者。"
  }
}
```

The response does not include API keys, raw errors, or internal stack traces.

## Local Production Check

1. Copy `.env.example` to `.env.production.local`.
2. Run `npm run build`.
3. Run `npm run start`.
4. Open `/analyze` and verify the flow with a valid user-provided DeepSeek API Key, or use the existing browser acceptance mock for deterministic UI verification.

## Vercel Deployment

1. Import this repository into Vercel as a Next.js project.
2. `vercel.json` already provides the non-secret project-level DeepSeek endpoint and model for Vercel deployments. If your Vercel project overrides environment variables in the dashboard, keep them equal to the values above.
3. Deploy with the default Next.js build command, `npm run build`.
4. After deployment, verify `/analyze` with the main MVP flow and confirm the API Key is not persisted or logged.

## Current Deployment Blocker

This workspace has no checked-in `.vercel/project.json`, and the local Vercel CLI reports no existing credentials. A deployment requires one of:

- completing `vercel login` and linking the project, or
- providing a Vercel token and project/org identifiers through the deployment environment.
