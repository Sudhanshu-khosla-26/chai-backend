import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"
import { Like } from "../models/like.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "iNVALID Video Id")
    }

    const options = {
        page,
        limit,
      };

     const video = await Video.findById(videoId)
     
     const allComments = await Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId),
            },
        },
        //sort by date
    {
        $sort: {
            createdAt: -1,
          },
    },
    //fetch likes of comment
        {
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "comment",
              as: "likes",
              pipeline: [
                {
                  $match: {
                    liked: true,
                  },
                },
                {
                  $group: {
                    _id: "liked",
                    owners: { $push: "$likedBy" },
                  },
                },
              ],
            },
          },
             // Reshape Likes and dislikes
          {
            $addFields: {
              likes: {
                $cond: {
                  if: {
                    $gt: [{ $size: "$likes" }, 0],
                  },
                  then: { $first: "$likes.owners" },
                  else: [],
                },
              },
            },
          },
          //get owner details
          {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            fullname: 1,
                            username: 1,
                            avatar: 1,
                            _id: 1,
                        }
                    }
                ]
            }
          },
          {
            $unwind: "$owner"
          },
          {
            $project: {
                content: 1,
                owner: 1,
                createdAt: 1,
                updatedAt : 1,
                isOwner: {
                    $cond: {
                      if: { $eq: [req.user?._id, "$owner._id"] },
                      then: true,
                      else: false,
                    },
                  },
                  likesCount: {
                    $size: "$likes",
                  },
                  isLiked: {
                    $cond: {
                      if: {
                        $in: [req.user?._id, "$likes"],
                      },
                      then: true,
                      else: false,
                    },
                  },
                  isLikedByVideoOwner: {
                    $cond: {
                      if: {
                        $in: [video.owner, "$likes"],
                      },
                      then: true,
                      else: false,
                    },
            },
        }

          }
     ])

     //send paginated comments

     return res
     .status(200)
     .json(
        new ApiResponse(200, allComments, "All comments Sent")
    );

})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const { videoId } = req.params;
    const { content } = req.body;
  
    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid VideoId");
    if (!content) throw new ApiError(400, "No Comment Found");
  
    const comment = await Comment.create({
      content,
      video: videoId,
      owner: req.user?._id,
    });
    if (!comment) throw new ApiError(500, "Error while adding comment");
  
    const { username, avatar, fullName, _id } = req.user;
  
    const commentData = {
      ...comment._doc,
      owner: { username, avatar, fullName, _id },
      likesCount: 0,
      isOwner: true,
    };
  
    return res
      .status(200)
      .json(new ApiResponse(200, commentData, "Comment added successfully"));

})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const {commentId} = req.params;
    const {content} = req.body;

    if(!content){
        throw new ApiError(400, "Cotent is required");
    }
    
    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "Invalid Comment Id");
    }

    const updatedComment = await Comment.findByIdAndUpdate(commentId,
        {
            content: content,
        },
        {new: true}
    );

    if(!updatedComment){
        throw new ApiError(404, "updated comment not found");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedComment, "comment updated successfully")
    )

})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const { commentId } = req.params;
    
    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid VideoId");
    }

    const comment = await Comment.findByIdAndDelete(commentId);

    if (!comment) throw new ApiError(500, "Error while deleting comment");
    
    const deleteLikes = await Like.deleteMany({
      comment: new mongoose.Types.ObjectId(commentId),
    });
  
    return res
      .status(200)
      .json(
        new ApiResponse(200, { isDeleted: true }, "Comment deleted successfully")
      );

})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }
