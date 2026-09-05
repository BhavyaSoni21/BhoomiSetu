// Matches docker-compose.yml's `JWT_SECRET=${JWT_SECRET:-change_this_in_production}`
// default exactly, so a deployment that never sets the env var still behaves
// consistently between the compose file and the app reading it directly.
export const JWT_SECRET = process.env.JWT_SECRET || 'change_this_in_production';
export const JWT_EXPIRES_IN = '24h';
