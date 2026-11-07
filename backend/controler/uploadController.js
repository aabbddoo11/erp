import {
  createPresignedUploadUrl,
  deleteR2Object,
} from "../services/r2Service.js";

const allowedFolders = new Set([
  "products/gallery",
  "products/colors",
]);

export const createUploadUrl = async (req, res) => {
  try {
    const {
      fileName,
      contentType,
      folder,
    } = req.body;

    if (!fileName) {
      return res.status(400).json({
        message: "File name is required",
      });
    }

    if (!folder || !allowedFolders.has(folder)) {
      return res.status(400).json({
        message: "Invalid upload folder",
      });
    }

    const result =
      await createPresignedUploadUrl({
        folder,
        fileName,
        contentType:
          contentType ||
          "application/octet-stream",
      });

    res.status(200).json(result);
  } catch (error) {
    console.error(
      "Create upload URL error:",
      error
    );

    res.status(500).json({
      message:
        error.message ||
        "Failed to create upload URL",
    });
  }
};

export const deleteUpload = async (
  req,
  res
) => {
  try {
    const { key } = req.body;

    if (
      !key ||
      typeof key !== "string"
    ) {
      return res.status(400).json({
        message: "Storage key is required",
      });
    }

    if (!key.startsWith("products/")) {
      return res.status(400).json({
        message: "Invalid storage key",
      });
    }

    await deleteR2Object(key);

    res.status(200).json({
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete upload error:",
      error
    );

    res.status(500).json({
      message: "Failed to delete file",
    });
  }
};