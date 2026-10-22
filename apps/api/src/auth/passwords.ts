import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);

// Compared against when the email is unknown, so a miss costs the same bcrypt work as a wrong password.
let dummyHash: Promise<string> | undefined;

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (hash) return bcrypt.compare(password, hash);
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await bcrypt.compare(password, await dummyHash);
  return false;
}
