const mongoose = require("mongoose");
const Language = require("../models/Language");

const DEFAULT_LANGUAGES = [
  { name: "Malayalam", position: 1 },
  { name: "Arabic", position: 2 },
  { name: "Urdu", position: 3 },
  { name: "English", position: 4 },
];

/**
 * Idempotently seeds default languages into the database.
 * Does not overwrite existing programs or judges.
 */
const seedLanguages = async () => {
  try {
    for (const lang of DEFAULT_LANGUAGES) {
      const existing = await Language.findOne({
        name: { $regex: new RegExp(`^${lang.name}$`, "i") },
      });

      if (!existing) {
        await Language.create(lang);
        console.log(`[SeedLanguages] Created default language: ${lang.name} (Position ${lang.position})`);
      }
    }
  } catch (error) {
    console.error("[SeedLanguages] Error seeding default languages:", error.message);
  }
};

// If run directly from CLI (e.g. node scripts/seedLanguages.js)
if (require.main === module) {
  const dotenv = require("dotenv");
  dotenv.config({ path: "../.env" });
  const connectDB = require("../config/db");

  const runStandalone = async () => {
    await connectDB();
    await seedLanguages();
    await mongoose.connection.close();
    console.log("[SeedLanguages] CLI Seed completed successfully.");
    process.exit(0);
  };

  runStandalone();
}

module.exports = seedLanguages;
