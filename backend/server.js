import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import errorHandler from "./middleware/errorHandler.js";
import connectDB from "./config/db.js";
import router from "./routes/index.js";
const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);




app.use(cors());

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

app.use(hpp());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many requests, please try again later.",
  },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many upload requests, please try again later.",
  },
});


app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
  });
});
app.use("/uploads", uploadLimiter);
app.use("/api", apiLimiter, router);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function main() {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();