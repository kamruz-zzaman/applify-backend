import express from "express";
import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import Like from "../models/Like.js";
import { authenticate } from "../middleware/auth.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

// Validation middleware
const validateComment = [
  body("text")
    .trim()
    .notEmpty()
    .withMessage("Comment text is required")
    .isLength({ max: 1000 })
    .withMessage("Comment must not exceed 1000 characters"),
];

// Create a comment on a post
router.post("/", authenticate, validateComment, async (req, res, next) => {
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

    const { text, postId } = req.body;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Create comment
    const comment = await Comment.create({
      text,
      post: postId,
      author: req.user._id,
      parent: null,
    });

    await comment.populate("author", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: "Comment created successfully",
      data: comment,
    });
  } catch (error) {
    next(error);
  }
});

// Get comments for a post (with nested replies)
router.get("/:postId", authenticate, async (req, res, next) => {
  try {
    const { postId } = req.params;

    // Get all top-level comments (parent is null)
    const comments = await Comment.find({
      post: postId,
      parent: null,
    })
      .sort({ createdAt: 1 })
      .populate("author", "firstName lastName email")
      .lean();

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await Comment.find({
          parent: comment._id,
        })
          .sort({ createdAt: 1 })
          .populate("author", "firstName lastName email")
          .lean();

        // Get like info for replies
        const repliesWithLikes = await Promise.all(
          replies.map(async (reply) => {
            const likeCount = await Like.countDocuments({
              targetType: "Comment",
              targetId: reply._id,
            });

            const userLiked = await Like.exists({
              targetType: "Comment",
              targetId: reply._id,
              user: req.user._id,
            });

            return {
              ...reply,
              likeCount,
              isLiked: !!userLiked,
            };
          })
        );

        // Get like info for comment
        const likeCount = await Like.countDocuments({
          targetType: "Comment",
          targetId: comment._id,
        });

        const userLiked = await Like.exists({
          targetType: "Comment",
          targetId: comment._id,
          user: req.user._id,
        });

        return {
          ...comment,
          likeCount,
          isLiked: !!userLiked,
          replies: repliesWithLikes,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: commentsWithReplies,
    });
  } catch (error) {
    next(error);
  }
});

// Reply to a comment
router.post(
  "/:id/reply",
  authenticate,
  validateComment,
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

      const { text } = req.body;
      const parentCommentId = req.params.id;

      // Check if parent comment exists
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "Parent comment not found",
        });
      }

      // Create reply
      const reply = await Comment.create({
        text,
        post: parentComment.post,
        author: req.user._id,
        parent: parentCommentId,
      });

      await reply.populate("author", "firstName lastName email");

      res.status(201).json({
        success: true,
        message: "Reply created successfully",
        data: reply,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Toggle like on a comment
router.post("/:id/like", authenticate, async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user already liked the comment
    const existingLike = await Like.findOne({
      user: req.user._id,
      targetType: "Comment",
      targetId: req.params.id,
    });

    if (existingLike) {
      // Unlike
      await Like.findByIdAndDelete(existingLike._id);
      const likeCount = await Like.countDocuments({
        targetType: "Comment",
        targetId: req.params.id,
      });

      return res.status(200).json({
        success: true,
        message: "Comment unliked",
        data: {
          isLiked: false,
          likeCount,
        },
      });
    } else {
      // Like
      await Like.create({
        user: req.user._id,
        targetType: "Comment",
        targetId: req.params.id,
      });

      const likeCount = await Like.countDocuments({
        targetType: "Comment",
        targetId: req.params.id,
      });

      return res.status(200).json({
        success: true,
        message: "Comment liked",
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

// Get users who liked a comment
router.get("/:id/likes", authenticate, async (req, res, next) => {
  try {
    const likes = await Like.find({
      targetType: "Comment",
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

// Delete a comment
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the author
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this comment",
      });
    }

    // Delete the comment and all its replies
    await Comment.deleteMany({
      $or: [{ _id: req.params.id }, { parent: req.params.id }],
    });

    // Delete all likes on this comment and its replies
    await Like.deleteMany({
      targetType: "Comment",
      targetId: req.params.id,
    });

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
