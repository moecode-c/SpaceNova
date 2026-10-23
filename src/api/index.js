/**
 * The single import point for every screen.
 *
 * PHASE 2 SWAP: each namespace below is backed by a module in this folder that
 * currently reads the in-memory fixtures. Replacing a namespace means changing
 * one file to issue fetch calls against the Express routes and returning the
 * same { data, meta } envelope. No screen imports the fixtures directly, so no
 * screen changes.
 *
 *   auth         ->  POST /api/auth/*          (session cookie)
 *   catalog      ->  GET  /api/objects, /api/objects/:id, /api/objects/:id/element-sets
 *   tracking     ->  GET  /api/tracking/element-sets
 *   passes       ->  POST /api/passes/predict, GET /api/passes/:id, GET /api/plans/:id/windows
 *   launches     ->  GET  /api/launches
 *   events       ->  GET  /api/sky
 *   spaceWeather ->  GET  /api/space-weather
 *   locations    ->  CRUD /api/locations
 *   plans        ->  CRUD /api/plans
 *   observations ->  CRUD /api/observations
 *   engineering  ->  GET  /api/engineering/*, CRUD /api/stations, /api/vehicles
 *   workspaces   ->  CRUD /api/workspaces/*
 *   admin        ->  /api/admin/*
 */

export { auth, DEMO_ACCOUNTS } from './auth.js';
export { catalog } from './catalog.js';
export { tracking } from './tracking.js';
export { passes } from './passes.js';
export { launches } from './launches.js';
export { events } from './events.js';
export { spaceWeather } from './space-weather.js';
export { locations, plans, observations } from './user-data.js';
export { engineering } from './engineering.js';
export { workspaces } from './workspaces.js';
export { admin } from './admin.js';
export { ApiError, envelope, call } from './client.js';
