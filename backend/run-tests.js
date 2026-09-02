const mongoose = require('mongoose');
require('dotenv').config();
const Program = require('./models/Program');
const Group = require('./models/Group');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/musabaqa_db');
        const programs = await Program.find().populate("groupId");
        
        const programsWithMarkStatus = programs.map(program => {
          return {
            ...program.toObject(),
          };
        });

        console.log("Number of programs:", programsWithMarkStatus.length);
        const programWithTopics = programsWithMarkStatus.find(p => p.topics && p.topics.length > 0);
        if (programWithTopics) {
            console.log("Found program with topics!");
            console.log("Topics array present?", Array.isArray(programWithTopics.topics));
            console.log("Topics count:", programWithTopics.topics.length);
            console.log("Topic structure:", Object.keys(programWithTopics.topics[0]));
            console.log("Topic values:", programWithTopics.topics[0]);
        } else {
            console.log("No programs with topics found in the DB.");
        }
        
        console.log("Verification complete");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
