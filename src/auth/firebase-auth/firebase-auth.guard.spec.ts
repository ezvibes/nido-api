import { FirebaseAuthGuard } from './firebase-auth.guard';

describe('FirebaseAuthGuard', () => {
  it('should be defined', () => {
    const authService = {
      verifyIdToken: jest.fn(),
    };
    expect(new FirebaseAuthGuard(authService as any)).toBeDefined();
  });
});
