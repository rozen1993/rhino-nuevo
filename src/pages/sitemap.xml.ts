import type { APIRoute } from 'astro';
import { getBuildConfig, renderSitemap } from '../lib/seo.mjs';
export const GET: APIRoute = () => new Response(renderSitemap(getBuildConfig()), {
  headers: { 'Content-Type': 'application/xml; charset=utf-8' },
});
