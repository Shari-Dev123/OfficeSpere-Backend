const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    clientId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    companyName: {
      type: String,
      required: [true, 'Please provide company name'],
      trim: true,
    },
    companyEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    companyPhone: {
      type: String,
      trim: true,
    },
    companyWebsite: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      enum: [
        'Technology',
        'Healthcare',
        'Finance',
        'Education',
        'Retail',
        'Manufacturing',
        'Real Estate',
        'Other',
      ],
    },
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
      sameAsCompanyAddress: { type: Boolean, default: true },
    },
    contactPerson: {
      name: String,
      designation: String,
      email: String,
      phone: String,
    },
    taxInfo: {
      taxId: String,
      gstNumber: String,
      panNumber: String,
    },
    projects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
      },
    ],
    totalProjects: {
      type: Number,
      default: 0,
    },
    activeProjects: {
      type: Number,
      default: 0,
    },
    completedProjects: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    feedback: [
      {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
clientSchema.index({ companyName: 1 });

module.exports = mongoose.model('Client', clientSchema);