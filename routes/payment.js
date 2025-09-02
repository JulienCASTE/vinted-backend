require("dotenv").config();
const express = require("express");
const cors = require("cors");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const router = express.Router();
router.use(cors());
router.use(express.json());

router.post("/payment", async (request, response) => {
  const { productName, amountInCents } = request.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      description: productName,
    });
    response.status(201).json(paymentIntent);
  } catch (error) {
    console.log(error);
    response.status(500).json({ message: error.message });
  }
});

module.exports = router;
