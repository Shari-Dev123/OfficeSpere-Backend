const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide task title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide task description'],
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['Todo', 'In Progress', 'Review', 'Completed', 'On Hold'],
      default: 'Todo',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    dueDate: {
      type: Date,
      required: true,
    },
    estimatedHours: {
      type: Number,
      default: 0,
    },
    actualHours: {
      type: Number,
      default: 0,
    },
    timer: {
      isRunning: { type: Boolean, default: false },
      startTime: Date,
      totalTime: { type: Number, default: 0 }, // in seconds
      sessions: [
        {
          startTime: Date,
          endTime: Date,
          duration: Number, // in seconds
        },
      ],
    },
    tags: {
      type: [String],
      default: [],
    },
    attachments: [
      {
        name: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        comment: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    completedAt: Date,
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
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ project: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ dueDate: 1 });

// Auto-update actualHours when timer stops
taskSchema.methods.stopTimer = function () {
  if (this.timer.isRunning && this.timer.startTime) {
    const endTime = new Date();
    const duration = Math.floor((endTime - this.timer.startTime) / 1000);
    
    this.timer.sessions.push({
      startTime: this.timer.startTime,
      endTime: endTime,
      duration: duration,
    });
    
    this.timer.totalTime += duration;
    this.timer.isRunning = false;
    this.timer.startTime = null;
    
    // Update actual hours
    this.actualHours = Math.round((this.timer.totalTime / 3600) * 100) / 100;
  }
};

module.exports = mongoose.model('Task', taskSchema);