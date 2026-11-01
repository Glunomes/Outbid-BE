
import * as bcrypt from 'bcrypt';

const saltRounds = 10;

export async function hashPassword (password: string) {
  return bcrypt.hash(password, saltRounds);
}