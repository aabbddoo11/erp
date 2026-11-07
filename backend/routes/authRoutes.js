
import express from "express";
import {
  register,
  login,
  getMe,
  changePassword,
} from "../controler/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const userRouter = express.Router();

userRouter.post("/register", register);
userRouter.post("/login", login);
userRouter.get("/me", protect, getMe);
userRouter.patch("/change-password", protect, changePassword);

export default userRouter;
