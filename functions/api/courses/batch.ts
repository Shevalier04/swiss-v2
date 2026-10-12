/**
 * Cloudflare Pages Functions - Courses Batch API
 * Path: /api/courses/batch
 * D1 Database Binding: DB
 */

import { PagesFunction, Env, onRequestPost as mainPost } from '../courses';

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  // Delegate directly to the main courses batch handling logic
  return mainPost(context);
};
