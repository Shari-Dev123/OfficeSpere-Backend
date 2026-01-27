const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    designation: {
      type: String,
      required: [true, "Please provide designation"],
    },
    department: {
      type: String,
      required: [true, "Please provide department"],
      enum: [
        "Development",
        "Design",
        "Marketing",
        "Sales",
        "HR",
        "Finance",
        "Operations",
        "Management",
      ],
    },
    joiningDate: {
      type: Date,
      required: [true, "Please provide joining date"],
      default: Date.now,
    },
    salary: {
      type: Number,
      required: [true, "Please provide salary"],
      min: 0,
      default: 0,
    },
    reportingTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    skills: {
      type: [String],
      default: [],
    },
    experience: {
      type: Number, // in years
      default: 0,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },

    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""],
      default: "",
    },

    bio: {
      type: String,
      default: "",
      maxlength: 500,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    bankDetails: {
      accountNumber: String,
      bankName: String,
      ifscCode: String,
      accountHolderName: String,
    },
    documents: [
      {
        name: String,
        type: String, // 'Resume', 'ID Proof', 'Address Proof', etc.
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    performance: {
      rating: { type: Number, min: 0, max: 5, default: 0 },
      totalTasksCompleted: { type: Number, default: 0 },
      onTimeCompletion: { type: Number, default: 0 },
      averageTaskTime: { type: Number, default: 0 }, // in hours
    },
    attendance: {
      totalPresent: { type: Number, default: 0 },
      totalAbsent: { type: Number, default: 0 },
      totalLate: { type: Number, default: 0 },
      totalLeaves: { type: Number, default: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
employeeSchema.index({ department: 1 });

module.exports = mongoose.model("Employee", employeeSchema);
