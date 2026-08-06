const getErrorMessage = (error) => String(error?.message || error || "");

export const isRecoverablePrivySessionError = (error) => {
  const message = getErrorMessage(error).toLowerCase();
  const isNetworkFailure = message.includes("failed to fetch") || message.includes("no response");
  const isPrivyRequest = message.includes("auth.privy.io") || message.includes("/api/privy/");
  return isNetworkFailure && isPrivyRequest && message.includes("/sessions");
};

export const sendEmailCodeWithSessionRecovery = async ({ email, sendCode, clearSession }) => {
  try {
    await sendCode({ email });
  } catch (error) {
    if (!isRecoverablePrivySessionError(error)) throw error;

    // A stale local refresh token makes Privy refresh /sessions before it can
    // start a new OTP flow. logout clears that local state even when the
    // remote session endpoint is unreachable.
    await clearSession();
    await sendCode({ email });
  }
};
