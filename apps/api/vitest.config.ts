import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2022',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./test/setup.ts'],
    // bcrypt cost-12 + real DB calls under parallel turbo load can exceed 5000ms
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        '**/*.module.ts',
        '**/*.spec.ts',
        'src/modules/auth/auth.types.ts',
        // Pure class-validator DTOs — decorator-only, no behaviour to test
        'src/modules/auth/dto/**',
        'src/modules/activities/dto/**',
        'src/modules/booking/dto/**',
        'src/modules/leads/dto/**',
        'src/modules/forms/dto/**',
        'src/modules/public/dto/**',
        'src/modules/products/dto/**',
        'src/modules/projects/dto/**',
        'src/modules/email/dto/**',
        'src/modules/campaigns/dto/**',
        // BullMQ processors — thin dispatcher wrappers, logic is in services
        'src/modules/email/email-sync.processor.ts',
        'src/modules/email/email-poll.processor.ts',
        'src/modules/campaigns/campaign-send.processor.ts',
        // Webhook controller — integration-tested via HTTP, not unit-testable (PubSub JWT)
        'src/modules/email/email-webhooks.controller.ts',
        // Public tracking controller — HTML responses, exercised via integration tests
        'src/modules/campaigns/campaign-tracking.controller.ts',
        // Thin external-API adapter: wraps googleapis + Microsoft Graph; exercised by integration tests
        'src/modules/email/email-sync.service.ts',
        // Booking module — public Calendly-style endpoints, exercised via integration tests
        'src/modules/booking/booking.module.ts',
        'src/modules/booking/booking.controller.ts',
        'src/modules/booking/booking.service.ts',
        // Public form submit — thin controller, rate-limit tested via integration
        'src/modules/public/public.controller.ts',
        'src/modules/public/public.module.ts',
        // Single-line AuthGuard subclasses (no logic to assert)
        'src/modules/auth/guards/jwt-pre-2fa.guard.ts',
        'src/modules/auth/guards/jwt-setup-2fa.guard.ts',
        'src/modules/auth/guards/google-oauth.guard.ts',
        'src/modules/auth/guards/microsoft-oauth.guard.ts',
        // Thin Passport-strategy adapters — require real providers to exercise
        'src/modules/auth/strategies/google.strategy.ts',
        'src/modules/auth/strategies/microsoft.strategy.ts',
        'src/modules/auth/strategies/jwt-pre-2fa.strategy.ts',
        'src/modules/auth/strategies/jwt-setup-2fa.strategy.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
