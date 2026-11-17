const mongoose = require("mongoose");

const systemLockSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
    },
    lockedBy: {
      type: String,
      default: null,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    leaseExpiresAt: {
      type: Date,
      default: null,
    },
    fencingToken: {
      type: Number,
      default: 0,
    },
    activeGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Acquire distributed lock atomically with a lease duration and monotonic fencing token.
 * @param {string} lockId - Unique lock identifier (e.g. 'CHEST_RANGE_MUTEX')
 * @param {string} workerToken - UUID identifying the requester
 * @param {number} leaseDurationMs - Lease time in ms (default: 30000)
 * @param {mongoose.Types.ObjectId} [activeGroupId] - Optional group being locked
 * @returns {Promise<{ acquired: boolean, lock?: object, fencingToken?: number }>}
 */
systemLockSchema.statics.acquireLock = async function (
  lockId,
  workerToken,
  leaseDurationMs = 30000,
  activeGroupId = null
) {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

  // 1. Ensure lock document exists without condition race
  await this.updateOne(
    { _id: lockId },
    {
      $setOnInsert: {
        isLocked: false,
        fencingToken: 0,
        lockedBy: null,
        leaseExpiresAt: null,
        activeGroupId: null,
      },
    },
    { upsert: true }
  );

  // 2. Conditionally acquire the lock without upsert to prevent E11000 duplicate key
  const lock = await this.findOneAndUpdate(
    {
      _id: lockId,
      $or: [
        { isLocked: false },
        { leaseExpiresAt: { $lt: now } },
        { leaseExpiresAt: null },
      ],
    },
    {
      $set: {
        isLocked: true,
        lockedBy: workerToken,
        leaseExpiresAt,
        activeGroupId,
      },
      $inc: {
        fencingToken: 1,
      },
    },
    {
      returnDocument: "after",
    }
  );

  if (lock && lock.lockedBy === workerToken) {
    return { acquired: true, lock, fencingToken: lock.fencingToken };
  }

  return { acquired: false };
};

/**
 * Release distributed lock if owned by the worker token.
 * @param {string} lockId
 * @param {string} workerToken
 * @returns {Promise<boolean>}
 */
systemLockSchema.statics.releaseLock = async function (lockId, workerToken) {
  const result = await this.findOneAndUpdate(
    {
      _id: lockId,
      lockedBy: workerToken,
    },
    {
      $set: {
        isLocked: false,
        lockedBy: null,
        leaseExpiresAt: null,
        activeGroupId: null,
      },
    },
    { returnDocument: "after" }
  );

  return Boolean(result && !result.isLocked);
};

module.exports = mongoose.model("SystemLock", systemLockSchema);
