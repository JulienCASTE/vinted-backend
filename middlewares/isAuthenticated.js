const User = require("../models/User");

const isAuthenticated = async (request, response, next) => {
  try {
    if (request.headers.authorization) {
      const user = await User.findOne({
        token: request.headers.authorization.replace("Bearer ", ""),
      });

      if (!user) {
        return response.status(401).json({ error: "Unauthorized" });
      } else {
        request.authUser = user;
        // On crée une clé "user" dans request. La route dans laquelle le middleware est appelé pourra avoir accès à req.user
        return next();
      }
    } else {
      return response.status(401).json({ error: "Unauthorized" });
    }
  } catch (error) {
    console.log(error);

    return response.status(500).json({ message: error.message });
  }
};

module.exports = isAuthenticated;
