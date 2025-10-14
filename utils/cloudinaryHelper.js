const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name:   process.env.CLOUDINARY_CLOUD_NAME,
  api_key:      process.env.CLOUDINARY_API_KEY,
  api_secret:   process.env.CLOUDINARY_API_SECRET,
});


const getSafeName = (name) => name.replace(/\s+/g, "").toLowerCase();

const streamUpload = (buffer, folder, public_id) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id,
        resource_type: "image",
        overwrite: true
      },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );
    stream.end(buffer);
  });
};

const uploadImage = async ({
  filePath,           // Buffer from multer memoryStorage
  restaurantName,
  type,
  menuItemName,
  imageIndex = 1
}) => {
  try {
    const safeRestaurant = getSafeName(restaurantName);
    let folder = safeRestaurant;
    let imageName, publicId;

    if (type === "restaurantLogo") {
      folder += "/logo";
      imageName = safeRestaurant + "_logo";
      publicId = `${folder}/${imageName}`;
    } else if (type === "menuitem" && menuItemName) {
      const safeMenuItem = getSafeName(menuItemName);
      folder += `/menuitem/${safeMenuItem}`;
      imageName = `${safeMenuItem}${imageIndex}`;
      publicId = `${folder}/${imageName}`;
    } else {
      folder += `/${type || "other"}`;
      imageName = safeRestaurant + "_" + (type || "image");
      publicId = `${folder}/${imageName}`;
    }

    // Use streamUpload with buffer, folder and imageName
    const result = await streamUpload(filePath, folder, imageName);
    return result.secure_url;
  } catch (err) {
    throw new Error('Image upload failed: ' + err.message);
  }
};


const deleteImage = async (restaurantName, type, menuItemName) => {
  const safeRestaurant = getSafeName(restaurantName);
  let publicId;
  if (type === "restaurantLogo") {
    publicId = `${safeRestaurant}/logo/${safeRestaurant}_logo`;
  } else if (type === "menuitem" && menuItemName) {
    const safeMenuItem = getSafeName(menuItemName);
    publicId = `${safeRestaurant}/menuitem/${safeMenuItem}/${safeMenuItem}1`; // you can delete all images if needed by looping numbers
  }
  else {
    publicId = `${safeRestaurant}/${type}/${safeRestaurant}_${type}`;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (err) {
    throw new Error('Image deletion failed: ' + err.message);
  }
};

module.exports = { uploadImage, deleteImage };
