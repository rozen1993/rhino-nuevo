import type { APIRoute } from 'astro';
import { getBuildConfig, renderRobots } from '../lib/seo.mjs';
export const GET: APIRoute = () => new Response(renderRobots(getBuildConfig()), {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});
