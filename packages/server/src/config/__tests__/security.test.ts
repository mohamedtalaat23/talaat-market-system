import {
  MIN_PASSWORD_LENGTH,
  assertStrongProductionSecret,
  generateStrongPassword,
  isWeakPin,
  isWeakSecret,
} from '../security';

describe('security helpers', () => {
  describe('isWeakSecret', () => {
    it.each([
      'admin123',
      'password',
      'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_STRING_JWT_32_CHARS',
      'dev_jwt_secret_change_this_in_production_minimum_32_chars_required',
      'dev_session_secret_change_this_in_production_minimum_32_chars_required',
      'your_secure_password_here',
      'short',
      '',
    ])('flags %p as weak', (value) => {
      expect(isWeakSecret(value)).toBe(true);
    });

    it('accepts a generated 24-character password', () => {
      expect(isWeakSecret(generateStrongPassword())).toBe(false);
    });

    it('accepts a long random hex secret', () => {
      expect(isWeakSecret('9f2c1a77be0d4b6c8e5317ad90f4b2cc')).toBe(false);
    });
  });

  describe('isWeakPin', () => {
    it.each(['1111', '0000', '1234', '4321', '7777', '123456', '654321'])(
      'flags %p as weak',
      (pin) => {
        expect(isWeakPin(pin)).toBe(true);
      },
    );

    it.each(['4821', '9274', '482915'])('accepts %p', (pin) => {
      expect(isWeakPin(pin)).toBe(false);
    });

    it('rejects values that are not 4-6 digits', () => {
      expect(isWeakPin('12')).toBe(true);
      expect(isWeakPin('abcd')).toBe(true);
      expect(isWeakPin('')).toBe(true);
    });
  });

  describe('generateStrongPassword', () => {
    it('produces URL-safe passwords long enough for the policy', () => {
      const password = generateStrongPassword();

      expect(password).toHaveLength(24);
      expect(password.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
      expect(password).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('never repeats the same value', () => {
      const generated = new Set(Array.from({ length: 25 }, () => generateStrongPassword()));
      expect(generated.size).toBe(25);
    });
  });

  describe('assertStrongProductionSecret', () => {
    it('throws for placeholder values', () => {
      expect(() => assertStrongProductionSecret('JWT_SECRET', 'dev_jwt_secret_xyz')).toThrow(
        /JWT_SECRET/,
      );
    });

    it('accepts strong values', () => {
      expect(() =>
        assertStrongProductionSecret('JWT_SECRET', generateStrongPassword(32)),
      ).not.toThrow();
    });
  });
});
