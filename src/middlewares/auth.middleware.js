import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
      const token =
        req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
  
      if (!token) {
        throw new ApiError(401, "Unauthorized access - No token provided");
      }
  
      let decodedToken;
      try {
        decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      } catch (error) {
        if (error.name === "TokenExpiredError") {
          throw new ApiError(401, "Token has expired");
        } else if (error.name === "JsonWebTokenError") {
          throw new ApiError(401, "Invalid token");
        } else {
          throw new ApiError(401, "Failed to authenticate token");
        }
      }
  
      const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
  
      if (!user) {
        throw new ApiError(401, "User not found or invalid token");
      }
  
      req.user = user; // Attach the user to the request object
      next();
    } catch (error) {
      throw new ApiError(error.statusCode || 401, error.message || "Invalid access token");
    }
  });
  
  