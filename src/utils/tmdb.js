/**
 * PIRU TV - TMDB Shared Configuration & Fallback Assets
 */

export const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
export const TMDB = 'https://api.themoviedb.org/3';
export const IMG = 'https://image.tmdb.org/t/p/w500';
export const BACK = 'https://image.tmdb.org/t/p/original';
export const HDR = { Authorization: `Bearer ${TMDB_KEY}` };

// Lightweight SVG placeholder for broken/missing posters
export const PLACEHOLDER_POSTER = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23141420'/%3E%3Cstop offset='100%25' stop-color='%2309090f'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='450' fill='url(%23g)'/%3E%3Ccircle cx='150' cy='200' r='40' fill='%23e50914' fill-opacity='0.2'/%3E%3Cpolygon points='142,185 168,200 142,215' fill='%23e50914'/%3E%3Ctext x='150' y='270' font-family='sans-serif' font-size='16' font-weight='bold' fill='%2394a3b8' text-anchor='middle'%3EPIRU TV%3C/text%3E%3C/svg%3E";

export default {
  TMDB_KEY,
  TMDB,
  IMG,
  BACK,
  HDR,
  PLACEHOLDER_POSTER
};
