import express from "express";
import Post from "../models/Post.js";
import Like from "../models/Like.js";
import { authenticate } from "../middleware/auth.js";
import { upload, uploadToCloudinary } from "../middleware/upload.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

// Validation middleware
const validatePost = [
  body("content")
    .trim()
    .notEmpty()
    .withMessage("Post content is required")
    .isLength({ max: 5000 })
    .withMessage("Post content must not exceed 5000 characters"),
  body("privacy")
    .optional()
    .isIn(["public", "private"])
    .withMessage("Privacy must be either public or private"),
];

// Create a new post
router.post(
  "/",
  authenticate,
  upload.single("image"),
  validatePost,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
          })),
        });
      }

      const { content, privacy = "public" } = req.body;
      let imageUrl = null;

      // Upload image to Cloudinary if provided
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, "posts");
        imageUrl = result.secure_url;
      }

      // Create post
      const post = await Post.create({
        content,
        image: imageUrl,
        privacy,
        author: req.user._id,
      });

      // Populate author details
      await post.populate("author", "firstName lastName email");

      res.status(201).json({
        success: true,
        message: "Post created successfully",
        data: post,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get posts feed (paginated, newest first)
router.get("/", authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get posts that are either public or authored by the current user
    const posts = await Post.find({
      $or: [{ privacy: "public" }, { author: req.user._id }],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "firstName lastName email")
      .lean();

    // Get like counts and user's like status for each post
    const postsWithLikes = await Promise.all(
      posts.map(async (post) => {
        const likeCount = await Like.countDocuments({
          targetType: "Post",
          targetId: post._id,
        });

        const userLiked = await Like.exists({
          targetType: "Post",
          targetId: post._id,
          user: req.user._id,
        });

        return {
          ...post,
          likeCount,
          isLiked: !!userLiked,
        };
      })
    );

    // Get total count for pagination
    const total = await Post.countDocuments({
      $or: [{ privacy: "public" }, { author: req.user._id }],
    });

    res.status(200).json({
      success: true,
      data: postsWithLikes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update a post
router.put("/:id", authenticate, validatePost, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
        })),
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if user is the author
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this post",
      });
    }

    const { content, privacy } = req.body;
    post.content = content;
    if (privacy) post.privacy = privacy;

    await post.save();
    await post.populate("author", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Post updated successfully",
      data: post,
    });
  } catch (error) {
    next(error);
  }
});

// Delete a post
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if user is the author
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this post",
      });
    }

    await Post.findByIdAndDelete(req.params.id);

    // Also delete all likes and comments associated with this post
    await Like.deleteMany({ targetType: "Post", targetId: req.params.id });

    res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

// Toggle like on a post
router.post("/:id/like", authenticate, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if user already liked the post
    const existingLike = await Like.findOne({
      user: req.user._id,
      targetType: "Post",
      targetId: req.params.id,
    });

    if (existingLike) {
      // Unlike
      await Like.findByIdAndDelete(existingLike._id);
      const likeCount = await Like.countDocuments({
        targetType: "Post",
        targetId: req.params.id,
      });

      return res.status(200).json({
        success: true,
        message: "Post unliked",
        data: {
          isLiked: false,
          likeCount,
        },
      });
    } else {
      // Like
      await Like.create({
        user: req.user._id,
        targetType: "Post",
        targetId: req.params.id,
      });

      const likeCount = await Like.countDocuments({
        targetType: "Post",
        targetId: req.params.id,
      });

      return res.status(200).json({
        success: true,
        message: "Post liked",
        data: {
          isLiked: true,
          likeCount,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get users who liked a post
router.get("/:id/likes", authenticate, async (req, res, next) => {
  try {
    const likes = await Like.find({
      targetType: "Post",
      targetId: req.params.id,
    })
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: likes.map((like) => ({
        user: like.user,
        likedAt: like.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
