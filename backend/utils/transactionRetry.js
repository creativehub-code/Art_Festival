const mongoose = require("mongoose");

class CommitAmbiguityError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = "CommitAmbiguityError";
    this.originalError = originalError;
  }
}

/**
 * Execute an operation within a multi-document MongoDB transaction with bounded retries.
 * Handles TransientTransactionError, WriteConflict (code 112), and UnknownTransactionCommitResult.
 *
 * @param {string} operationName - Label for logging and tracing
 * @param {Function} callback - Async function receiving (session)
 * @param {object} [options] - Configuration
 * @param {number} [options.maxRetries=5] - Maximum execution retries
 * @param {number} [options.maxCommitRetries=3] - Maximum commit retries on commit ambiguity
 * @returns {Promise<any>}
 */
const withTransactionRetry = async (
  operationName,
  callback,
  options = {}
) => {
  const maxRetries = options.maxRetries || 5;
  const maxCommitRetries = options.maxCommitRetries || 3;

  let attempt = 1;

  while (attempt <= maxRetries) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const result = await callback(session);

      // Commit transaction with specialized commit retry handling
      let commitAttempt = 1;
      let committed = false;

      while (!committed && commitAttempt <= maxCommitRetries) {
        try {
          await session.commitTransaction();
          committed = true;
        } catch (commitErr) {
          const isUnknownCommit =
            commitErr.hasErrorLabel &&
            commitErr.hasErrorLabel("UnknownTransactionCommitResult");

          if (isUnknownCommit && commitAttempt < maxCommitRetries) {
            console.warn(
              `[${operationName}] UnknownTransactionCommitResult detected. Retrying commit on same session (attempt ${commitAttempt + 1}/${maxCommitRetries})`
            );
            commitAttempt++;
            await new Promise((resolve) =>
              setTimeout(resolve, 50 * commitAttempt)
            );
            continue;
          }

          if (isUnknownCommit) {
            throw new CommitAmbiguityError(
              `[${operationName}] Transaction commit status ambiguous after ${maxCommitRetries} retries`,
              commitErr
            );
          }

          throw commitErr;
        }
      }

      return result;
    } catch (error) {
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortErr) {
          // Suppress abort errors to preserve primary error
        }
      }

      const isTransient =
        error.hasErrorLabel &&
        error.hasErrorLabel("TransientTransactionError");
      const isWriteConflict = error.code === 112;

      if ((isTransient || isWriteConflict) && attempt < maxRetries) {
        const backoffMs = Math.min(
          50 * Math.pow(2, attempt - 1) + Math.random() * 50,
          1000
        );
        console.warn(
          `[${operationName}] Concurrency conflict (${isWriteConflict ? "WriteConflict 112" : "TransientTransactionError"}). Retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      throw error;
    } finally {
      await session.endSession();
    }
  }
};

module.exports = {
  withTransactionRetry,
  CommitAmbiguityError,
};
