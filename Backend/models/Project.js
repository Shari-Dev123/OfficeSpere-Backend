const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide project name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide project description'],
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    projectManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    team: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Employee',
        },
        role: {
          type: String,
          enum: ['Developer', 'Designer', 'Tester', 'Team Lead', 'Other'],
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
      default: 'Planning',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    actualEndDate: {
      type: Date,
    },
    budget: {
      type: Number,
      required: true,
      min: 0,
    },
    spent: {
      type: Number,
      default: 0,
      min: 0,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    milestones: [
      {
        name: String,
        description: String,
        dueDate: Date,
        status: {
          type: String,
          enum: ['Pending', 'In Progress', 'Completed', 'Approved'],
          default: 'Pending',
        },
        completedAt: Date,
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Client',
        },
        approvedAt: Date,
      },
    ],
    deliverables: [
      {
        name: String,
        description: String,
        fileUrl: String,
        status: {
          type: String,
          enum: ['Pending', 'Submitted', 'Approved', 'Rejected'],
          default: 'Pending',
        },
        submittedAt: Date,
        feedback: String,
      },
    ],
    files: [
      {
        name: String,
        url: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    tags: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
projectSchema.index({ client: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ projectManager: 1 });

// Virtual for duration
projectSchema.virtual('duration').get(function () {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

module.exports = mongoose.model('Project', projectSchema);