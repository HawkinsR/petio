const mongoose = require("mongoose");

const LibrarySchema = mongoose.Schema(
  {
    allowSync: Boolean,
    art: String,
    composite: String,
    filters: Boolean,
    refreshing: Boolean,
    thumb: String,
    key: String,
    type: String,
    title: String,
    agent: String,
    scanner: String,
    language: String,
    uuid: String,
    updatedAt: Number,
    createdAt: Number,
    scannedAt: Number,
    content: Boolean,
    directory: Number,
    contentChangedAt: Number,
    hidden: String,
  },
  { collection: "libraries" }
);

module.exports = mongoose.model("Library", LibrarySchema);

// uuid
