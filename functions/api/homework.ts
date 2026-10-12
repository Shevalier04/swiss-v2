/**
 * Cloudflare Pages Functions - Homework API compatibility proxy
 * Path: /api/homework
 * Forwards to assignments implementation
 */

import {
  PagesFunction,
  Env,
  onRequestGet as getAssignments,
  onRequestPost as postAssignments,
  onRequestPut as putAssignments,
  onRequestDelete as deleteAssignments,
  onRequestOptions as optionsAssignments,
} from './assignments';

export const onRequestOptions: PagesFunction<Env> = optionsAssignments;
export const onRequestGet: PagesFunction<Env> = getAssignments;
export const onRequestPost: PagesFunction<Env> = postAssignments;
export const onRequestPut: PagesFunction<Env> = putAssignments;
export const onRequestDelete: PagesFunction<Env> = deleteAssignments;
