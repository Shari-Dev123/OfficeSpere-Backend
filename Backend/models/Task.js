const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
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
      required: false, // ✅ Made optional
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // ✅ Made optional (will be set by controller)
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'on-hold'], // ✅ Match frontend
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'], // ✅ Match frontend (lowercase)
      default: 'medium',
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
    startedAt: Date,
    completedAt: Date,
    timer: {
      isRunning: { type: Boolean, default: false },
      startTime: Date,
      totalTime: { type: Number, default: 0 },
      sessions: [
        {
          startTime: Date,
          endTime: Date,
          duration: Number,
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate taskId before saving
taskSchema.pre('save', async function(next) {
  if (!this.taskId) {
    const count = await mongoose.model('Task').countDocuments();
    this.taskId = `TSK${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Indexes
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ project: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ dueDate: 1 });

// Stop timer method
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
    
    this.actualHours = Math.round((this.timer.totalTime / 3600) * 100) / 100;
  }
};

module.exports = mongoose.model('Task', taskSchema);