// ============================================
//  SUDHA WELLNESS — DATABASE LAYER (MongoDB)
//  File: backend/db.js
//
//  Usage:
//    require('dotenv').config()
//    const { connectDB, User, Registration } = require('./db')
//    await connectDB()
// ============================================

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ---- CONNECT ----
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  MONGODB_URI not set — running in memory-only mode.');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    isConnected = true;
    console.log('✅ MongoDB connected:', mongoose.connection.host);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.warn('   Falling back to in-memory store.');
  }
}

// ============================================
//  SCHEMAS
// ============================================

// ---- Registration ----
const registrationSchema = new mongoose.Schema({
  webinarTitle:  { type: String, default: 'Holistic Wellness – Live Webinar' },
  webinarDate:   { type: Date,   default: new Date('2025-07-20T18:00:00+05:30') },
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, trim: true, lowercase: true },
  phone:         { type: String, required: true, trim: true },
  goal:          { type: String, enum: ['weight','stress','gut','energy','sleep','general',''], default: '' },
  regType:       { type: String, enum: ['FREE','VIP'], default: 'FREE' },
  amount:        { type: Number, default: 0 },
  paymentId:     { type: String, default: null },
  paymentMethod: { type: String, default: null },   // 'Razorpay' | 'PhonePe' | 'UPI'
  utrId:         { type: String, default: null },
  zoomLink:      { type: String, default: process.env.ZOOM_MEETING_LINK },
  whatsappSent:  { type: Boolean, default: false },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status:        { type: String, enum: ['upcoming','completed'], default: 'upcoming' },
  registeredAt:  { type: Date, default: Date.now },
}, { timestamps: true });

registrationSchema.index({ phone: 1 });
registrationSchema.index({ email: 1 });
registrationSchema.index({ regType: 1 });
registrationSchema.index({ registeredAt: -1 });

