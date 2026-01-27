const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema(
  {
    meetingId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide meeting title'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Team', 'Client', 'Project', 'One-on-One', 'Review', 'Other'],
      required: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: String, // Role in meeting
        status: {
          type: String,
          enum: ['Invited', 'Accepted', 'Declined', 'Tentative', 'Attended', 'Absent'],
          default: 'Invited',
        },
        joinedAt: Date,
        leftAt: Date,
      },
    ],
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number, // in minutes
      required: true,
    },
    location: {
      type: String,
      enum: ['Office', 'Online', 'Client Office', 'Other'],
      default: 'Office',
    },
    meetingLink: {
      type: String, // Zoom, Google Meet, etc.
    },
    agenda: {
      type: String,
    },
    minutes: {
      discussion: String,
      decisions: [String],
      actionItems: [
        {
          description: String,
          assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
          dueDate: Date,
          status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed'],
            default: 'Pending',
          },
        },
      ],
      recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      recordedAt: Date,
    },
    attachments: [
      {
        name: String,
        url: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Rescheduled'],
      default: 'Scheduled',
    },
    reminder: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringPattern: {
      frequency: {
        type: String,
        enum: ['Daily', 'Weekly', 'Monthly'],
      },
      endDate: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
meetingSchema.index({ organizer: 1 });
meetingSchema.index({ startTime: 1 });
meetingSchema.index({ status: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);