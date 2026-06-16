import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PASSWORD_MIN_LENGTH, RegisterDto } from './register.dto';

const errorsFor = (password: string) =>
  validate(plainToInstance(RegisterDto, { name: 'Test User', email: 'a@b.de', password }));

describe('RegisterDto password policy', () => {
  it('enforces a 12-character minimum', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });

  it('accepts a strong 12+ character password', async () => {
    expect(await errorsFor('Str0ng!Passw0rd')).toHaveLength(0);
  });

  it('rejects "password123" (missing uppercase + special char)', async () => {
    expect((await errorsFor('password123')).length).toBeGreaterThan(0);
  });

  it('rejects passwords shorter than 12 chars', async () => {
    const errs = await errorsFor('Sh0rt!1');
    expect(errs.some((e) => e.constraints?.minLength)).toBe(true);
  });

  it('requires a lowercase letter', async () => {
    const errs = await errorsFor('UPPER1234!@#$');
    expect(errs.some((e) => e.constraints?.matches)).toBe(true);
  });
});
