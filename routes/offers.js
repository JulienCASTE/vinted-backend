require("dotenv").config();
const express = require("express");
const fileUpload = require("express-fileupload");
// import { v2 as cloudinary } from "cloudinary";
const { v2: cloudinary } = require("cloudinary");
const isAuthenticated = require("../middlewares/isAuthenticated");
const convertFileToBase64 = require("../helpers/base64Converter");
const Offer = require("../models/Offer");
const e = require("express");
const User = require("../models/User");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();
router.use(express.json());
// router.use(isAuthenticated);

router.post(
  "/offers/publish",
  isAuthenticated,
  fileUpload(),
  async (request, response) => {
    try {
      const { title, description, price, condition, city, brand, size, color } =
        request.body;
      const picture = request.files?.picture ?? null;

      if (
        "string" !== typeof title ||
        0 === title.length ||
        50 < title.length ||
        "string" !== typeof description ||
        0 === description.length ||
        500 < description.length ||
        isNaN(price) ||
        0 > parseFloat(price) ||
        10000 < parseFloat(price) ||
        "string" !== typeof condition ||
        0 === condition.length ||
        "string" !== typeof city ||
        0 === city.length ||
        "string" !== typeof brand ||
        0 === brand.length ||
        "string" !== typeof size ||
        0 === size.length ||
        "string" !== typeof color ||
        0 === size.color ||
        "object" !== typeof picture ||
        !picture.data ||
        !picture.mimetype.includes("image")
      ) {
        response.status(400).json({ message: "Invalid request" });

        return;
      }

      const offer = new Offer({
        product_name: title,
        product_description: description,
        product_price: parseFloat(price),
        product_details: [
          { MARQUE: brand },
          { TAILLE: size },
          { ÉTAT: condition },
          { COULEUR: color },
          { EMPLACEMENT: city },
        ],
        product_image: null,
        owner: request.authUser,
      });

      await offer.save();

      const pictureFileObject = await cloudinary.uploader.upload(
        convertFileToBase64(picture),
        {
          asset_folder: `${process.env.CLOUDINARY_OFFER_PICTURES_ASSET_FOLDER_PREFIX}${offer._id}`,
          use_asset_folder_as_public_id_prefix: true,
        }
      );

      offer.product_image = pictureFileObject;
      await offer.save();

      response.status(201).json(offer);
    } catch (error) {
      console.log(error);
      response.status(500).json({ message: error.message });
    }
  }
);

router.put(
  "/offers/:id",
  isAuthenticated,
  fileUpload(),
  async (request, response) => {
    try {
      const { id } = request.params;

      const offer = await Offer.findById(id);
      if (null === offer) {
        response.status(404).json({ message: "Offer not found" });

        return;
      }

      const { title, description, price, condition, city, brand, size, color } =
        request.body;
      const { picture } = request.files || {};

      if (
        "string" !== typeof title ||
        0 === title.length ||
        50 < title.length ||
        "string" !== typeof description ||
        0 === description.length ||
        500 < description.length ||
        isNaN(price) ||
        0 > parseFloat(price) ||
        10000 < parseFloat(price) ||
        "string" !== typeof condition ||
        0 === condition.length ||
        "string" !== typeof city ||
        0 === city.length ||
        "string" !== typeof brand ||
        0 === brand.length ||
        "string" !== typeof size ||
        0 === size.length ||
        "string" !== typeof color ||
        0 === size.color ||
        (picture !== undefined &&
          ("object" !== typeof picture ||
            !picture.data ||
            !picture.mimetype.includes("image")))
      ) {
        response.status(400).json({ message: "Invalid request" });

        return;
      }

      const updatedOffer = await Offer.findByIdAndUpdate(
        id,
        {
          $set: {
            product_name: title,
            product_description: description,
            product_price: parseFloat(price),
            product_details: [
              { MARQUE: brand },
              { TAILLE: size },
              { ÉTAT: condition },
              { COULEUR: color },
              { EMPLACEMENT: city },
            ],
            owner: request.authUser,
          },
        },
        { new: true }
      );

      if (picture) {
        await cloudinary.uploader.destroy(updatedOffer.product_image.public_id);

        const pictureFileObject = await cloudinary.uploader.upload(
          convertFileToBase64(picture),
          {
            asset_folder: `${process.env.CLOUDINARY_OFFER_PICTURES_ASSET_FOLDER_PREFIX}${updatedOffer._id}`,
            use_asset_folder_as_public_id_prefix: true,
          }
        );

        updatedOffer.product_image = pictureFileObject;
        await updatedOffer.save();
      }

      response.status(200).json(updatedOffer);
    } catch (error) {
      console.log(error);
      response.status(500).json({ message: error.message });
    }
  }
);

