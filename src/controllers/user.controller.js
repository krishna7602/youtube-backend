import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"


const generateAccessAndRefereshTokens = async (userId) => {
  try {
    console.log("Generating tokens for userId:", userId);

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found while generating tokens");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    console.log("Tokens generated successfully:", { accessToken, refreshToken });

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error.message);
    throw new ApiError(500, "Failed to generate tokens");
  }
};



const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, userName, password } = req.body;

  if ([fullName, email, userName, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are compulsory");
  }

  const existedUser = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path; // Fixed typo here
  //const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  let coverImageLocalPath;
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
    coverImageLocalPath=req.files.coverImage[0].path
  }
  if (!avatarLocalPath) {
    throw new ApiError(410, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

  if (!avatar) {
    throw new ApiError(410, "Failed to upload avatar");
  }

  const newUser = await User.create({
    fullName,
    avatar: avatar.url, // Fixed typo `avatr` to `avatar`
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  });

  const createdUser = await User.findById(newUser._id).select("-password -refreshToken");

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res.status(201).json(
    new ApiResponse(200, createdUser, "User successfully registered")
  );
});


const loginUser = asyncHandler(async (req, res) => {
  const { email, userName, password } = req.body;

  if (!req.body) {
    throw new ApiError(400, "Request body is missing");
  }
  console.log(req.body.userName)
  

  if (!email && !userName) {
    throw new ApiError(400, "Either username or email is required");
  }

  const user = await User.findOne({
    $or: [{ userName: userName?.toLowerCase() }, { email: email?.toLowerCase() }],
  });

  if (!user) {
    throw new ApiError(404, "User doesn't exist");
  }
  
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Password is incorrect");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id);

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});



const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
  };

  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});


const refreshAccessToken=asyncHandler(async(req,res)=>{
  const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new ApiError(401,"unauthorized access")
  }

  try {
    const decodedToken=jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
  
    const user=await User.findById(decodedToken?._id)
  
    if(!user){
      throw new ApiError(401,"Invalid refresh Token")
    }
    
    if(incomingRefreshToken!==user?.refreshToken){
      throw new ApiError(401,"refresh token is expired or used")
    }
  
    const options={
      httpOnly:true,
      secure: true,
    }
  
    const {accessToken,newRefreshToken}=await generateAccessAndRefereshTokens(user._id)
  
    return res.status(200).cookie("accessToken",accessToken,options).cookie("refreshToken",newRefreshToken,options).json(new ApiResponse(200,{accessToken,newRefreshToken}, "Access token refreshed") )
  } catch (error) {
      throw new ApiError(401, error?.message || "invalid refresh token")
  }

})


const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body;

    const user=await User.findById(req.user?._id)

    if(!user){
      throw new ApiError(404, "User not found")
    }

    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
      throw new ApiError(401, "Old password is incorrect")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})


    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"))
})




const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, req.user, "User found"))
})


const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email, userName } = req.body;

  if ([fullName, email, userName].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are compulsory");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const existedUser = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (existedUser && existedUser._id.toString() !== req.user._id.toString()) {
    throw new ApiError(409, "User already exists");
  }

  user.fullName = fullName;
  user.email = email;
  user.userName = userName.toLowerCase();

  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, user, "User updated successfully"));
})



const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.file?.path
    if(!avatarLocalPath){
      throw new ApiError(400, "Avatar is required")
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath)

    if(!avatar){
      throw new ApiError(400, "Error uploading avatar");
    }

    const user=await User.findByIdAndUpdate(req.user?._id,{avatar:avatar.url},{new:true}).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"));
})


const updateUserCoverImage=asyncHandler(async(req,res)=>{
  const coverImageLocalPath=req.file?.path
  if(!coverImageLocalPath){
    throw new ApiError(400, "Cover Image is required")
  }

  const coverImage=await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage){
    throw new ApiError(400, "Error uploading avatar");
  }

  const user=await User.findByIdAndUpdate(req.user?._id,{coverImage:coverImage.url},{new:true}).select("-password")

  return res.status(200).json(new ApiResponse(200, user, "coverImage updated successfully"));
})


const getUserChannelProfile=asyncHandler(async(req,res)=>{
  const {userName}=req.params

  if(!userName?.trim()){
    throw new ApiError(400, "userName is required")
  }

  const channel=await User.aggregate([
    {
      $match:{
        userName:userName?.toLowerCase()
      }
    },
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"
      }
    },
    
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"subscriber",
        as:"subscribedTo"
      }
    },

    {
      $addFields:{
        subscriberCount:{$size:"$subscribers"},
        subscribedToCount:{$size:"$subscribedTo"}
      },
      isSubscribed:{
        $cond:{
          if:{$in:[req.user?._id,"$subscribers.subscriber"]},
          then:true,
          else:false
        }
      }
    },
    {
      $project:{
        fullName:1,
        userName:1,
        subscriberCount:1,
        subscribedToCount:1,
        avatar:1,
        coverImage:1,
        email:1,
        isSubscribed:1
      }
    }
    
  ])

  if(!channel){
    throw new ApiError(404, "Channel not found")
  } 

})


export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword, 
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile
}