// ---- User ----
const userSchema = new mongoose.Schema({
  firstName:       { type: String, required: true, trim: true },
  lastName:        { type: String, default: '', trim: true },
  email:           { type: String, required: true, unique: true, trim: true, lowercase: true },
  phone:           { type: String, required: true, trim: true },
  passwordHash:    { type: String, required: true },
  city:            { type: String, default: '' },
  goal:            { type: String, default: '' },
  memberType:      { type: String, enum: ['FREE','VIP'], default: 'FREE' },
  whatsappConsent: { type: Boolean, default: true },
  isAdmin:         { type: Boolean, default: false },
  joinedAt:        { type: Date, default: Date.now },
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

// Password helpers
userSchema.methods.comparePassword = async function(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};
userSchema.statics.hashPassword = async function(plain) {
  return bcrypt.hash(plain, 12);
};

// Virtual: full name
userSchema.virtual('fullName').get(function() {
  return (this.firstName + ' ' + this.lastName).trim();
});
userSchema.set('toJSON', { virtuals: true });

// ---- Webinar Settings ----
const webinarSettingsSchema = new mongoose.Schema({
  title:       { type: String, default: 'Holistic Wellness – Live Webinar' },
  dateTime:    { type: Date,   default: new Date('2025-07-20T18:00:00+05:30') },
  zoomLink:    { type: String, default: '' },
  zoomId:      { type: String, default: '' },
  zoomPwd:     { type: String, default: '' },
  vipPrice:    { type: Number, default: 499 },
  totalSeats:  { type: Number, default: 100 },
  updatedAt:   { type: Date,   default: Date.now },
});

// ---- WhatsApp Log ----
const whatsappLogSchema = new mongoose.Schema({
  phone:     { type: String, required: true },
  name:      String,
  message:   String,
  provider:  { type: String, enum: ['twilio','meta','mock'] },
  sid:       String,
  success:   { type: Boolean, default: false },
  error:     String,
  sentAt:    { type: Date, default: Date.now },
});

// ============================================
//  MODELS
// ============================================
const Registration    = mongoose.models.Registration    || mongoose.model('Registration',    registrationSchema);
const User            = mongoose.models.User            || mongoose.model('User',            userSchema);
const WebinarSettings = mongoose.models.WebinarSettings || mongoose.model('WebinarSettings', webinarSettingsSchema);
const WhatsAppLog     = mongoose.models.WhatsAppLog     || mongoose.model('WhatsAppLog',     whatsappLogSchema);

// ============================================
//  DB HELPER FUNCTIONS
// ============================================

/** Save a new registration — creates or updates if duplicate phone */
async function saveRegistration(data) {
  if (!isConnected) return { success: false, message: 'DB not connected' };
  try {
    const existing = await Registration.findOne({ phone: data.phone, webinarTitle: data.webinarTitle });
    if (existing) {
      return { success: true, registration: existing, alreadyExists: true };
    }
    const reg = await Registration.create(data);
    return { success: true, registration: reg };
  } catch (err) {
    console.error('saveRegistration error:', err.message);
    return { success: false, message: err.message };
  }
}

/** Get all registrations (admin) with optional filters */
async function getAllRegistrations(filter = {}) {
  if (!isConnected) return [];
  return Registration.find(filter).sort({ registeredAt: -1 }).lean();
}

/** Get registrations for a specific user */
async function getUserRegistrations(userId) {
  if (!isConnected) return [];
  return Registration.find({ userId }).sort({ registeredAt: -1 }).lean();
}

/** Create a new user account */
async function createUser(data) {
  if (!isConnected) return null;
  const hash = await bcrypt.hash(data.password, 12);
  const user = await User.create({ ...data, passwordHash: hash });
  return user;
}

/** Find user by email */
async function findUserByEmail(email) {
  if (!isConnected) return null;
  return User.findOne({ email: email.toLowerCase() });
}

/** Get all users (admin) */
async function getAllUsers() {
  if (!isConnected) return [];
  return User.find({}, '-passwordHash').sort({ joinedAt: -1 }).lean();
}

/** Update user's member type to VIP after payment */
async function upgradeToVIP(userId) {
  if (!isConnected) return;
  return User.findByIdAndUpdate(userId, { memberType: 'VIP' }, { new: true });
}

/** Attach registration to user */
async function linkRegistrationToUser(userId, registrationId) {
  if (!isConnected) return;
  return User.findByIdAndUpdate(userId, {
    $addToSet: { registrations: registrationId },
  });
}

/** Get/create webinar settings */
async function getWebinarSettings() {
  if (!isConnected) return null;
  let settings = await WebinarSettings.findOne();
  if (!settings) settings = await WebinarSettings.create({});
  return settings;
}

/** Update webinar settings */
async function updateWebinarSettings(data) {
  if (!isConnected) return null;
  return WebinarSettings.findOneAndUpdate({}, { ...data, updatedAt: new Date() }, { upsert: true, new: true });
}

/** Log a WhatsApp send attempt */
async function logWhatsApp(data) {
  if (!isConnected) return;
  return WhatsAppLog.create(data);
}

/** Revenue stats */
async function getRevenueStats() {
  if (!isConnected) return { total: 0, count: 0, vipCount: 0 };
  const result = await Registration.aggregate([
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, vipCount: { $sum: { $cond: [{ $eq: ['$regType','VIP'] }, 1, 0] } } } },
  ]);
  return result[0] || { total: 0, count: 0, vipCount: 0 };
}

module.exports = {
  connectDB, isConnected: () => isConnected,
  // Models
  Registration, User, WebinarSettings, WhatsAppLog,
  // Helpers
  saveRegistration, getAllRegistrations, getUserRegistrations,
  createUser, findUserByEmail, getAllUsers, upgradeToVIP,
  linkRegistrationToUser, getWebinarSettings, updateWebinarSettings,
  logWhatsApp, getRevenueStats,
};