router.delete("/offers/:id", isAuthenticated, async (request, response) => {
  try {
    const { id } = request.params;

    const offer = await Offer.findById(id);
    if (null === offer) {
      response.status(404).json({ message: "Offer not found" });

      return;
    }

    const deletedOffer = await Offer.findByIdAndDelete(id);

    const destroyResult = await cloudinary.uploader.destroy(
      deletedOffer.product_image.public_id
    );

    if (destroyResult.result !== "ok") {
      response.status(200).json({ message: "Picture not deleted" });
    }

    const { resources, total_count } =
      (await cloudinary.api.resources_by_asset_folder(
        `${process.env.CLOUDINARY_OFFER_PICTURES_ASSET_FOLDER_PREFIX}${deletedOffer._id}`
      )) || {};
    if (total_count === 0 && resources) {
      await cloudinary.api.delete_folder(
        `${process.env.CLOUDINARY_OFFER_PICTURES_ASSET_FOLDER_PREFIX}${deletedOffer._id}`
      );
    }

    response.status(200).json({ message: "Offer successfully deleted" });
  } catch (error) {
    console.log(error);
    response.status(500).json({ message: error.message });
  }
});

router.get("/offers", async (request, response) => {
  try {
    const MAX_PER_PAGE = 10;
    const {
      title,
      priceMin,
      priceMax,
      sort,
      page = 1,
      limit = MAX_PER_PAGE,
    } = request.query;

    if (
      (title !== undefined && ("string" !== typeof title || title === "")) ||
      (priceMin !== undefined &&
        (isNaN(priceMin) || parseFloat(priceMin) < 0)) ||
      (priceMax !== undefined &&
        (isNaN(priceMax) ||
          parseFloat(priceMax) < 0 ||
          (priceMin !== undefined &&
            parseFloat(priceMax) < parseFloat(priceMin)))) ||
      (sort !== undefined && !["price-desc", "price-asc"].includes(sort)) ||
      (page !== undefined &&
        (isNaN(page) ||
          !Number.isInteger(parseFloat(page)) ||
          0 >= parseInt(page))) ||
      (limit !== undefined &&
        (isNaN(limit) ||
          !Number.isInteger(parseFloat(limit)) ||
          0 >= parseInt(limit)))
    ) {
      response.status(400).json({ message: "Invalid request" });

      return;
    }

    const offers = await Offer.find(getFilter(request.query))
      .sort(getSort(sort))
      .limit(parseInt(limit))
      .skip(parseInt(limit) * (parseInt(page) - 1));

    response.status(200).json(offers);
  } catch (error) {
    console.log(error);
    response.status(500).json({ message: error.message });
  }
});

router.get("/offers/:id", async (request, response) => {
  try {
    const { id } = request.params;

    const offer = await Offer.findById(id).populate("owner");

    if (null === offer) {
      response.status(404).json({ message: "Offer not found" });

      return;
    }

    offer.owner = User.export(offer.owner);

    response.status(200).json(offer);
  } catch (error) {
    console.log(error);
    response.status(500).json({ message: error.message });
  }
});

const getFilter = (params) => {
  const filter = {};

  const { title, priceMin, priceMax } = params;

  if (title !== undefined) {
    filter.product_name = new RegExp(title, "i");
  }

  if (priceMin !== undefined && priceMax !== undefined) {
    filter.product_price = { $gte: priceMin, $lte: priceMax };
  } else if (priceMin !== undefined) {
    filter.product_price = { $gte: priceMin };
  } else if (priceMax !== undefined) {
    filter.product_price = { $lte: priceMax };
  }

  return filter;
};

const getSort = (sort) => {
  if ("price-desc" === sort) {
    return { product_price: "desc" };
  } else if ("price-asc" === sort) {
    return { product_price: "asc" };
  }

  return null;
};

module.exports = router;
