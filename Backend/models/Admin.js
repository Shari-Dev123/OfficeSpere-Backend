const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    designation: {
      type: String,
      default: 'System Administrator',
    },
    department: {
      type: String,
      default: 'Administration',
    },
    permissions: {
      manageEmployees: { type: Boolean, default: true },
      manageClients: { type: Boolean, default: true },
      manageProjects: { type: Boolean, default: true },
      manageTasks: { type: Boolean, default: true },
      manageAttendance: { type: Boolean, default: true },
      manageMeetings: { type: Boolean, default: true },
      viewReports: { type: Boolean, default: true },
      manageSettings: { type: Boolean, default: true },
    },
    settings: {
      autoApproveLeave: { type: Boolean, default: false },
      requireApprovalForTasks: { type: Boolean, default: true },
      allowEmployeeTaskCreation: { type: Boolean, default: false },
      workingHours: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
      },
      workingDays: {
        type: [String],
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
    },
    companyInfo: {
      companyName: { type: String, default: 'OfficeSphere' },
      companyEmail: String,
      companyPhone: String,
      companyAddress: String,
      companyWebsite: String,
      taxId: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Admin', adminSchema);