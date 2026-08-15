import { cleanupAuthData } from "@/server/auth/cleanup";

async function main() {
  const result = await cleanupAuthData();

  console.log(
    JSON.stringify(
      {
        expiredVerificationTokensDeleted: result.expiredVerificationTokensDeleted,
        oldRegistrationAttemptsDeleted: result.oldRegistrationAttemptsDeleted,
        registrationAttemptCutoff: result.registrationAttemptCutoff.toISOString(),
        verificationTokenCutoff: result.verificationTokenCutoff.toISOString()
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
