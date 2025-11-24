import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, "Post content is required"],
      trim: true,
      maxlength: [5000, "Post content must not exceed 5000 characters"],
    },
    image: {
      type: String, // Cloudinary URL
      default: null,
    },
    privacy: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ privacy: 1, createdAt: -1 });

// Virtual for comment count
postSchema.virtual("commentCount", {
  ref: "Comment",
  localField: "_id",
  foreignField: "post",
  count: true,
});

const Post = mongoose.model("Post", postSchema);

export default Post;
