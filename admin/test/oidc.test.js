import test from 'node:test';
import assert from 'node:assert/strict';
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose';
import { verifyOidcAccessToken } from '../src/auth/oidc.js';

const issuer = 'https://identity.example.test/realms/front';
const clientId = 'school-chinese-exam-web';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey);
jwk.kid = 'test-key';
jwk.alg = 'RS256';
jwk.use = 'sig';
const jwks = createLocalJWKSet({ keys: [jwk] });

async function token(claims = {}, tokenIssuer = issuer) {
  return new SignJWT({ preferred_username: 'student', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(tokenIssuer)
    .setAudience('account')
    .setSubject('identity-subject-1')
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(privateKey);
}

const options = { issuer, clientId, jwks };

test('accepts a correctly signed token for this issuer and client', async () => {
  assert.deepEqual(await verifyOidcAccessToken(await token({ azp: clientId }), options), {
    subject: 'identity-subject-1', username: 'student'
  });
});

test('rejects wrong issuer, audience, authorized party, expired and malformed tokens', async () => {
  await assert.rejects(verifyOidcAccessToken(await token({ azp: 'other-client' }), options));
  await assert.rejects(verifyOidcAccessToken(await token({ azp: clientId }, 'https://other.test'), options));
  const wrongAudience = new SignJWT({ azp: clientId })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer(issuer).setAudience('other')
    .setSubject('identity-subject-1').setIssuedAt().setExpirationTime('2m').sign(privateKey);
  await assert.rejects(verifyOidcAccessToken(await wrongAudience, options));
  const expired = new SignJWT({ azp: clientId })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer(issuer).setAudience('account')
    .setSubject('identity-subject-1').setIssuedAt().setExpirationTime('-1s').sign(privateKey);
  await assert.rejects(verifyOidcAccessToken(await expired, options));
  await assert.rejects(verifyOidcAccessToken('not-a-token', options));
});
