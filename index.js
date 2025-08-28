const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI);

const app = express();
app.use(cors());

const authenticationRoutes = require("./routes/authentication");
app.use(authenticationRoutes);
const offersRoutes = require("./routes/offers");
app.use(offersRoutes);

app.all(/.*/, (request, response) => {
  response.status(404).json({ message: "Page not found" });
});

app.listen(process.env.PORT, () => {
  console.log("Server started");
});
