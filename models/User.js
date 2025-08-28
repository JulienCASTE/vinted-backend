const mongoose = require("mongoose");

const User = mongoose.model("User", {
  email: {
    type: String,
    unique: true,
  },
  account: {
    username: {
      type: String,
      required: true,
    },
    avatar: Object,
  },
  newsletter: Boolean,
  token: String,
  hash: String,
  salt: String,
});

User.export = (user) => {
  if (!user) {
    return null;
  }

  return {
    _id: user._id,
    token: user.token,
    account: {
      username: user.account.username,
    },
  };
};

module.exports = User;
