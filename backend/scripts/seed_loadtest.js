require("dotenv").config();
const mongoose = require("mongoose");
const Group = require("../models/Group");
const Team = require("../models/Team");
const Program = require("../models/Program");
const Participant = require("../models/Participant");
const Judge = require("../models/Judge");
const JudgeGroup = require("../models/JudgeGroup");
const ConversationPair = require("../models/ConversationPair");

const seedLoadTest = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);

    // 1. MANDATORY SAFETY GUARD
    if (mongoose.connection.name !== "musabaqa_load_test") {
      console.error("\n==============================================");
      console.error("FATAL ERROR: Connected database is", mongoose.connection.name);
      console.error("This script can ONLY be run against the 'musabaqa_loadtest' database.");
      console.error("Aborting immediately. No writes performed.");
      console.error("==============================================\n");
      process.exit(1);
    }
    console.log("SAFETY GUARD PASSED: Confirmed database is 'musabaqa_loadtest'.\n");

    console.log("Starting Load-Test Seed Process (Idempotent Mode)...\n");

    // 2. GROUPS
    const groups = [];
    for (let i = 1; i <= 5; i++) {
      const name = `LOADTEST_GROUP_${i.toString().padStart(2, "0")}`;
      let g = await Group.findOne({ name });
      if (!g) g = await Group.create({ name });
      groups.push(g);
    }
    console.log(`✅ Groups resolved: ${groups.length}`);

    // 3. TEAMS
    const teams = [];
    for (let i = 1; i <= 15; i++) {
      const name = `LOADTEST_TEAM_${i.toString().padStart(2, "0")}`;
      let t = await Team.findOne({ name });
      if (!t) t = await Team.create({ name });
      teams.push(t);
    }
    console.log(`✅ Teams resolved: ${teams.length}`);

    // 4. PROGRAMS
    const programs = [];
    for (let i = 1; i <= 20; i++) {
      const name = `LOADTEST_PROGRAM_${i.toString().padStart(2, "0")}`;
      const isConversation = i <= 3; // First 3 are conversation programs
      let p = await Program.findOne({ name });
      if (!p) {
        p = await Program.create({
          name,
          maxMarks: 100,
          status: "upcoming",
          language: "English",
          isConversation,
          groupId: groups[i % groups.length]._id,
        });
      }
      programs.push(p);
    }
    console.log(`✅ Programs resolved: ${programs.length}`);

    // 5. PARTICIPANTS
    const participants = [];
    for (let i = 1; i <= 350; i++) {
      const chestNumber = `LT${i.toString().padStart(3, "0")}`;
      const tIndex = (i - 1) % teams.length;
      const gIndex = (i - 1) % groups.length;
      let p = await Participant.findOne({ chestNumber });
      if (!p) {
        p = await Participant.create({
          name: `LOADTEST_STUDENT_${i.toString().padStart(3, "0")}`,
          chestNumber,
          teamId: teams[tIndex]._id,
          groupId: groups[gIndex]._id,
          programs: [programs[3]._id], // Default base program
        });
      }
      participants.push(p);
    }
    console.log(`✅ Participants resolved: ${participants.length}`);

    // 6. CONVERSATION PAIRS
    console.log("\nAnalyzing eligible ConversationPair groupings...");
    const participantBuckets = {};
    for (let p of participants) {
      const key = `${p.teamId.toString()}_${p.groupId.toString()}`;
      if (!participantBuckets[key]) participantBuckets[key] = [];
      participantBuckets[key].push(p);
    }

    const eligibleBuckets = Object.values(participantBuckets).filter(arr => arr.length >= 4);
    let convPairsCreated = 0;
    let convPairsExisting = 0;

    if (eligibleBuckets.length >= 3) {
      const reqSizes = [2, 3, 4];
      for (let i = 0; i < 3; i++) {
        const bucket = eligibleBuckets[i];
        const members = bucket.slice(0, reqSizes[i]);
        const programId = programs[i]._id; // This matches the 3 conversation programs

        const existing = await ConversationPair.findOne({
          programId,
          primaryParticipantId: members[0]._id,
        });

        if (!existing) {
          await ConversationPair.create({
            programId,
            participants: members.map(m => m._id),
            primaryParticipantId: members[0]._id,
            teamId: members[0].teamId,
            groupId: members[0].groupId,
          });
          convPairsCreated++;
        } else {
          convPairsExisting++;
        }
      }
    } else {
      console.log(`⚠️ Warning: Not enough eligible Team+Group buckets (found ${eligibleBuckets.length}, needed 3)`);
    }
    console.log(`✅ ConversationPairs: Created ${convPairsCreated}, Already Exist ${convPairsExisting}`);

    // 7. JUDGES & JUDGE GROUPS
    const judges = [];
    for (let i = 1; i <= 20; i++) {
      const username = `loadtest_judge_${i.toString().padStart(2, "0")}`;
      let j = await Judge.findOne({ username });
      if (!j) {
        j = await Judge.create({
          name: `LOADTEST_JUDGE_${i.toString().padStart(2, "0")}`,
          username,
          email: `${username}@test.com`,
          password: "password123",
          role: "judge",
          category: "English"
        });
      }
      judges.push(j);
    }
    console.log(`✅ Judges resolved: ${judges.length}`);

    const judgeGroups = [];
    for (let i = 1; i <= 5; i++) {
      const name = `LOADTEST_JUDGE_GROUP_${i.toString().padStart(2, "0")}`;
      const assignedJudges = judges.slice((i - 1) * 4, i * 4).map(j => j._id);
      const assignedProgs = programs.slice((i - 1) * 4, i * 4).map(p => p._id);
      
      let jg = await JudgeGroup.findOne({ name });
      if (!jg) {
        jg = await JudgeGroup.create({
          name,
          judges: assignedJudges,
          assignedPrograms: assignedProgs,
        });
      } else {
        jg.judges = assignedJudges;
        jg.assignedPrograms = assignedProgs;
        await jg.save();
      }
      judgeGroups.push(jg);
    }
    console.log(`✅ JudgeGroups resolved: ${judgeGroups.length}`);

    // Update Judges with their new JudgeGroupId
    for (let jg of judgeGroups) {
      await Judge.updateMany({ _id: { $in: jg.judges } }, { $set: { judgeGroupId: jg._id } });
    }

    // 8. READ-ONLY INTEGRITY VERIFICATION
    console.log("\n==============================================");
    console.log("RUNNING INTEGRITY VERIFICATION...");
    console.log("==============================================");
    
    const dbName = mongoose.connection.name;
    const finalCounts = {
      Participants: await Participant.countDocuments({ chestNumber: /^LT/ }),
      Teams: await Team.countDocuments({ name: /^LOADTEST/ }),
      Groups: await Group.countDocuments({ name: /^LOADTEST/ }),
      Programs: await Program.countDocuments({ name: /^LOADTEST/ }),
      Judges: await Judge.countDocuments({ username: /^loadtest/ }),
      JudgeGroups: await JudgeGroup.countDocuments({ name: /^LOADTEST/ }),
      ConversationPairs: await ConversationPair.countDocuments({
        programId: { $in: programs.map(p => p._id) }
      })
    };

    const invalidParticipantAssocs = await Participant.countDocuments({
      chestNumber: /^LT/,
      $or: [{ teamId: { $exists: false } }, { groupId: { $exists: false } }]
    });

    const pairs = await ConversationPair.find({
      programId: { $in: programs.map(p => p._id) }
    }).populate("participants");

    let invalidPairs = 0;
    for (let pair of pairs) {
      if (pair.participants.length < 2) invalidPairs++;
      const firstT = pair.participants[0].teamId.toString();
      const firstG = pair.participants[0].groupId.toString();
      for (let member of pair.participants) {
        if (member.teamId.toString() !== firstT || member.groupId.toString() !== firstG) {
          invalidPairs++;
        }
      }
    }

    let invalidJgRefs = 0;
    for (let jg of judgeGroups) {
      const validJ = await Judge.countDocuments({ _id: { $in: jg.judges } });
      const validP = await Program.countDocuments({ _id: { $in: jg.assignedPrograms } });
      if (validJ !== jg.judges.length || validP !== jg.assignedPrograms.length) {
        invalidJgRefs++;
      }
    }

    console.log(`\n--- LOAD TEST SEED SUMMARY ---`);
    console.log(`Database Target: ${dbName}`);
    console.log(`Participants: ${finalCounts.Participants} (Expected: 350)`);
    console.log(`Teams: ${finalCounts.Teams} (Expected: 15)`);
    console.log(`Groups: ${finalCounts.Groups} (Expected: 5)`);
    console.log(`Programs: ${finalCounts.Programs} (Expected: 20)`);
    console.log(`Judges: ${finalCounts.Judges} (Expected: 20)`);
    console.log(`JudgeGroups: ${finalCounts.JudgeGroups} (Expected: 5)`);
    console.log(`ConversationPairs: ${finalCounts.ConversationPairs} (Expected: at least ${convPairsCreated + convPairsExisting})\n`);

    console.log("--- HEALTH CHECKS ---");
    console.log(`All load-test participants have Team/Group: ${invalidParticipantAssocs === 0 ? "PASS" : "FAIL (" + invalidParticipantAssocs + " missing)"}`);
    console.log(`All ConversationPairs are valid (same team+group, >=2 members): ${invalidPairs === 0 ? "PASS" : "FAIL (" + invalidPairs + " invalid)"}`);
    console.log(`All JudgeGroup references resolve correctly: ${invalidJgRefs === 0 ? "PASS" : "FAIL (" + invalidJgRefs + " invalid)"}`);

    if (invalidParticipantAssocs > 0 || invalidPairs > 0 || invalidJgRefs > 0) {
      console.error("\n⚠️ WARNING: Integrity issues detected! Please review the errors above.");
    } else {
      console.log("\n✅ ALL INTEGRITY CHECKS PASSED SUCCESSFULLY.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error during seed process:", error);
    process.exit(1);
  }
};

seedLoadTest();
