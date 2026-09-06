import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import test from 'node:test';

import { PrismaClient } from '@prisma/client';

import { getConfig } from '../config.js';
import { buildServer } from '../server.js';

interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  tokenType: string;
  user: {
    id: string;
    email: string;
    profile: {
      nickname: string;
      language: string;
      city: { id: string; nameRu: string };
    };
  };
}

const password = 'Strong-test-password-1!';
const newPassword = 'Different-test-password-2!';

test('complete account lifecycle uses revocable access and rotating refresh tokens', async () => {
  const prisma = new PrismaClient();
  const config = getConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-only-jwt-secret-with-at-least-32-characters',
    JWT_ACCESS_TTL_SECONDS: '900',
    REFRESH_TOKEN_TTL_DAYS: '30',
  });
  const logChunks: string[] = [];
  const logStream = new Writable({
    write(chunk, _encoding, callback) {
      logChunks.push(chunk.toString());
      callback();
    },
  });
  const app = buildServer({ config, prisma, logger: { level: 'info', stream: logStream } });
  const email = `auth-${randomUUID()}@example.test`;
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    orderBy: { nameRu: 'asc' },
    take: 2,
  });
  assert.equal(cities.length, 2);

  let userId: string | undefined;
  let adId: string | undefined;

  try {
    await app.ready();

    const cityReference = await app.inject({ method: 'GET', url: '/reference/cities' });
    assert.equal(cityReference.statusCode, 200);
    assert.equal(cityReference.json<{ cities: unknown[] }>().cities.length, 90);

    const anonymousMe = await app.inject({ method: 'GET', url: '/auth/me' });
    assert.equal(anonymousMe.statusCode, 401);

    const registration = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: email.toUpperCase(),
        password,
        nickname: 'Тестовый пользователь',
        cityId: cities[0]!.id,
        language: 'ru',
        acceptedMinimumAge: true,
      },
    });
    assert.equal(registration.statusCode, 201);
    const registered = registration.json<AuthResponse>();
    userId = registered.user.id;
    assert.equal(registered.user.email, email);
    assert.equal(registered.user.profile.city.id, cities[0]!.id);
    assert.equal(registered.tokenType, 'Bearer');
    assert.equal(registered.expiresIn, 900);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { sessions: true, profile: true },
    });
    assert.notEqual(stored.passwordHash, password);
    assert.match(stored.passwordHash, /^\$argon2id\$/);
    assert.equal(stored.sessions.length, 1);
    assert.notEqual(stored.sessions[0]!.refreshTokenHash, registered.refreshToken);
    assert.match(stored.sessions[0]!.refreshTokenHash, /^[0-9a-f]{64}$/);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email,
        password,
        nickname: 'Другой профиль',
        cityId: cities[0]!.id,
        language: 'ru',
        acceptedMinimumAge: true,
      },
    });
    assert.equal(duplicate.statusCode, 409);

    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${registered.accessToken}` },
    });
    assert.equal(me.statusCode, 200);

    const profile = await app.inject({
      method: 'PUT',
      url: '/account/profile',
      headers: { authorization: `Bearer ${registered.accessToken}` },
      payload: {
        nickname: 'Обновлённый профиль',
        cityId: cities[1]!.id,
        language: 'ru',
      },
    });
    assert.equal(profile.statusCode, 200);
    const updatedProfile = profile.json<{ user: AuthResponse['user'] }>();
    assert.equal(updatedProfile.user.profile.city.id, cities[1]!.id);

    const rotation = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: registered.refreshToken },
    });
    assert.equal(rotation.statusCode, 200);
    const rotated = rotation.json<AuthResponse>();
    assert.notEqual(rotated.refreshToken, registered.refreshToken);

    const replay = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: registered.refreshToken },
    });
    assert.equal(replay.statusCode, 401);

    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: rotated.refreshToken },
    });
    assert.equal(logout.statusCode, 204);

    const afterLogout = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${rotated.accessToken}` },
    });
    assert.equal(afterLogout.statusCode, 401);

    const wrongLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'Wrong-test-password-9!' },
    });
    assert.equal(wrongLogin.statusCode, 401);

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    assert.equal(login.statusCode, 200);
    const loggedIn = login.json<AuthResponse>();

    const changed = await app.inject({
      method: 'POST',
      url: '/account/password',
      headers: { authorization: `Bearer ${loggedIn.accessToken}` },
      payload: { currentPassword: password, newPassword },
    });
    assert.equal(changed.statusCode, 204);

    const revokedAfterPasswordChange = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${loggedIn.accessToken}` },
    });
    assert.equal(revokedAfterPasswordChange.statusCode, 401);

    const oldPasswordLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    assert.equal(oldPasswordLogin.statusCode, 401);

    const newPasswordLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: newPassword },
    });
    assert.equal(newPasswordLogin.statusCode, 200);
    const afterPasswordChange = newPasswordLogin.json<AuthResponse>();

    const category = await prisma.category.findFirstOrThrow({ orderBy: { position: 'asc' } });
    const ad = await prisma.ad.create({
      data: {
        ownerId: userId,
        categoryId: category.id,
        cityId: cities[0]!.id,
        title: 'Содержимое для удаления',
        description: 'Личные данные должны быть удалены вместе с аккаунтом.',
        status: 'ACTIVE',
      },
    });
    adId = ad.id;

    const deletion = await app.inject({
      method: 'DELETE',
      url: '/account',
      headers: { authorization: `Bearer ${afterPasswordChange.accessToken}` },
      payload: { currentPassword: newPassword },
    });
    assert.equal(deletion.statusCode, 204);

    const deletedUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true, sessions: true },
    });
    assert.equal(deletedUser.status, 'DELETED');
    assert.equal(deletedUser.email, `${userId}@deleted.invalid`);
    assert.equal(deletedUser.profile, null);
    assert.equal(deletedUser.sessions.length, 0);
    assert.ok(deletedUser.deletedAt);

    const closedAd = await prisma.ad.findUniqueOrThrow({ where: { id: adId } });
    assert.equal(closedAd.status, 'CLOSED');
    assert.equal(closedAd.title, 'Удалённое объявление');
    assert.equal(closedAd.description, '');
    assert.equal(closedAd.budget, null);

    const deletedAccess = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${afterPasswordChange.accessToken}` },
    });
    assert.equal(deletedAccess.statusCode, 401);

    const deletedLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: newPassword },
    });
    assert.equal(deletedLogin.statusCode, 401);

    const rateLimitedLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: newPassword },
    });
    assert.equal(rateLimitedLogin.statusCode, 429);
    assert.equal(rateLimitedLogin.json().error.code, 'RATE_LIMITED');

    const auditActions = await prisma.auditLog.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: 'asc' },
      select: { action: true },
    });
    assert.deepEqual(
      auditActions.map(({ action }) => action),
      ['account.registered', 'account.password_changed', 'account.deleted'],
    );

    const capturedLogs = logChunks.join('');
    assert.doesNotMatch(capturedLogs, new RegExp(password, 'u'));
    assert.doesNotMatch(capturedLogs, new RegExp(newPassword, 'u'));
    assert.doesNotMatch(capturedLogs, new RegExp(registered.refreshToken, 'u'));
    assert.doesNotMatch(capturedLogs, new RegExp(rotated.refreshToken, 'u'));
  } finally {
    if (userId) {
      await prisma.auditLog.deleteMany({ where: { actorId: userId } });
      await prisma.offer.deleteMany({ where: { senderId: userId } });
      await prisma.ad.deleteMany({ where: { ownerId: userId } });
      await prisma.report.deleteMany({ where: { reporterId: userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app.close();
  }
});
