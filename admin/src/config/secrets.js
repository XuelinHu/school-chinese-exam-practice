import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = String(process.env.JWT_SECRET || '').trim();
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters before starting the API.');
}

export { jwtSecret };
