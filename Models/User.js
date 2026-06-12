import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  name: { type: String },
  aadharCard: { type: String },
  panCard: { type: String },
  bankDetails: { type: String },
  qualification: { type: String },
  policeVerification: { type: String },
  uploadedAt: { type: Date },
}, { _id: false });

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  phone: { type: String, required: true },
  documents: { type: documentSchema, default: {} },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
