"use strict";

function createRetryableInitializer(initializer) {
  let currentAttempt = null;

  return async function ensureInitialized() {
    if (!currentAttempt) {
      currentAttempt = Promise.resolve().then(initializer);
    }

    try {
      return await currentAttempt;
    } catch (error) {
      // A transient dependency failure must not poison a warm serverless
      // instance forever. The next request is allowed to initialize again.
      currentAttempt = null;
      throw error;
    }
  };
}

module.exports = { createRetryableInitializer };
