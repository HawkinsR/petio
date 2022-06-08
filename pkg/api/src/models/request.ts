import mongoose from 'mongoose';

const RequestSchema = new mongoose.Schema({
  requestId: String,
  type: String,
  title: String,
  thumb: String,
  imdb_id: String,
  tmdb_id: String,
  tvdb_id: String,
  users: Array,
  sonarrId: Array,
  radarrId: Array,
  approved: Boolean,
  manualStatus: Number,
  pendingDefault: Object,
  seasons: Object,
  timeStamp: Date,
});

export default mongoose.model('Request', RequestSchema);
