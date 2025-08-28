require("dotenv").config();
const express = require("express");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const uid2 = require("uid2");
const fileUpload = require("express-fileupload");
const convertFileToBase64 = require("../helpers/base64Converter");
const { v2: cloudinary } = require("cloudinary");
const User = require("../models/User");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();
router.use(express.json());

router.post("/user/signup", fileUpload(), async (request, response) => {
  try {
    const { username, email, password, newsletter } = request.body;

    if (
      "string" !== typeof username ||
      "" === username ||
      "string" !== typeof email ||
      "" === email ||
      "string" !== typeof password ||
      "" === password
    ) {
      response.status(400).json({ message: "Invalid request" });

      return;
    }

    const userCount = await User.countDocuments({ email: email });
    if (0 < userCount) {
      response
        .status(409)
        .json({ message: "User already registered with this email address" });

      return;
    }

    const salt = uid2(16);
    const hash = SHA256(password + salt).toString(encBase64);
    const token = uid2(16);

    const user = new User({
      email: email,
      account: {
        username: username,
        avatar: null,
      },
      newsletter: newsletter === "true",
      token: token,
      hash: hash,
      salt: salt,
    });

    await user.save();

    if (request.files) {
      const { picture } = request.files;
      const pictureFileObject = await cloudinary.uploader.upload(
        convertFileToBase64(picture),
        {
          asset_folder: `${process.env.CLOUDINARY_USER_PICTURES_ASSET_FOLDER_PREFIX}${user._id}`,
          use_asset_folder_as_public_id_prefix: true,
        }
      );

      user.account.avatar = pictureFileObject;
      await user.save();
    }

    response.status(201).json(User.export(user));
  } catch (error) {
    console.log(error);
    response.status(500).json({ message: error.message });
  }
});

router.post("/user/login", async (request, response) => {
  try {
    const { email, password } = request.body;

    const user = await User.findOne({ email: email });
    if (null === user) {
      response.status(404).json({ message: "User not found" });

      return;
    }

    const hash = SHA256(password + user.salt).toString(encBase64);

    if (hash !== user.hash) {
      response.status(401).json({ message: "Unauthorized" });

      return;
    }

    response.status(200).json(User.export(user));
  } catch (error) {
    console.log(error);
    response.status(500).json({ message: error.message });
  }
});

module.exports = router;
