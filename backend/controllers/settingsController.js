const mongoose = require("mongoose");
const Setting = require("../models/Setting");

const getSettings = async (req, res) => {
  try {
    let settings;
    try {
      settings = await Setting.findOneAndUpdate(
        {},
        {
          $setOnInsert: {
            _id: new mongoose.Types.ObjectId("000000000000000000000000"),
            firstPlacePoints: 5,
            secondPlacePoints: 3,
            thirdPlacePoints: 1,
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (dbError) {
      if (dbError.code === 11000) {
        settings = await Setting.findOne();
      } else {
        throw dbError;
      }
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update the current settings
// @route   PUT /api/settings
// @access  Admin
const updateSettings = async (req, res) => {
  try {
    const { firstPlacePoints, secondPlacePoints, thirdPlacePoints } = req.body;

    let settings;
    try {
      settings = await Setting.findOneAndUpdate(
        {},
        {
          $setOnInsert: {
            _id: new mongoose.Types.ObjectId("000000000000000000000000"),
            ...(firstPlacePoints === undefined && { firstPlacePoints: 5 }),
            ...(secondPlacePoints === undefined && { secondPlacePoints: 3 }),
            ...(thirdPlacePoints === undefined && { thirdPlacePoints: 1 }),
          },
          $set: {
            ...(firstPlacePoints !== undefined && { firstPlacePoints }),
            ...(secondPlacePoints !== undefined && { secondPlacePoints }),
            ...(thirdPlacePoints !== undefined && { thirdPlacePoints }),
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (dbError) {
      if (dbError.code === 11000) {
        // If another concurrent request inserted it first, fetch it and update it
        settings = await Setting.findOneAndUpdate(
          {},
          {
            $set: {
              ...(firstPlacePoints !== undefined && { firstPlacePoints }),
              ...(secondPlacePoints !== undefined && { secondPlacePoints }),
              ...(thirdPlacePoints !== undefined && { thirdPlacePoints }),
            }
          },
          { new: true }
        );
      } else {
        throw dbError;
      }
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSettings, updateSettings };
