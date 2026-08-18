const mongoose = require("mongoose");
require("dotenv").config();
const Program = require("./models/Program");
const Team = require("./models/Team");

async function verify() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to DB: ${mongoose.connection.name}`);
    
    // Ensure indexes are built
    await Program.syncIndexes();
    await Team.syncIndexes();
    
    const programIndexes = await Program.collection.indexes();
    const teamIndexes = await Team.collection.indexes();
    
    console.log("\nProgram Indexes:");
    console.log(JSON.stringify(programIndexes, null, 2));
    
    console.log("\nTeam Indexes:");
    console.log(JSON.stringify(teamIndexes, null, 2));
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

verify();
